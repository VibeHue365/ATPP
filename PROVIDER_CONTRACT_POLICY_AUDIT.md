# VIBEHUE — AUDIT HỆ THỐNG PROVIDER CONTRACT POLICY

Tài liệu kiểm toán toàn diện kiến trúc hiện tại của hệ thống Hợp đồng Điện tử (Contracts V2) liên quan đến Nhà cung cấp (Provider), chính sách thuê (Rental Policies), quy chế chấp thuận trước (Auto-Acceptance Mechanism), và tính bất biến của hợp đồng.

---

## 1. Trả lời các câu hỏi Audit cốt lõi

### 1.1. Backend đã có cơ chế Provider chấp thuận quy chế chưa?
- **Đã có khung dịch vụ backend**, nhưng **chưa có quy trình tương tác thực tế của người dùng Provider**.
- Cụ thể:
  - Backend sở hữu `ProviderContractApprovalService` với các hàm `status()`, `accept()`, và `revoke()`.
  - Bộ dữ liệu lưu trữ đã có bảng `provider_contract_acceptances` với schema `ProviderContractAcceptance` ghi nhận trạng thái `ACTIVE` / `REVOKED`.
  - **Lỗ hổng thực tế:** Trong `ContractPreparationService.prepare()` (dòng 66–115), nếu Provider chưa từng bấm chấp thuận (`PROVIDER_AUTO_ACCEPTANCE_MISSING`), hệ thống đang **tự động upsert bản ghi chấp thuận ngầm** vào bảng `provider_contract_acceptances` với mã hash của `AUTO_ACCEPTANCE_MECHANISM_V2` để không chặn luồng test của khách. 
  - Do đó, về mặt pháp lý và thực tế, Provider chưa từng được đọc văn bản quy chế và chưa từng chủ động nhấn nút chấp thuận.

---

### 1.2. Các API nào đã tồn tại thực sự?

| Phương thức | Đường dẫn API | Controller | Trạng thái hiện tại |
| :--- | :--- | :--- | :--- |
| `GET` | `/contracts/provider/mechanism`<br>`/api/contracts/provider/mechanism` | `ContractsController.mechanism()` | Trả về bản thảo cơ chế `AUTO_ACCEPTANCE_MECHANISM_V1` kèm băm canonical. |
| `GET` | `/contracts/provider/acceptance`<br>`/api/contracts/provider/acceptance` | `ContractsController.providerStatus()` | Trả về trạng thái chấp thuận hiện tại của Provider (`ACTIVE` hoặc `null`). |
| `POST` | `/contracts/provider/acceptance`<br>`/api/contracts/provider/acceptance` | `ContractsController.acceptMechanism()` | Nhận `{ mechanismHash }`, kiểm tra khớp băm quy chế và băm chính sách hiện tại (`policyFingerprint`), tạo bản ghi `ACTIVE`. |
| `POST` | `/contracts/provider/acceptance/revoke`<br>`/api/contracts/provider/acceptance/revoke` | `ContractsController.revokeMechanism()` | Thu hồi trạng thái cam kết (`status: REVOKED`, `revokedAt`). |

*Lưu ý: Mặc dù 4 API trên đã có sẵn trong controller và service backend, giao diện Provider Frontend (`ProviderContractStatusCard.tsx`) chỉ mới gọi 2 API đọc (`GET`), hoàn toàn chưa có nút bấm hay form để gọi `POST acceptance` hay `POST revoke`.*

---

### 1.3. Các điều khoản riêng của Provider hiện đang được lưu ở đâu?
- Được lưu tại collection `providers` (`backend/src/modules/providers/schemas/provider.schema.ts`), thuộc trường `policies: ProviderPolicies`:
  ```typescript
  policies: {
    cancellationPolicy?: string | null;      // Chuỗi text mô tả hủy đơn
    rentalPolicy?: string | null;            // Chuỗi text mô tả điều khoản thuê
    cancellationPolicyConfig?: {             // Cấu hình mốc ngày hủy
      refundRules: Array<{ noticeDays: number; refundPercent: number }>;
      additionalNotes?: string | null;
    };
  }
  ```
- **Hạn chế:**
  - `rentalPolicy` chỉ là một trường chuỗi đơn lẻ (`string`), không có cấu trúc phân định (thời gian thuê, bảo quản, phụ kiện, đền bù, v.v.).
  - Giao diện Provider (`ServiceProfilePanel.tsx`) hiện chỉ cho sửa mốc hủy (`cancellationRefundRules`), **hoàn toàn chưa có ô nhập cho `rentalPolicy`** hay các điều khoản bảo quản trang phục.

---

### 1.4. Snapshot hiện tại đã lấy những chính sách nào?
Trong `ContractSnapshotService.resolvePolicySnapshot()` (dòng 291–316 của `contract-snapshot.service.ts`), snapshot của hợp đồng trích xuất 5 trường chính sách:
1. `cancellation`: Chính sách hủy cấp sàn (lấy từ `PolicyResolverService` với mã `PolicyCode.CancellationPolicy`).
2. `refund`: Chính sách hoàn tiền cấp sàn (lấy từ `PolicyResolverService` với mã `PolicyCode.RefundPolicy`).
3. `providerRental`: Chuỗi `provider.policies?.rentalPolicy`. Nếu provider để trống, hệ thống tự động gán fallback tĩnh:
   > *"Bảo quản trang phục áo dài nguyên vẹn trong thời gian thuê, sử dụng đúng mục đích và hoàn trả đúng thời hạn thỏa thuận. Mọi hư hỏng, mất mát sẽ bồi thường theo giá trị trang phục quy định tại hợp đồng."*
4. `providerCancellation`: Chuỗi `provider.policies?.cancellationPolicy`. Nếu trống, tự động gán fallback tĩnh:
   > *"Hủy trước 48h hoàn trả 100% cọc. Sau 48h mất cọc."*
5. `providerPolicyUpdatedAt`: Thời điểm cập nhật cuối cùng của tài liệu Provider (`provider.updatedAt`).

---

### 1.5. Cơ chế versioning và revoke đã có đến đâu?
- **Bảng `provider_contract_acceptances`:**
  - Có lưu `mechanismVersion` (chuỗi version của quy chế, ví dụ `auto-acceptance-v1`).
  - Có lưu `templateVersion` (ví dụ `ao-dai-rental-v2`).
  - Có lưu `mechanismHash` (SHA-256 canonical của quy chế).
  - Có lưu `policyFingerprint` (SHA-256 của snapshot chính sách tại thời điểm ký cam kết).
  - Có hỗ trợ `REVOKED` qua API revoke.
  - Có chỉ mục một phần duy nhất (Unique Partial Index): Mỗi provider chỉ có duy nhất 1 bản ghi `status: 'ACTIVE'` cho mỗi `scope`.
- **Hạn chế lớn:**
  - **Không có Versioning cho bản thân Policy của Provider:** Khi Provider chỉnh sửa `provider.policies`, tài liệu Provider bị ghi đè trực tiếp, `provider.updatedAt` bị đổi.
  - Khi đó, `policyFingerprint` bị đổi khiến `ProviderContractAcceptance` cũ bị lệch so với dữ liệu trong `providers`, nhưng không lưu lại lịch sử phiên bản policy cũ (V1, V2, V3) đã áp dụng cho những hợp đồng trước đó.

---

### 1.6. Có nguy cơ tạo hai nguồn dữ liệu chính sách khác nhau (Dual Source of Truth) không?
- **CÓ NGUY CƠ RẤT CAO**, nếu không thiết kế cẩn thận:
  - Hiện tại, nếu thêm một bảng mới lưu policy mà không đồng bộ với trường `policies` trong bảng `providers`, các module khác (như `BookingsService` khi tính tiền hủy đơn, hay `PhotographerPackage`) sẽ đọc từ `providers.policies`, trong khi Hợp đồng điện tử lại đọc từ bảng mới.
  - Hơn nữa, việc tồn tại các chuỗi **hardcoded fallback** trong code (`ContractSnapshotService` tự bịa ra văn bản 48h / bảo quản khi shop để null) tạo ra nguồn dữ liệu "vô hình" thứ hai mà Provider không hề hay biết hay cam kết.

---

## 2. Bảng tổng hợp hiện trạng các thành phần hệ thống

| Thành phần | File mã nguồn | Đánh giá hiện trạng | Lỗ hổng / Rủi ro |
| :--- | :--- | :--- | :--- |
| **Approval Service** | `provider-contract-approval.service.ts` | Hoàn thiện logic băm & index | Đang bị bypass bởi logic auto-upsert ngầm trong `ContractPreparationService`. |
| **Mechanism Service** | `contract-mechanism.service.ts` | Có 2 phiên bản V1 (DRAFT) và V2 (APPROVED giả lập) | V2 là text mock do dev tự đặt ngày `2026-10-31`, chưa có phê duyệt từ Ban Điều hành/Pháp chế. |
| **Status Card UI** | `ProviderContractStatusCard.tsx` | Đã có card hiển thị metadata | Card chỉ đọc (Read-only), thông báo "không cần thao tác", thiếu nút ký cam kết và form sửa policy. |
| **Provider Schema** | `provider.schema.ts` | Đã có trường `policies` | Dữ liệu dạng text tự do, thiếu cấu trúc chuẩn (thời gian, phụ kiện, đền bù, trả trễ). |
| **Snapshot Service** | `contract-snapshot.service.ts` | Băm chuẩn canonical JSON SHA-256 | Tự sinh văn bản fallback nếu thiếu dữ liệu, dễ dẫn đến tranh chấp pháp lý. |
| **Checkout Guard** | `contract-checkout-guard.service.ts` | Kiểm tra fail-closed nghiêm ngặt | Phụ thuộc vào `requireAutoAcceptance`, nhưng bị che giấu bởi cơ chế auto-upsert ngầm. |
| **Immutable Contract** | `contract-version.schema.ts` | Rất tốt, snapshot đóng băng vĩnh viễn | Cần bảo đảm khi Provider sửa policy, snapshot của các hợp đồng cũ KHÔNG bị tính toán lại. |

---

## 3. Kết luận từ kết quả Audit

1. **Tuyệt đối không tạo collection hay API mới trùng lặp**: Hệ thống đã có đầy đủ endpoint `/contracts/provider/acceptance` và model `ProviderContractAcceptance`. Cần tận dụng 100% nền tảng này.
2. **Loại bỏ cơ chế Auto-upsert ngầm**: Phải dừng việc tự động tạo bản ghi chấp thuận thay cho Provider trong `ContractPreparationService`. Provider phải thực sự vào dashboard, đọc quy chế và tự bấm xác nhận.
3. **Cần cấu trúc hóa Provider Policy**: Chuyển đổi từ chuỗi text tự do sang đối tượng có cấu trúc (Structured Policy) với các trường nghiệp vụ rõ ràng, có kiểm soát biên độ và quy trình phê duyệt.
4. **Không đưa chính sách chưa duyệt vào Hợp đồng thật**: Mọi điều khoản riêng của Provider phải có trạng thái kiểm duyệt trước khi đưa vào snapshot giao kết với khách hàng.
