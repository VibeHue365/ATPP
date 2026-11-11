# VIBEHUE — PHASE 8: BUSINESS & LEGAL BLOCKERS AUDIT

**Document Version:** 1.0.0  
**Phase:** 8A — Risk & Blocker Audit  
**Branch:** `feat/electronic-contracts`  
**Date:** 29/10/2026  
**Status:** **CRITICAL BLOCKERS IDENTIFIED — PRODUCTION ROLLOUT HALTED**  

---

## Tuyên bố Nguyên tắc Kiểm toán
> [!IMPORTANT]
> **Tuyệt đối không suy đoán hoặc coi các nội dung DRAFT là đã được phê duyệt.**  
> Mọi điều khoản trong mã nguồn được đánh dấu `DRAFT`, `approvedAt: null`, hoặc các cơ chế kỹ thuật chưa có văn bản ký duyệt từ Ban Giám đốc và Cố vấn Pháp lý của VibeHue đều được xác định là **P0 BLOCKER** ngăn chặn việc bật cờ `CONTRACTS_V2_ENABLED` trên môi trường ứng dụng và môi trường giao dịch thật.

---

## 1. Chi tiết Các Rào cản Pháp lý & Nghiệp vụ (Blockers Detail)

### 1.1 Mẫu Điều khoản Hợp đồng Thuê Áo dài (`AO_DAI_RENTAL_V1`)
- **Vị trí trong mã nguồn:** `backend/src/modules/contracts/contract-template.ts` (dòng 12-47).
- **Hiện trạng kỹ thuật:**
  ```typescript
  export const AO_DAI_RENTAL_V1: ContractTemplate = Object.freeze({
    version: 'ao-dai-rental-v1',
    status: 'DRAFT',
    approvedAt: null,
    title: 'Hợp đồng thuê áo dài — bản nháp nội bộ',
    // ...
  });
  ```
- **Hành vi Fail-closed:** Phương thức `ContractTemplateService.getApproved()` chủ động ném ngoại lệ `UnprocessableEntityException('CONTRACT_TEMPLATE_NOT_APPROVED')` nếu được gọi.
- **Vấn đề tồn đọng:**
  1. Toàn bộ câu chữ điều khoản, trách nhiệm bồi thường khi làm rách/ố bẩn/mất phụ kiện, thời hạn hoàn trả hiện chỉ mang tính chất placeholder kỹ thuật.
  2. Chưa có văn bản pháp lý chính thức quy định quyền và nghĩa vụ của bên thuê và bên cho thuê đối với tài sản văn hóa áo dài truyền thống.
- **Hành động bắt buộc để gỡ Blocker:** Cố vấn Pháp lý cung cấp bản điều khoản hoàn chỉnh (Final Terms of Service); Ban Giám đốc ký duyệt và cập nhật `status: 'APPROVED'` kèm ngày phê duyệt `approvedAt`.

---

### 1.2 Cơ chế Chấp thuận trước của Đối tác (`AUTO_ACCEPTANCE_MECHANISM_V1`)
- **Vị trí trong mã nguồn:** `backend/src/modules/contracts/contract-mechanism.service.ts` (dòng 13-21).
- **Hiện trạng kỹ thuật:**
  ```typescript
  export const AUTO_ACCEPTANCE_MECHANISM_V1: AutoAcceptanceMechanism = Object.freeze({
    version: 'auto-acceptance-v1',
    status: 'DRAFT',
    approvedAt: null,
    scope: 'AO_DAI_RENTAL',
    description: 'Provider chấp thuận trước cơ chế giao kết tự động; điều khoản cụ thể cần được phê duyệt trước khi sử dụng.',
  });
  ```
- **Hành vi Fail-closed:** Gọi `ContractMechanismService.getApproved()` ném ngoại lệ `UnprocessableEntityException('CONTRACT_MECHANISM_NOT_APPROVED')`.
- **Vấn đề tồn đọng:**
  1. Tính hợp pháp của cơ chế: Luật Giao dịch Điện tử 2023 và Nghị định 52/2013/NĐ-CP (sửa đổi bởi Nghị định 85/2021/NĐ-CP) yêu cầu làm rõ liệu việc đối tác đồng ý Quy chế Hoạt động khi công bố sản phẩm lên sàn có đủ giá trị pháp lý để ủy quyền nền tảng tự động tạo hợp đồng thuê điện tử hay không.
  2. Văn bản Quy chế Sàn Giao dịch Thương mại Điện tử VibeHue (Platform Operating Regulations) chưa được đăng ký chính thức với Cục Thương mại Điện tử và Kinh tế Số (Bộ Công Thương).
- **Hành động bắt buộc để gỡ Blocker:** Xác nhận pháp lý bằng văn bản về cơ chế ủy quyền giao kết tự động và ban hành Quy chế Sàn chính thức.

---

### 1.3 Chính sách Tiền cọc, Hoàn tiền và Phí phạt Trả chậm (Deposit & Fee Policies)
- **Vị trí trong mã nguồn:** `backend/src/modules/contracts/contract-snapshot.service.ts` và hệ thống chính sách `system-policies`.
- **Vấn đề tồn đọng:**
  1. **Khung biểu phí thiệt hại:** Chưa có quy định thống nhất về tỷ lệ khấu trừ tiền cọc khi trang phục hư hỏng (mức độ bẩn nhẹ, đứt chỉ, rách tà, mất cúc, mất phụ kiện đi kèm).
  2. **Thời hạn hoàn cọc:** Quy trình đối soát và hoàn tiền cọc sau khi đối tác nhận lại trang phục (hiện đề xuất 24h - 48h) chưa có thỏa thuận ràng buộc với các cửa hàng áo dài đối tác.
  3. **Thuật toán phân bổ chi phí Combo (`UNALLOCATED_BOOKING_FIELDS`):**
     Trong các đơn hàng đa đối tác (`mixed`), nếu có voucher toàn sàn (`voucherSnapshot.discountAmount`) hoặc các khoản phí chung (`travelFee`, `serviceFee`, `discountAmount`), mã nguồn sẽ chủ động ném lỗi:
     `CONTRACT_PRICING_ALLOCATION_UNDEFINED` / `CONTRACT_VOUCHER_ALLOCATION_UNDEFINED`.
     Hiện chưa có công thức toán học được duyệt để phân bổ tỷ lệ giảm giá voucher giữa các đối tác trong cùng một đơn hàng combo.
- **Hành động bắt buộc để gỡ Blocker:** Ban hành chính sách cọc & bảng biểu phí thiệt hại; xác định rõ công thức phân bổ tài chính cho các đơn hàng combo.

---

### 1.4 Quy tắc Xác lập và Kích hoạt Hiệu lực Hợp đồng (Contract Formation Rules)
- **Vấn đề tồn đọng:**
  1. Cần phân định rõ ràng 3 mốc thời gian:
     - **Thời điểm chấp thuận (Consent Recorded):** Khách hàng tích chọn đồng ý điều khoản trên giao diện (chưa thanh toán).
     - **Thời điểm giao kết/xác lập (Contract Formed):** Khoảnh khắc giao dịch thanh toán tiền cọc/tiền thuê được xác nhận thành công qua PayOS.
     - **Thời điểm có hiệu lực (Effective Period):** Khoảng thời gian khách hàng thực tế nhận và sử dụng trang phục (`rentalFrom` đến `rentalTo`).
  2. Toàn bộ giao diện frontend tại Phase 7B.2 đã được chuẩn hóa sang từ ngữ trung lập ("Đã ghi nhận chấp thuận"). Cần sự chuẩn thuận của bộ phận pháp chế rằng quy trình này đáp ứng đúng các quy định về hình thành hợp đồng thương mại điện tử.
- **Hành động bắt buộc để gỡ Blocker:** Phê duyệt quy trình xác lập hợp đồng 2 bước (Chấp thuận điều khoản -> Giao kết sau thanh toán).

---

### 1.5 Kế hoạch Rollout Migration & Đánh Chỉ mục Database Production
- **Vị trí trong mã nguồn:** `backend/scripts/migrate-contract-v2.js` và `backend/src/modules/contracts/contract-index.integration.spec.ts`.
- **Vấn đề tồn đọng:**
  1. Script `migrate-contract-v2.js` hiện đang được bảo vệ nghiêm ngặt: chỉ cho phép chạy `--dry-run` hoặc `--apply` trên database test (`--test-db=NAME --allow-test-write`).
  2. Database production Atlas `vibehue_db` có chứa dữ liệu đơn hàng thực tế của khách hàng. Việc tạo các unique indexes:
     - `{ bookingId: 1, providerId: 1, scope: 1 }`
     - `{ contractVersionId: 1, actorUserId: 1 }`
     - `{ actorUserId: 1, idempotencyKey: 1 }`
     cần phải đảm bảo không có dữ liệu trùng lặp lịch sử (legacy duplicates) gây lỗi build index và không làm gián đoạn dịch vụ (zero-downtime rolling index build).
- **Hành động bắt buộc để gỡ Blocker:** Lập quy trình bảo trì (Maintenance Window SOP), chạy audit dry-run trên bản sao lưu (backup dump) trước khi thực hiện trên production.

---

### 1.6 Khoảng trống Kiến trúc API Tra cứu Hợp đồng Khách hàng (`GET /api/contracts/my`)
- **Vị trí trong mã nguồn:** `frontend/src/features/profile/components/tabs/ProfileContractsTab.tsx`.
- **Vấn đề tồn đọng:**
  1. Frontend hiện tại phải tải toàn bộ danh sách đơn hàng của khách qua `BookingsService.getCustomerBookings()`, sau đó lặp qua từng đơn để gọi `listContractsForBooking()`.
  2. **Nguy cơ N+1 Request:** Khách hàng có 20 đơn hàng sẽ gây ra 21 HTTP requests song song.
  3. **Nguy cơ Mất dữ liệu khi Phân trang:** Nếu backend phân trang đơn hàng (ví dụ 10 đơn/trang), các hợp đồng thuộc đơn hàng ở trang 2 trở đi sẽ bị biến mất hoàn toàn khỏi danh sách tra cứu của khách hàng.
  4. Theo chỉ đạo kỷ luật, việc tự ý tạo endpoint mới bị nghiêm cấm trong các phase trước.
- **Hành động bắt buộc để gỡ Blocker:** Lập kế hoạch phát triển endpoint chính thức `GET /api/contracts/my` có phân trang cursor và đánh index `{ customerId: 1, createdAt: -1 }` trước khi đưa tính năng vào phục vụ người dùng thật.

---

## 2. Bảng Tổng kết Ma trận Rủi ro & Blockers

| Mã rào cản | Tên rào cản | Bộ phận chịu trách nhiệm | Mức độ nghiêm trọng | Trạng thái hiện tại |
| :---: | :--- | :---: | :---: | :---: |
| **BLK-01** | Bản điều khoản mẫu hợp đồng thuê áo dài chính thức | Pháp chế / Ban Giám đốc | **P0 (Critical)** | `DRAFT` — Chưa duyệt |
| **BLK-02** | Quy chế hoạt động sàn & Cơ chế AUTO_ACCEPTANCE | Pháp chế / Vận hành | **P0 (Critical)** | `DRAFT` — Chưa duyệt |
| **BLK-03** | Khung biểu phí thiệt hại & Công thức chiết khấu Combo | Tài chính / Kinh doanh | **P1 (High)** | Chưa có công thức phân bổ |
| **BLK-04** | Xác nhận quy trình giao kết 2 bước (Accept -> Paid) | Pháp chế | **P1 (High)** | Đã xong UI, chờ duyệt văn bản |
| **BLK-05** | Quy trình Index Migration an toàn cho Database Atlas | Đội ngũ DevOps / Backend | **P1 (High)** | Script sẵn sàng cho test DB |
| **BLK-06** | Triển khai API phân trang `GET /api/contracts/my` | Đội ngũ Backend | **P2 (Medium)** | Kiến trúc đang chịu tải N+1 |

---

## 3. Kết luận Điều kiện Chuyển giao

**Căn cứ vào danh sách 6 rào cản trên:**
1. **DỪNG TOÀN BỘ VIỆC BẬT TÍNH NĂNG TRÊN MÔI TRƯỜNG PRODUCTION VÀ ỨNG DỤNG THỰC TẾ.**
2. Việc chuyển tiếp sang Phase 8B chỉ được phép diễn ra dưới hình thức **Automated Synthetic E2E Verification** (Kiểm thử tự động trên dữ liệu giả lập và database test độc lập).
