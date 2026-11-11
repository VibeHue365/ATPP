# VIBEHUE — PHASE 8B.0: SAFETY GATE EVALUATION & GO/NO-GO REPORT

**Document Version:** 1.0.0  
**Phase:** 8B.0 — Isolated Synthetic E2E Safety Gate  
**Branch:** `feat/electronic-contracts`  
**Date:** 29/10/2026  
**Auditor:** Antigravity AI Quality Gate  

---

## 1. Tóm tắt Bằng chứng An toàn & Cô lập Môi trường (Safety & Isolation Proof Summary)

### 1.1 Cơ chế Bảo vệ Đa tầng (Multi-layered Protection)
1. **Lớp Cơ sở Dữ liệu (Database Layer):**
   - Bộ lọc `contractTestTarget()` hoạt động như một cầu chì ngắt mạch (Circuit Breaker): ném ngoại lệ ngay lập tức nếu connection string không thuộc `127.0.0.1:27028` với `replicaSet=rsContractTest` và tên database không chứa `contract` kết thúc bằng `_test`.
   - Mỗi lần chạy tự động sinh một scratch database ngẫu nhiên `contract_synthetic_<hex>_test` và gọi `connection.dropDatabase()` trong khối `afterAll`.
   - **Cam kết:** Database Atlas production `vibehue_db` không bị kết nối hay ghi bất kỳ dữ liệu nào.
2. **Lớp Thanh toán & Webhook (Payment Layer):**
   - Hệ thống không chứa bất kỳ secret hay API key thật nào của PayOS.
   - `PaymentsService` mặc định sử dụng `paymentMethod: 'PAYOS_SIMULATOR'`.
   - `PayOSRefundService` tự động kích hoạt `isMock = true`.
   - Webhook harness ký và phát trực tiếp vào controller qua `supertest` cục bộ; không có kết nối ra internet.
3. **Lớp Cờ Tính năng (Feature Flag Layer):**
   - `backend/.env` và `frontend/.env` giữ nguyên `CONTRACTS_V2_ENABLED=false` và `VITE_CONTRACTS_V2_ENABLED=false`.
   - Việc bật cờ tính năng chỉ diễn ra bên trong không gian bộ nhớ của tiến trình Jest worker bằng kỹ thuật NestJS DI Override.
4. **Lớp Điều khoản Pháp lý (Legal Template Layer):**
   - Giữ nguyên trạng thái `DRAFT` của `AO_DAI_RENTAL_V1` và `AUTO_ACCEPTANCE_MECHANISM_V1` trong mã nguồn sản xuất.
   - Mẫu điều khoản thử nghiệm `SYNTHETIC_APPROVED_TEMPLATE` được tiêm qua Test Seam độc lập và được định danh rõ ràng là "Synthetic Test Only".

---

## 2. Đánh giá Rủi ro Ghi nhầm (Risk Assessment Matrix)

| Danh mục rủi ro | Xác suất xảy ra | Mức độ ảnh hưởng | Biện pháp kiểm soát & Bằng chứng thực tế |
| :--- | :---: | :---: | :--- |
| **Ghi nhầm vào MongoDB Atlas (`vibehue_db`)** | **0% (Không thể xảy ra)** | Nghiêm trọng | Hard-gate `contractTestTarget()` ném Exception nếu port khác 27028 hoặc host khác 127.0.0.1. |
| **Phát sinh giao dịch tiền thật trên PayOS** | **0% (Không thể xảy ra)** | Nghiêm trọng | Không có `PAYOS_API_KEY` trong môi trường; phương thức thanh toán cố định `PAYOS_SIMULATOR`. |
| **Bypass cờ tính năng trên môi trường live** | **0% (Không thể xảy ra)** | Nghiêm trọng | Không sửa đổi `.env`; cờ chỉ được override tạm thời trong bộ nhớ của tiến trình chạy test. |
| **Mạo nhận văn bản pháp lý đã được duyệt** | **0% (Không thể xảy ra)** | Cao | Giữ nguyên `status: 'DRAFT'` trong mã nguồn; fixture test được gắn nhãn synthetic. |
| **Lưu rác dữ liệu test trong storage** | **Thấp (< 1%)** | Thấp | Khối `afterAll` tự động dọn dẹp scratch database và memory storage buffer. |

---

## 3. Các Phụ thuộc Còn thiếu (Missing Dependencies)
1. **PayOS Sandbox Credentials:** Chưa có Client ID và API Key dành cho môi trường PayOS Sandbox thật (sẽ cấu hình ở Phase sau khi triển khai staging live).
2. **Public Webhook Tunnel:** Chưa có webhook domain ngoài để nhận callback từ PayOS Cloud thật.
3. **Phê duyệt Pháp lý Chính thức:** Cần văn bản duyệt chính thức cho 6 rào cản đã nêu tại `PHASE8_BLOCKERS.md` trước khi bàn giao cho người dùng cuối.

---

## 4. Danh sách File Dự kiến Thay đổi trong Phase 8B.1
*(Tuyệt đối không sửa đổi mã nguồn sản phẩm backend hay frontend)*:
1. `backend/src/modules/contracts/tests/fixtures/synthetic-contract.fixture.ts` (Tạo mới: chứa synthetic template, mechanism và webhook signer).
2. `backend/src/modules/contracts/tests/contract-synthetic-e2e.spec.ts` (Tạo mới: chứa các bài test tự động cho 17 kịch bản E2E).

---

## 5. Quyết nghị GO / NO-GO

### 🟢 **RECOMMENDED: GO CHO PHASE 8B.1 (SYNTHETIC E2E ON ISOLATED TEST HARNESS)**
**Căn cứ:**
- Môi trường kiểm thử cô lập đã được chứng minh 100% an toàn về mặt kiến trúc.
- Test harness cho phép chạy khép kín các kịch bản kiểm thử E2E nhằm chứng minh độ hoàn thiện kỹ thuật mà không vi phạm bất kỳ giới hạn nào của dự án.
- Không có bất kỳ rủi ro nào đối với dữ liệu sản xuất, tiền tệ hoặc trạng thái cờ tính năng của ứng dụng.

### 🔴 **STRICTLY: NO-GO CHO PRODUCTION HOẶC LIVE STAGING VỚI NGƯỜI DÙNG THẬT**
**Căn cứ:**
- Phải duy trì trạng thái đóng cổng (Fail-Closed) cho đến khi toàn bộ 6 rào cản tại `PHASE8_BLOCKERS.md` được Ban Giám đốc và Cố vấn Pháp lý phê duyệt bằng văn bản.
