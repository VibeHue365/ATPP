# VIBEHUE — MA TRẬN QUYẾT ĐỊNH RÀNG BUỘC HỢP ĐỒNG THANH TOÁN (DECISION MATRIX)
## PAYMENT_CONTRACT_BINDING_DECISION_MATRIX.md

**Tài liệu**: Ma trận quyết định kỹ thuật & Quy chuẩn bảo mật nghiệp vụ  
**Tác giả**: Antigravity  
**Trạng thái**: ĐANG CHỜ PHÊ DUYỆT (PENDING BUSINESS/TECH LEAD APPROVAL)  
**Phạm vi**: `ContractCheckoutGuard`, `PaymentsService`, `V2PaymentFinalizationService`, `AdminDesk`  

---

## 1. PHÂN LOẠI NGUỒN GỐC GIAO DỊCH (PAYMENT PROVENANCE TAXONOMY)

Để xử lý chính xác và không làm sai lệch số liệu tài chính, toàn bộ các bản ghi `Payment` trong hệ thống được phân định thành 5 nhóm nguồn gốc dữ liệu:

```
                                  [Toàn bộ Giao dịch Payment]
                                               │
      ┌────────────────────┬───────────────────┼───────────────────┬────────────────────┐
      ▼                    ▼                   ▼                   ▼                    ▼
[Nhóm 1: LEGACY]    [Nhóm 2: MOCK P0.1] [Nhóm 3: AUTHENTIC] [Nhóm 4: POLICY DRIFT] [Nhóm 5: HOLD EXPIRED]
• flowVersion != 2  • Tạo trước P0.2    • Tạo sau P0.2      • Shop đổi chính     • Nạp tiền sau khi
• Không có Hợp đồng • Quy chế mock      • Quy chế thật đã ký  sách giữa chừng      hết hạn 15 phút
• Xử lý truyền thống• CẦN ĐỐI SOÁT      • Hoàn tất tự động  • CẦN ĐỐI SOÁT       • CẦN ĐỐI SOÁT
```

### Chi tiết 5 nhóm:
1. **Nhóm 1 — Legacy / Photography (`LEGACY_V1`)**:
   - Đặc điểm: `contractFlowVersion === null || 1` hoặc `bookingType === 'PHOTOGRAPHY'`.
   - Cơ chế: Bỏ qua hoàn toàn `ContractCheckoutGuard`. Thanh toán được xác nhận thẳng vào `booking.status = CONFIRMED`.
2. **Nhóm 2 — Giao dịch mock thời kỳ trước P0.2 (`V2_MOCK_APPROVAL_PRE_P02`)**:
   - Đặc điểm: Được tạo khi feature flag mock cứng `status: 'APPROVED'` cho quy chế tự động V2.
   - Bản chất: Ràng buộc lưu `mechanismHash` của văn bản mock, **chưa từng có Business/Legal Sign-off thực tế**.
   - Hành vi xử lý: Khi chạy finalization, Guard phát hiện quy chế hiện tại là `DRAFT` (hoặc hash không khớp) -> **Bắt buộc chuyển sang `needsManualReview: true`**, tuyệt đối không được tự động confirm.
3. **Nhóm 3 — Giao dịch V2 chuẩn mực (`V2_AUTHENTIC_ACTIVE`)**:
   - Đặc điểm: Tạo sau khi Quy chế nền tảng đã có phê duyệt pháp lý thật và Shop đã chủ động ký chấp thuận.
   - Cơ chế: `ContractPaymentBinding` khớp 100% với snapshot live -> Chuyển `booking.status = CONFIRMED`.
4. **Nhóm 4 — Sai lệch chính sách Shop giữa chừng (`V2_POLICY_DRIFT`)**:
   - Đặc điểm: Khách hàng đồng ý hợp đồng lúc $t_0$. Trong lúc khách thanh toán, Shop thay đổi giá thuê/phí đền bù lúc $t_1$.
   - Cơ chế: Guard phát hiện `fingerprint` hoặc chính sách Shop bị lệch -> Chuyển sang `needsManualReview: true`. **Bảo tồn nguyên vẹn văn bản khách đã ký**, không tự ý áp đặt chính sách mới lên đơn cũ.
5. **Nhóm 5 — Thanh toán trễ sau khi hết hạn giữ chỗ (`V2_HOLD_EXPIRED`)**:
   - Đặc điểm: Khách chuyển khoản sau khi cửa sổ giữ đồ 15 phút đã trôi qua.
   - Cơ chế: Giữ trạng thái tiền khách là `SUCCESS`, chuyển booking sang đối soát, xếp hàng hoàn tiền nếu kho đồ đã bị người khác thuê mất.

---

## 2. MA TRẬN QUYẾT ĐỊNH TOÀN DIỆN QUA CÁC GIAI ĐOẠN (LIFECYCLE DECISION MATRIX)

| Giai đoạn vòng đời | Nhóm giao dịch | Trạng thái Guard | Hành vi hệ thống | Kết quả Payment | Kết quả Booking |
|---|---|---|---|---|---|
| **1. Khởi tạo Payment Intent** (`createV2PaymentIntent`) | Bất kỳ V2 | Mechanism = `DRAFT` | **CHẶN NGAY LẬP TỨC** (HTTP 422 `CONTRACT_MECHANISM_NOT_APPROVED`) | Không tạo bản ghi | Giữ `PENDING_PAYMENT` |
| | Bất kỳ V2 | Shop thiếu Acceptance | **CHẶN NGAY LẬP TỨC** (HTTP 422 `PROVIDER_ACCEPTANCE_MISSING`) | Không tạo bản ghi | Giữ `PENDING_PAYMENT` |
| | Bất kỳ V2 | Đủ điều kiện hợp lệ | **CHO PHÉP** (Lưu `ContractPaymentBinding` bất biến) | `PENDING` | Giữ `PENDING_PAYMENT` |
| **2. Xác nhận Thanh toán** (`confirmV2Payment`) | Legacy / Photo | Bỏ qua Guard | Hoàn tất thanh toán truyền thống | `SUCCESS` | `CONFIRMED` |
| | V2 Chuẩn mực | Guard `PASS` | Khóa nguyên tử, Finalize đơn hàng V2 | `SUCCESS` | `CONFIRMED` (`finalizedPaymentId`) |
| | V2 Mock P0.1 | Guard `FAIL` (Mechanism DRAFT) | `acknowledgeV2ForReview` (Ghi nhận tiền, chặn đơn) | `SUCCESS` (`needsManualReview: true`) | `PENDING_PAYMENT` (`paymentReviewRequired`) |
| | V2 Policy Drift | Guard `FAIL` (Stale Hash) | `acknowledgeV2ForReview` (Ghi nhận tiền, bảo tồn hợp đồng cũ) | `SUCCESS` (`needsManualReview: true`) | `PENDING_PAYMENT` (`paymentReviewRequired`) |
| | V2 Hold Expired | Guard `FAIL` (Hold Expired) | `acknowledgeV2ForReview` (Ghi nhận tiền sau hạn giữ) | `SUCCESS` (`needsManualReview: true`) | `PENDING_PAYMENT` (`paymentReviewRequired`) |
| **3. Recovery Worker** (`processDue`) | Đang Review | Guard vẫn `FAIL` | Bỏ qua, không tự ý retry cưỡng ép | `SUCCESS` | `PENDING_PAYMENT` |
| | Hợp lệ sau bổ sung | Guard `PASS` | Finalize tự động đơn hàng | `SUCCESS` | `CONFIRMED` |
| **4. Admin Desk** | Đang Review | Admin can thiệp | **TUÂN THỦ QUY TẮC ZERO-BYPASS** (Xem mục 3) | Minh bạch tài chính | Theo lệnh đối soát |

---

## 3. NGUYÊN TẮC BẤT KHẢ XÂM PHẠM: ZERO-BYPASS DÀNH CHO ADMIN

> **QUY TẮC TỐI THƯỢNG**: Không một quản trị viên (Admin) nào được phép bấm nút "Bypass Guard" để cưỡng ép chuyển `booking.status = CONFIRMED` khi các điều kiện Hợp đồng điện tử chưa đạt.

### Lý do pháp lý và an toàn vận hành:
1. **Tránh rủi ro tranh chấp pháp lý**: Một hợp đồng điện tử chỉ có giá trị khi khách hàng đã xem và ký đúng phiên bản có hiệu lực. Nếu Admin ép Confirmed khi hợp đồng đang sai lệch, khách hàng có thể kiện nền tảng vì vi phạm điều khoản dịch vụ và tự ý áp đặt hợp đồng giả mạo.
2. **Không hợp thức hóa quy chế DRAFT**: Nếu quy chế nền tảng chưa được Ban Giám đốc và Pháp chế ký duyệt, việc Admin ép duyệt đơn hàng sẽ đưa giao dịch thương mại vào rủi ro vận hành phi chuẩn mực.

### Hai lựa chọn duy nhất dành cho Người vận hành tại Admin Desk:

```
                            [Xử lý tại Admin Desk]
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
  [LỰA CHỌN 1: TÁI THẨM ĐỊNH HỢP LỆ]             [LỰA CHỌN 2: HOÀN TRẢ TIỀN 100%]
  (Khi điều kiện thiếu đã được bổ sung)          (Khi không thể đáp ứng hợp đồng)
               │                                             │
               ▼                                             ▼
  • Điều kiện: Quy chế thật đã được duyệt        • Điều kiện: Shop đổi giá / hết đồ /
    HOẶC Shop đã ký chấp thuận quy chế.            khách không đồng ý chính sách mới.
  • Hành động: Admin bấm "Tái thẩm định".        • Hành động: Admin bấm "Xếp hàng hoàn tiền".
  • Hệ thống: Chạy lại ContractCheckoutGuard.    • Hệ thống: Tạo RefundIntent từ PayOS gốc.
  • Nếu Guard PASS -> Chuyển CONFIRMED.          • Chuyển booking.status = CANCELLED.
  • Nếu Guard FAIL -> Tiếp tục chặn.             • Hoàn trả 100% tiền về tài khoản khách.
```

---

## 4. TÍNH BẤT BIẾN CỦA RÀNG BUỘC (IMMUTABLE BINDING INTEGRITY)

* **Những dữ liệu bất biến không được sửa đổi**:
  - `contentHash`: Mã băm SHA-256 của toàn bộ nội dung văn bản hợp đồng khách hàng đã xem.
  - `bookingFingerprint`: Dấu vân tay của danh sách sản phẩm, kích thước, giá thuê và tiền cọc lúc ký.
  - `ContractConsent`: Bản ghi chấp thuận kèm IP/Session và timestamp bất biến.
* **Nguyên tắc khi Recovery / Đối soát**:
  - Hệ thống chỉ đối chiếu với `contentHash` và `bookingFingerprint` đã lưu trong `ContractPaymentBinding`.
  - Tuyệt đối không tự ý cập nhật snapshot cũ bằng các giá trị mới từ bảng Product hay Provider Policy khi chưa có sự chấp thuận mới của khách hàng.
