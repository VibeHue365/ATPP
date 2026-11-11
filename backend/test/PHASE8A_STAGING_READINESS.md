# VIBEHUE — PHASE 8A: STAGING READINESS & TEST EVIDENCE RECONCILIATION

**Document Version:** 1.0.0  
**Phase:** 8A — Staging Readiness & End-to-End Test Planning  
**Branch:** `feat/electronic-contracts`  
**Date:** 29/10/2026  
**Auditor:** Antigravity AI & VibeHue Technical Quality Gate  

---

## 1. Đối chiếu Chứng cứ Kiểm thử Phase 7B.3 (Phase 7B.3 Reconciliation)

Trong Phase 7B.3, báo cáo tóm tắt đã liệt kê **13 kịch bản nghiệp vụ** và ghi nhận test suite `backend/src/modules/contracts/contract-http.integration.spec.ts` đạt **7/7 Jest tests PASS**. Nhằm đảm bảo tính minh bạch tuyệt đối và tránh gộp test coverage giữa các tầng, bảng dưới đây phân rã chi tiết 7 Jest tests thực tế, các HTTP requests được thực thi, và ranh giới chứng minh giữa các test suites.

### 1.1 Chi tiết 7 Jest Test Cases trong `contract-http.integration.spec.ts`

| STT | Tên chính xác của Jest Test Case | HTTP Endpoint, Method & Actor | HTTP Status thực tế | Assertion & Payload chi tiết |
| :---: | :--- | :--- | :---: | :--- |
| **1** | `enforces customer/provider/admin isolation through the real JWT guard` | `GET /contracts/bookings/:id` (Anonymous) | **401** | `expect(401)` do `JwtAuthGuard` |
| | | `GET /contracts/bookings/:id` (Invalid Token) | **401** | `expect(401)` do `JwtStrategy` |
| | | `GET /contracts/bookings/:id` (Expired Token) | **401** | `expect(401)` do token hết hạn |
| | | `GET /contracts/bookings/:id` (Customer A) | **200** | `expect(own.body).toHaveLength(2)` (thấy đủ 2 hợp đồng của 2 providers) |
| | | `GET /contracts/bookings/:id` (Customer B) | **404** | `expect(404)` anti-enumeration (`CONTRACT_NOT_FOUND`) |
| | | `GET /contracts/bookings/:id` (Provider 0) | **200** | `expect(provider.body).toHaveLength(1)` (chỉ thấy hợp đồng của chính mình) |
| | | `GET /contracts/:contractB_Id` (Provider 0) | **404** | `expect(404)` khi Provider 0 đọc thẳng ID của Provider 1 |
| | | `GET /contracts/bookings/:id` (Admin hợp lệ) | **200** | `expect(admin.body).toHaveLength(2)` (Admin có `user:read` + `provider:read`) |
| | | `GET /contracts/bookings/:id` (Admin thiếu quyền)| **404** | `expect(404)` khi Admin thiếu `provider:read` |
| **2** | `does not log credentials from URL, User-Agent or client request ID` | `GET /contracts/bookings/:id?access_token=...` | **200** | Kiểm tra `requestLogs`: không rò rỉ token, bearer header hay User-Agent marker |
| **3** | `rejects forged actor/role, stale hash or fingerprint, and another customer` | `POST /contracts/:id/consents` (Customer B) | **404** | `expect(404)` Customer B không sở hữu hợp đồng |
| | | `POST /contracts/:id/consents` (Forged actorId) | **400** | `expect(400)` ValidationPipe chặn payload gian lận |
| | | `POST /contracts/:id/consents` (Stale contentHash)| **409** | `expect(409)` Conflict khi hash điều khoản không khớp DB |
| | | `POST /contracts/:id/consents` (Stale fingerprint)| **409** | `expect(409)` Conflict khi fingerprint đơn hàng thay đổi |
| | | `POST /contracts/:id/consents` (Forged versionId)| **409** | `expect(409)` Conflict khi versionId không thuộc contract |
| **4** | `persists one consent for same-key retries and concurrent opposite requests` | `POST /contracts/:id/consents` (Idempotent Retry) | **201** | Trả về cùng `consentId` ban đầu |
| | | `POST /contracts/:id/consents` (New key sau khi đã ghi nhận) | **409** | `expect(409)` không cho phép tạo consent thứ 2 |
| | | `POST /contracts/:id/consents` (DECLINE sau ACCEPT)| **409** | `expect(409)` không cho phép đảo ngược quyết định |
| | | `Promise.all([POST ACCEPT, POST DECLINE])` | **[201, 409]**| MongoDB transaction serialized: đúng 1 consent được lưu |
| **5** | `5. streams contract PDF and returns immutable evidence with authorization enforcement` | `GET /contracts/:id/pdf` (Customer A) | **200** | Header `application/pdf`, `X-Contract-SHA256`, buffer `%PDF-1.4` |
| | | `GET /contracts/:id/pdf` (Customer B) | **404** | `expect(404)` Customer B bị chặn tải PDF của Customer A |
| | | `GET /contracts/:id/pdf` (Provider 0) | **200** | Header `application/pdf`, cho phép Provider tải PDF của mình |
| | | `GET /contracts/:id/pdf` (Other Provider) | **404** | `expect(404)` Provider khác bị chặn tải PDF |
| | | `GET /contracts/:id/pdf` (Admin) | **200** | Admin đủ quyền tải được PDF |
| | | `GET /contracts/:id/versions/:otherVer/pdf` (IDOR)| **404** | Version không thuộc contract bị từ chối 404 |
| | | `GET /contracts/:id/evidence` (Customer A) | **200** | Trả về `integrityVerified: true`, `documentStatus: 'READY'`, `pdfSha256` |
| **6** | `6. blocks PDF download with 422 Unprocessable Entity when document is not ready` | `GET /contracts/:id/pdf` (Pending/Generating Doc)| **422** | `expect(422)` body: `{ message: 'CONTRACT_PDF_NOT_READY' }` |
| **7** | `7. returns FEATURE_DISABLED blocker when CONTRACTS_V2_ENABLED is false and operates properly when enabled` | `GET /contracts/bookings/:id/readiness` (Flag OFF) | **200** | Trả về `blockers: ['FEATURE_DISABLED']` |
| | | `GET /contracts/bookings/:id/readiness` (Flag ON) | **200** | Trả về `requirement: 'REQUIRED'`, `blockers: []` |

### 1.2 Bảng phân định nguồn chứng minh (Source Suite Mapping)

Toàn bộ 13 kịch bản báo cáo ở Phase 7B.3 đều **thực sự được chạy và assert trực tiếp** thông qua 7 Jest test cases trên. Không có kịch bản nào chỉ giả định hoặc gộp số liệu:
- **Kịch bản 1, 2, 7, 8:** Được chạy trong Test Case 1.
- **Kịch bản 3, 11, 12:** Được chạy trong Test Case 3.
- **Kịch bản 13:** Được chạy trong Test Case 4.
- **Kịch bản 4, 5, 6:** Được chạy trong Test Case 1 và Test Case 5.
- **Kịch bản 9:** Được chạy trong Test Case 6.
- **Kịch bản 10:** Được chạy trong Test Case 7.

*Ghi chú về các test suites bổ trợ:*
- Việc lưu trữ nhị phân PDF thực tế trên MinIO/GridFS và tính toán cryptographic SHA-256 từ byte stream được chứng minh độc lập bởi: `backend/src/modules/contracts/tests/phase6-contract-pdf.integration.spec.ts` (9/9 PASS).
- 13 unit test cases cấp Service/Controller được chứng minh bởi: `backend/src/modules/contracts/tests/contract-authorization-idor.spec.ts` (13/13 PASS).

---

## 2. Kiểm toán Môi trường Staging (Staging Environment Audit)

Mỗi thành phần hệ thống được phân loại theo 4 trạng thái chuẩn hóa:
- **`REAL STAGING`**: Đã kết nối hạ tầng thực tế của môi trường Staging/Dev.
- **`ISOLATED TEST`**: Chạy trên hạ tầng cô lập phục vụ kiểm thử tự động (Docker local replica set, scratch DB).
- **`MOCK`**: Sử dụng simulator, stub hoặc in-memory provider.
- **`NOT CONFIGURED`**: Chưa được cấu hình hoặc thiếu biến môi trường bắt buộc.

*(Lưu ý an toàn: Báo cáo tuyệt đối không hiển thị secret, password hay API key thực tế)*.

| Thành phần kiểm toán | Trạng thái kỹ thuật | Bằng chứng & Phân tích hiện trạng | Rủi ro / Lưu ý cho Staging |
| :--- | :---: | :--- | :--- |
| **Frontend Config (`frontend/.env`)** | `NOT CONFIGURED` | `VITE_API_BASE_URL=http://localhost:3000`. Chưa có file `.env.staging` cho domain staging. | Cần tạo file cấu hình staging cho frontend build. |
| **Backend Config (`backend/.env`)** | `REAL STAGING` | Chứa cấu hình cổng `PORT=3000`, chính sách `POLICY_ACTIVATION_MODE=COMPENSATION`. | Cần rà soát các biến đặc thù môi trường staging. |
| **MongoDB Test / Replica Set** | `ISOLATED TEST` | Container `vibehue-contract-test-contract-mongo-1` trên port `27028`, replica set `rsContractTest` (Primary). | Sẵn sàng cho automated integration tests. |
| **MongoDB Staging Database** | `REAL STAGING` | Kết nối Atlas Cloud cluster (`cluster0...`). Chưa thực hiện index migration Contracts V2. | Cần kế hoạch dry-run migration trước khi bật cờ. |
| **Private Object Storage (PDF)** | `REAL STAGING` & `ISOLATED TEST` | `PRIVATE_STORAGE_PROVIDER=gridfs` (dùng GridFS trên MongoDB) hoặc `vibehue-minio` container (port 9000-9001). | GridFS hoạt động không cần hạ tầng S3 ngoài; MinIO sẵn sàng cho S3 API. |
| **PayOS Sandbox Credentials** | `NOT CONFIGURED` | Các biến `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` chưa có trong `backend/.env`. | Cần đăng ký tài khoản PayOS Sandbox và nạp credentials vào staging. |
| **PayOS Payment Simulator** | `MOCK` | Endpoint `/payments/payos-simulator` và controller mock sẵn sàng cho test nội bộ. | Simulator chỉ dùng cho dev/isolated test, không dùng cho staging E2E thật. |
| **Webhook Callback Environment** | `NOT CONFIGURED` | Chưa có public domain / tunnel (ngrok) để PayOS Sandbox gọi webhook thật về `POST /payments/webhook/payos`. | Cần cấu hình reverse proxy / webhook URL trên PayOS Dashboard. |
| **Contract Feature Flag (Backend)** | `ISOLATED TEST` | `CONTRACTS_V2_ENABLED` mặc định `false` (fail-closed). | Phải giữ `false` cho đến khi hoàn thành E2E và duyệt blockers. |
| **Contract Feature Flag (Frontend)** | `ISOLATED TEST` | `VITE_CONTRACTS_V2_ENABLED` mặc định `false`. | Đồng bộ với backend flag. |
| **Booking Hold / Redis Lock** | `REAL STAGING` | Container `vibehue-redis` hoạt động trên port 6379, quản lý khóa phân tán hold 15 phút. | Đã sẵn sàng cho nghiệp vụ giữ chỗ và timeout. |
| **Contract Preparation & Readiness** | `ISOLATED TEST` | Mã nguồn hoàn thiện, nhưng bị chặn bởi Template DRAFT (xem Mục 4). | Sẵn sàng về mặt logic code, chờ dữ liệu pháp lý. |
| **PDF Generation Engine** | `ISOLATED TEST` | Engine PDFKit hỗ trợ đầy đủ Unicode Noto Sans, tiếng Việt diacritics, phân trang tự động. | Hoạt động tốt trong môi trường Node.js. |
| **Background Recovery Worker** | `REAL STAGING` & `ISOLATED TEST` | `recoverFailedPdfs` (CAS lease 60s) và `PaymentRecoveryService` đã sẵn sàng. | Worker tự động phục hồi PDF hỏng mà không tác động tới thanh toán. |

---

## 3. Khuyến nghị GO / NO-GO cho Phase 8B

### **QUYẾT NGHỊ CHÍNH THỨC: NO-GO CHO STAGING GIAO DỊCH THẬT / PRODUCTION**
### **ĐIỀU KIỆN CHO PHÉP: CONDITIONAL GO CHO TEST TỰ ĐỘNG KHÉP KÍN (SYNTHETIC RUN)**

**Lý do NO-GO:**
1. **Thiếu PayOS Sandbox Credentials:** Chưa có webhook URL thực tế và checksum key; giao dịch thanh toán thật trên staging chưa thể thông suốt.
2. **Business / Legal Blockers cấp P0:** Mẫu hợp đồng `AO_DAI_RENTAL_V1` và cơ chế `AUTO_ACCEPTANCE_MECHANISM_V1` trong code đang ở trạng thái `DRAFT` và chưa có văn bản phê duyệt pháp lý chính thức.
3. **Database Migration:** Database Atlas staging chưa được chạy dry-run migration và chưa đánh các chỉ mục duy nhất (`digital_contracts`, `contract_consents`).

**Điều kiện chuyển sang Phase 8B (Dry-Run / Synthetic Staging Execution):**
- Chỉ chạy trong môi trường kiểm thử tự động với Mock PayOS Webhook và Mock Template APPROVED độc lập.
- Không ghi vào DB chính của người dùng.
- Giữ nguyên `CONTRACTS_V2_ENABLED=false` trên ứng dụng.
