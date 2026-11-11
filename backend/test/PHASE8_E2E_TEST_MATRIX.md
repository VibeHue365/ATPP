# VIBEHUE — PHASE 8: END-TO-END TEST MATRIX SPECIFICATION

**Document Version:** 1.0.0  
**Phase:** 8A — Test Planning & Scenario Matrix  
**Branch:** `feat/electronic-contracts`  
**Date:** 29/10/2026  

---

## Danh mục 17 Kịch bản Kiểm thử Toàn trình (E2E Test Matrix)

| Mã kịch bản | Tên kịch bản | Phạm vi nghiệp vụ | Mức độ ưu tiên | Trạng thái dự kiến |
| :---: | :--- | :--- | :---: | :---: |
| **E2E-01** | Rental booking một provider | Đặt thuê áo dài đơn lẻ, chuẩn bị hợp đồng tự động | P0 | Blocker nếu fail |
| **E2E-02** | Combo booking nhiều provider | Combo thuê áo dài đa đối tác, phân tách hợp đồng độc lập | P0 | Blocker nếu fail |
| **E2E-03** | Khách ACCEPT tất cả hợp đồng | Đồng thuận toàn bộ điều khoản trước thanh toán | P0 | Blocker nếu fail |
| **E2E-04** | Khách DECLINE một hợp đồng | Khách từ chối điều khoản, chặn checkout ngay lập tức | P0 | Blocker nếu fail |
| **E2E-05** | Hợp đồng stale version | Phát hiện và xử lý xung đột khi điều khoản/đơn hàng thay đổi | P1 | Blocker nếu fail |
| **E2E-06** | Booking hold expired | Quá thời gian giữ chỗ (15 phút), khóa luồng consent & checkout | P0 | Blocker nếu fail |
| **E2E-07** | Payment sandbox success | Khách thanh toán thành công qua PayOS Webhook | P0 | Blocker nếu fail |
| **E2E-08** | Payment sandbox failure/cancel | Khách hủy thanh toán hoặc giao dịch hết hạn | P1 | Pass an toàn |
| **E2E-09** | Duplicate webhook | Webhook trùng lặp (at-least-once delivery), xử lý idempotent | P0 | Blocker nếu fail |
| **E2E-10** | Recovery sau khi worker bị gián đoạn | Worker PDF chết bất ngờ khi đang GENERATING, CAS lease tự phục hồi | P1 | Blocker nếu fail |
| **E2E-11** | PDF generation READY | Sinh tệp PDF nhị phân chuẩn 2 trang với font tiếng Việt Unicode | P0 | Blocker nếu fail |
| **E2E-12** | PDF hash verification | Xác thực SHA-256 tệp PDF thời gian thực (Zero-trust) | P0 | Blocker nếu fail |
| **E2E-13** | Customer download PDF | Khách hàng tải tài liệu PDF đã chứng thực | P1 | Pass an toàn |
| **E2E-14** | Provider isolation | Cô lập IDOR tuyệt đối giữa các đối tác trong cùng booking | P0 | Blocker nếu fail |
| **E2E-15** | Legacy checkout regression | Đơn hàng luồng cũ (V1) thanh toán bình thường không cần modal | P0 | Blocker nếu fail |
| **E2E-16** | Photography-only regression | Đơn hàng dịch vụ chụp ảnh (không thuê đồ) không sinh hợp đồng | P0 | Blocker nếu fail |
| **E2E-17** | Feature flag mismatch | Lệch cờ tính năng giữa Frontend và Backend (Fail-closed) | P0 | Blocker nếu fail |

---

## Đặc tả Chi tiết Từng Kịch bản

### E2E-01: Rental booking một provider
- **Preconditions:**
  - Provider A kích hoạt `AUTO_ACCEPTANCE` trên mẫu hợp đồng `ao-dai-rental-v2`.
  - Khách hàng đăng nhập có JWT hợp lệ.
  - Sản phẩm áo dài có tồn kho `AVAILABLE`.
- **Test Data:**
  - 1 sản phẩm Áo dài size M, giá 500,000 VND, tiền cọc 1,000,000 VND.
  - Thời gian thuê: 15/11/2026 - 18/11/2026 (3 ngày).
- **API/UI Steps:**
  1. Frontend gọi `POST /bookings` tạo đơn hàng `AODAI_RENTAL`.
  2. Backend tự động gọi `ContractPreparationService.prepareContractsForBooking`.
  3. Frontend mở `BookingCheckoutModal`, gọi `GET /contracts/bookings/:id/readiness`.
- **Expected DB State:**
  - `bookings`: `status: 'PENDING_PAYMENT'`, `contractFlowVersion: 2`, `holdExpiresAt: now + 15m`.
  - `digital_contracts`: đúng 1 bản ghi với `providerId: ProviderA`, `status: 'DRAFT'`.
  - `contract_versions`: đúng 1 version (v1), `state: 'OFFERED'`, `contentHash` và `bookingFingerprint` được tính toán.
- **Expected Payment State:** Chưa tạo bản ghi thanh toán `payments`.
- **Expected Contract State:** `OFFERED` (Chờ khách hàng chấp thuận).
- **Evidence to Collect:** Snapshot hợp đồng, JSON response từ readiness.
- **Cleanup & Rollback:** Hủy booking, hoàn trả trạng thái kho.

---

### E2E-02: Combo booking nhiều provider
- **Preconditions:**
  - Provider A (Áo dài Huế) và Provider B (Phụ kiện cổ phục) đều kích hoạt `AUTO_ACCEPTANCE`.
  - Khách hàng thêm sản phẩm của cả 2 đối tác vào giỏ.
- **Test Data:**
  - Item 1: Áo dài Nhật Bình (Provider A). Item 2: Trâm cài & Nón ba tầm (Provider B).
  - Không có chiết khấu voucher toàn sàn chưa phân bổ (`UNALLOCATED_BOOKING_FIELDS` = 0).
- **API/UI Steps:**
  1. Tạo đơn booking combo `COMBO` hoặc multi-item.
  2. Chuẩn bị hợp đồng cho cả hai đối tác.
  3. Mở `ContractReviewModal`.
- **Expected DB State:**
  - `digital_contracts`: đúng 2 bản ghi riêng biệt cho Provider A và Provider B.
  - `contract_versions`: 2 bản ghi tương ứng với `providerAcceptanceId` riêng biệt.
- **Expected Payment State:** Chưa thanh toán.
- **Expected Contract State:** Cả 2 hợp đồng đều ở trạng thái `OFFERED`.
- **Evidence to Collect:** 2 contractIds, 2 contentHashes khác nhau.
- **Cleanup & Rollback:** Hủy đơn và xóa scratch data.

---

### E2E-03: Khách ACCEPT tất cả hợp đồng
- **Preconditions:** Đơn hàng 2 providers đang có 2 hợp đồng ở trạng thái `OFFERED`.
- **Test Data:** Token của khách hàng sở hữu đơn hàng.
- **API/UI Steps:**
  1. Khách hàng duyệt qua từng hợp đồng trong `ContractReviewModal`.
  2. Bấm checkbox cam kết và chọn "Đồng ý điều khoản" cho cả 2 hợp đồng.
  3. Modal hiển thị trạng thái "Đã ghi nhận chấp thuận" cho cả 2 đối tác.
  4. Nút "Tiến hành thanh toán" chuyển sang trạng thái khả dụng.
- **Expected DB State:**
  - `contract_consents`: tạo 2 bản ghi với `action: 'ACCEPT'`, lưu kèm `ipAddress`, `userAgent`.
  - `contract_versions`: chuyển `state: 'ACCEPTED'`.
- **Expected Payment State:** Cho phép gọi `POST /payments/create-link`.
- **Expected Contract State:** `ACCEPTED` (Đã ghi nhận chấp thuận).
- **Evidence to Collect:** 2 bản ghi consent trong DB, readiness trả về `allAccepted: true`.
- **Cleanup & Rollback:** Reset consent về null nếu test hủy.

---

### E2E-04: Khách DECLINE một hợp đồng
- **Preconditions:** Đơn hàng đang có hợp đồng chờ chấp thuận.
- **Test Data:** Khách hàng chủ động chọn "Từ chối điều khoản".
- **API/UI Steps:**
  1. Trong `ContractReviewModal`, khách hàng chọn "Từ chối".
  2. Xác nhận hộp thoại cảnh báo: "Từ chối điều khoản sẽ dừng quá trình thanh toán".
- **Expected DB State:**
  - `contract_consents`: ghi nhận `action: 'DECLINE'`.
  - `contract_versions`: chuyển `state: 'DECLINED'`.
- **Expected Payment State:** Gọi `POST /payments/create-link` bị chặn ngay lập tức với lỗi `CONTRACTS_NOT_ACCEPTED`.
- **Expected Contract State:** `DECLINED` (Khách hàng đã từ chối).
- **Evidence to Collect:** HTTP response 400/409 từ create-link, UI toast thông báo dừng checkout.
- **Cleanup & Rollback:** Hủy đơn hàng.

---

### E2E-05: Hợp đồng stale version
- **Preconditions:** Khách hàng đang mở modal xem Version 1 của hợp đồng.
- **Test Data:** Đơn hàng bị điều chỉnh ngày thuê hoặc giá trị (sinh Version 2).
- **API/UI Steps:**
  1. Khách hàng bấm gửi consent với `contentHash` cũ của Version 1.
  2. Backend kiểm tra hash và trả về lỗi `409 Conflict` (`CONTRACT_VERSION_STALE`).
  3. Frontend bắt lỗi 409, hiển thị cảnh báo và tự động tải lại Version 2 mới nhất.
- **Expected DB State:** Không có consent nào được ghi nhận cho Version 1 cũ.
- **Expected Payment State:** Chặn thanh toán.
- **Expected Contract State:** Version 1 giữ nguyên; Version 2 ở trạng thái `OFFERED`.
- **Evidence to Collect:** HTTP 409 Conflict log, UI warning alert.
- **Cleanup & Rollback:** Khôi phục dữ liệu ban đầu.

---

### E2E-06: Booking hold expired
- **Preconditions:** Đơn hàng có `holdExpiresAt` đã quá hạn (thời gian hiện tại > holdExpiresAt).
- **Test Data:** Đơn hàng PENDING_PAYMENT hết hạn 15 phút.
- **API/UI Steps:**
  1. Khách hàng quay lại màn hình checkout sau khi hết hạn.
  2. Gọi `GET /contracts/bookings/:id/readiness`.
- **Expected DB State:** `bookings.holdExpiresAt < now`.
- **Expected Payment State:** `POST /payments/create-link` từ chối với `BOOKING_HOLD_EXPIRED`.
- **Expected Contract State:** Readiness trả về `blockers: ['BOOKING_NOT_PREPARABLE']`.
- **Evidence to Collect:** UI hiển thị modal "Đơn hàng đã hết hạn giữ chỗ" và nút "Quay lại giỏ hàng".
- **Cleanup & Rollback:** Giải phóng kho tồn kho.

---

### E2E-07: Payment sandbox success
- **Preconditions:** Hợp đồng đã ở trạng thái `ACCEPTED`, khách đã tạo payment link.
- **Test Data:** Webhook PayOS gửi payload `status: 'PAID'` kèm chữ ký hợp lệ.
- **API/UI Steps:**
  1. PayOS gửi `POST /payments/webhook/payos` với body chứa `orderCode`, `amount`, `signature`.
  2. Backend xác thực chữ ký bằng `PAYOS_CHECKSUM_KEY`.
  3. `V2PaymentFinalizationService` thực thi giao dịch ACID hoàn tất đơn hàng.
  4. Kích hoạt bất đồng bộ `ContractEvidenceService.generateAndStorePdf`.
- **Expected DB State:**
  - `bookings`: `status: 'PAID'`.
  - `payments`: `status: 'SUCCESS'`.
  - `contract_versions`: `state: 'EFFECTIVE'` hoặc `ACCEPTED`, `document.status: 'READY'`.
- **Expected Payment State:** Tiền vào escrow, ghi nhận doanh thu.
- **Expected Contract State:** Hợp đồng hoàn tất, tài liệu PDF sẵn sàng.
- **Evidence to Collect:** File PDF trong storage, sha256 trong DB.
- **Cleanup & Rollback:** Hoàn tiền sandbox nếu cần.

---

### E2E-08: Payment sandbox failure/cancel
- **Preconditions:** Khách hàng chuyển sang cổng PayOS nhưng bấm "Hủy thanh toán".
- **Test Data:** Webhook PayOS gửi `status: 'CANCELLED'` hoặc user redirect về cancel URL.
- **API/UI Steps:**
  1. Webhook nhận tín hiệu hủy.
  2. Hệ thống cập nhật trạng thái thanh toán.
- **Expected DB State:** `payments.status: 'FAILED'` hoặc `'CANCELLED'`. Đơn hàng giữ nguyên nếu còn hạn giữ chỗ.
- **Expected Payment State:** Không phát sinh chuyển tiền.
- **Expected Contract State:** `contract_versions` vẫn giữ `ACCEPTED` (không chuyển `EFFECTIVE`).
- **Evidence to Collect:** Log webhook cancel, payment cancel state.
- **Cleanup & Rollback:** Đơn hàng tự động hủy khi hết hạn giữ chỗ.

---

### E2E-09: Duplicate webhook
- **Preconditions:** Webhook PayOS `PAID` gửi 2 lần liên tiếp (at-least-once delivery).
- **Test Data:** 2 HTTP requests giống hệt nhau có cùng `orderCode` và chữ ký.
- **API/UI Steps:**
  1. Request 1 gửi tới backend: `claimVerifiedEvent` ghi nhận trạng thái `processing` rồi `processed`.
  2. Request 2 gửi tới backend: `claimVerifiedEvent` phát hiện đã `processed`.
- **Expected DB State:**
  - Chỉ có đúng 1 bản ghi thanh toán được chuyển sang SUCCESS.
  - Số dư escrow và tồn kho chỉ bị trừ 1 lần duy nhất.
- **Expected Payment State:** Không bị nhân đôi số tiền hay giao dịch đối soát.
- **Expected Contract State:** Không sinh 2 file PDF trùng nhau.
- **Evidence to Collect:** Log claim webhook idempotency, count giao dịch escrow = 1.
- **Cleanup & Rollback:** Giữ nguyên trạng thái đơn.

---

### E2E-10: Recovery sau khi worker bị gián đoạn
- **Preconditions:** Quá trình sinh PDF bị crash giữa chừng, version rơi vào trạng thái `status: 'GENERATING'`, lease quá 60 giây.
- **Test Data:** ContractVersion với `document.status: 'GENERATING'`, `leaseExpiresAt: now - 10s`.
- **API/UI Steps:**
  1. Chạy background recovery worker: `ContractEvidenceService.recoverFailedPdfs()`.
  2. Worker phát hiện lease hết hạn, thực hiện atomic CAS claim lại lease.
  3. Tạo lại file PDF và cập nhật `document.status: 'READY'`.
- **Expected DB State:** `document.status: 'READY'`, `storageKey` hợp lệ, `retryCount` tăng 1.
- **Expected Payment State:** Hoàn toàn độc lập, không chạm vào payments/bookings.
- **Expected Contract State:** Tài liệu phục hồi hoàn toàn.
- **Evidence to Collect:** Log recovery worker: `Scanned: 1, Recovered: 1, Failed: 0`.
- **Cleanup & Rollback:** Xóa test file trong storage.

---

### E2E-11: PDF generation READY
- **Preconditions:** Version hợp đồng đã ACCEPT và thanh toán thành công.
- **Test Data:** Thông tin bên thuê, bên cho thuê, danh sách 3 áo dài, bảng chi phí và chính sách.
- **API/UI Steps:**
  1. `ContractPdfGeneratorService` tạo buffer PDF qua PDFKit.
  2. Kiểm tra Unicode tiếng Việt: ă, â, đ, ê, ô, ơ, ư, dấu hỏi ngã nặng.
  3. Kiểm tra bố cục 2 trang chuẩn, không bị nhảy dòng tiêu đề điều khoản.
- **Expected DB State:** `document.status: 'READY'`, lưu trữ tại `contracts/:contractId/v1.pdf`.
- **Expected Payment State:** Không đổi.
- **Expected Contract State:** Metadata chứa `sha256`, `storageKey`, `generatedAt`.
- **Evidence to Collect:** File PDF tải về, render bằng PDF reader kiểm tra trực quan.
- **Cleanup & Rollback:** Xóa tệp sau test.

---

### E2E-12: PDF hash verification
- **Preconditions:** File PDF đã sinh xong và có hash SHA-256 lưu trong DB.
- **Test Data:** File PDF thực tế tải từ private storage.
- **API/UI Steps:**
  1. Client tải tệp và đọc header `X-Contract-SHA256`.
  2. Client tính SHA-256 thực tế trên `Blob.arrayBuffer()` bằng `crypto.subtle.digest`.
  3. So sánh 2 mã băm: phải trùng khớp chính xác 64 ký tự hex.
  4. Thử nghiệm giả lập sửa 1 byte nhị phân: client lập tức ném lỗi `INTEGRITY_MISMATCH` và hủy blob.
- **Expected DB State:** Hash trong DB khớp byte stream.
- **Expected Payment State:** Không đổi.
- **Expected Contract State:** Toàn vẹn dữ liệu được chứng minh toán học.
- **Evidence to Collect:** Bảng đối chiếu sha256 gốc và sha256 tính toán.
- **Cleanup & Rollback:** Không cần rollback.

---

### E2E-13: Customer download PDF
- **Preconditions:** Khách hàng sở hữu đơn hàng đã thanh toán và tài liệu READY.
- **Test Data:** JWT của khách hàng.
- **API/UI Steps:**
  1. Khách hàng vào `ProfilePage` -> tab "Hợp đồng điện tử".
  2. Bấm "Tải bản PDF".
  3. Trình duyệt tải tệp `DC-XXXX-v1.pdf`.
- **Expected DB State:** Không thay đổi dữ liệu.
- **Expected Payment State:** Không đổi.
- **Expected Contract State:** Giữ nguyên.
- **Evidence to Collect:** File PDF mở được trên thiết bị của khách hàng, toast "Tải file thành công".
- **Cleanup & Rollback:** Không cần.

---

### E2E-14: Provider isolation
- **Preconditions:** Booking có Provider A và Provider B.
- **Test Data:** JWT của Provider A và Provider B.
- **API/UI Steps:**
  1. Provider A gọi `GET /contracts/bookings/:id`: chỉ nhận mảng 1 phần tử (hợp đồng A).
  2. Provider A cố tình gọi `GET /contracts/:contractB_Id`: nhận `404 Not Found`.
  3. Provider A cố tình gọi `GET /contracts/:contractB_Id/pdf`: nhận `404 Not Found`.
- **Expected DB State:** Không rò rỉ dữ liệu của Provider B.
- **Expected Payment State:** Không đổi.
- **Expected Contract State:** Giữ nguyên.
- **Evidence to Collect:** HTTP response 404 cho mọi hành vi IDOR.
- **Cleanup & Rollback:** Không cần.

---

### E2E-15: Legacy checkout regression
- **Preconditions:** Đơn hàng cũ có `contractFlowVersion: 1` hoặc `status: 'PENDING_PAYMENT'`.
- **Test Data:** Đơn hàng thuê áo dài kiểu cũ.
- **API/UI Steps:**
  1. Khách hàng mở modal thanh toán `BookingCheckoutModal`.
  2. Hệ thống kiểm tra readiness: trả về `requirement: 'NOT_REQUIRED'`, blockers: `['LEGACY_BOOKING']`.
  3. Bỏ qua hoàn toàn modal xem hợp đồng; tiếp tục gọi thẳng `create-link`.
- **Expected DB State:** Không tạo bản ghi `digital_contracts` V2 nào.
- **Expected Payment State:** Thanh toán bình thường theo luồng V1.
- **Expected Contract State:** V1 legacy không bị ảnh hưởng.
- **Evidence to Collect:** Payment link tạo thành công không có `contractBinding`.
- **Cleanup & Rollback:** Hủy đơn sau test.

---

### E2E-16: Photography-only regression
- **Preconditions:** Đơn hàng chỉ đặt dịch vụ chụp ảnh (`bookingType: 'PHOTOGRAPHY'`).
- **Test Data:** Dịch vụ chụp ngoại cảnh Huế với Photographer C.
- **API/UI Steps:**
  1. Khách hàng tiến hành checkout từ trang chi tiết Photographer hoặc Cart.
  2. Hệ thống gọi readiness: trả về `requirement: 'NOT_REQUIRED'`.
  3. Chuyển thẳng sang bước chọn phương thức thanh toán hoặc đặt cọc.
- **Expected DB State:** 0 bản ghi `digital_contracts` sinh ra.
- **Expected Payment State:** Thanh toán tiền cọc chụp ảnh thành công.
- **Expected Contract State:** Không có hợp đồng thuê áo dài nào được tạo.
- **Evidence to Collect:** HTTP response readiness `requirement: 'NOT_REQUIRED'`, flow thanh toán mượt mà.
- **Cleanup & Rollback:** Hủy lịch chụp test.

---

### E2E-17: Frontend/backend feature flag mismatch
- **Preconditions:** Thiết lập lệch cờ:
  - Trường hợp 1: Frontend `VITE_CONTRACTS_V2_ENABLED=true`, Backend `CONTRACTS_V2_ENABLED=false`.
  - Trường hợp 2: Frontend `VITE_CONTRACTS_V2_ENABLED=false`, Backend `CONTRACTS_V2_ENABLED=true`.
- **Test Data:** Đơn hàng thuê áo dài mới.
- **API/UI Steps:**
  - *TH1:* Frontend mở modal review -> Backend readiness trả về `blockers: ['FEATURE_DISABLED']`. Frontend hiển thị fallback thông báo tính năng đang bảo trì, không tự động kích hoạt tạo link.
  - *TH2:* Frontend bỏ qua modal review -> Gọi thẳng `create-link`. Backend checkout guard chặn lại với lỗi `CONTRACTS_NOT_ACCEPTED` (fail-closed).
- **Expected DB State:** Không có hợp đồng giả mạo hoặc đơn hàng bypass được kiểm soát.
- **Expected Payment State:** Không phát sinh thanh toán sai quy trình.
- **Expected Contract State:** Bảo vệ tuyệt đối nguyên tắc Fail-Closed.
- **Evidence to Collect:** UI fallback screen, Backend guard rejection log.
- **Cleanup & Rollback:** Trả lại cờ tính năng về mặc định `false`.
