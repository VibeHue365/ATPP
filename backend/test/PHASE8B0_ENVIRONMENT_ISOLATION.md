# VIBEHUE — PHASE 8B.0: ENVIRONMENT ISOLATION AUDIT & PROOF

**Document Version:** 1.0.0  
**Phase:** 8B.0 — Isolated Synthetic E2E Safety Gate  
**Branch:** `feat/electronic-contracts`  
**Date:** 29/10/2026  
**Auditor:** Antigravity AI Quality Gate  

---

## 1. Bằng chứng Cô lập Cơ sở Dữ liệu (Database Isolation Proof)

### 1.1 Trạng thái MongoDB Test Replica Set
- **Cấu hình Docker Compose:** `backend/test/contract-mongo.compose.yml`
- **Container đang chạy:** `vibehue-contract-test-contract-mongo-1`
- **Network Interface:** `127.0.0.1:27028 -> 27017/tcp` (Chỉ lắng nghe trên loopback cục bộ của host, không có route public).
- **Replica Set Name:** `rsContractTest`
- **Trạng thái cụm (Runtime Health):**
  ```json
  {
    "setName": "rsContractTest",
    "state": 1,
    "members": [{ "name": "localhost:27017", "stateStr": "PRIMARY" }]
  }
  ```
  *(Xác nhận trạng thái `PRIMARY` hoạt động đầy đủ tính năng ACID multi-document transactions).*

### 1.2 Cơ chế Scratch Database Độc lập Từng Lượt Chạy
- **Mã nguồn Hard Gate:** `backend/src/modules/contracts/contract-test-target.ts`
- **Quy tắc phân vùng:**
  1. Connection string bắt buộc phải chứa `127.0.0.1:27028` và `replicaSet=rsContractTest`. Mọi connection string khác (bao gồm Atlas hay port 27017) đều kích hoạt ngoại lệ `throw new Error(...)` ngay tại bước nạp cấu hình.
  2. Mỗi test suite tự động khởi tạo một scratch database ngẫu nhiên theo mẫu:
     `contract_synthetic_<random_hex>_test`
  3. Khối `afterAll` bắt buộc gọi `connection.dropDatabase()` để dọn dẹp sạch sẽ toàn bộ collections, indexes, và dữ liệu phát sinh sau khi hoàn thành.
  4. **Tuyệt đối không sử dụng MongoDB Atlas (`vibehue_db`)** làm database cho bất kỳ test case nào thuộc Phase 8B.

---

## 2. Cô lập Hệ thống Lưu trữ & Bộ đệm (Storage & Cache Isolation)

### 2.1 Private Object Storage (Hợp đồng PDF & Bằng chứng Điện tử)
- **Hạ tầng kiểm thử:**
  - Container `vibehue-minio` (Local Docker port 9000-9001) với bucket thử nghiệm riêng biệt `contract-test-documents`.
  - Hoặc in-memory byte map (`Map<string, Buffer>`) mô phỏng `PrivateStorageService` (như đã áp dụng thành công trong `phase6-contract-pdf.integration.spec.ts`).
- **Ngăn chặn rò rỉ:** Tuyệt đối không trỏ tới AWS S3, Cloudflare R2 hay GridFS trên MongoDB Atlas production.

### 2.2 Redis Cache & Distributed Lock
- **Hạ tầng kiểm thử:** Container `vibehue-redis` (port 6379 cục bộ).
- **Quy chuẩn Namespace:** Mọi key phân tán dùng cho booking hold, rate-limit hay session trong test harness đều phải gắn tiền tố định danh: `test:contract:*`.
- **Dọn dẹp:** FLUSH key theo tiền tố sau mỗi kịch bản test để tránh lưu giữ state rác.

### 2.3 Background Recovery Worker
- **Cơ chế phục hồi PDF:** `ContractEvidenceService.recoverFailedPdfs` chỉ quét các version trong scratch database của lượt test hiện tại.
- **Cơ chế phục hồi thanh toán:** `PaymentRecoveryService.processPendingRecoveries` chỉ thao tác trên collection `payment_recoveries` cục bộ; không có worker nào được phép kết nối hàng đợi RabbitMQ/Kafka/BullMQ bên ngoài.

---

## 3. Cô lập Cổng Thanh toán & Webhook (Payment & Webhook Isolation)

### 3.1 Không gọi Cổng PayOS Thật
- **Mã nguồn tạo thanh toán:** `PaymentsService.createPayment` / `createV2PaymentIntent`
  - Đặt cứng phương thức thanh toán: `paymentMethod: 'PAYOS_SIMULATOR'`.
  - Sinh mã thanh toán giả lập nội bộ: `orderCode = Math.floor(100000 + Math.random() * 900000)`.
  - URL thanh toán trả về: `http://localhost:5173/checkout/result?paymentCode=...`.
  - **Không có bất kỳ HTTP request nào được gửi tới PayOS API** (`https://api.payos.vn`).

### 3.2 Dịch vụ Hoàn tiền (`PayOSRefundService`)
- Tại dòng 41-44 của `payos-refund.service.ts`:
  ```typescript
  const isMock =
    this.configService.get<string>('PAYOS_REFUND_MOCK') === 'true' ||
    ((!this.payOSClientId || this.payOSClientId.includes('your_')) && nodeEnv !== 'production');
  ```
- Vì biến `PAYOS_CLIENT_ID` trong môi trường test/staging không được cấu hình, dịch vụ tự động kích hoạt chế độ **MOCK 100%**, hoàn trả `{ status: 'REFUNDED_MOCK' }` mà không gửi request ra ngoài.

### 3.3 Webhook Simulator Nội bộ
- Webhook PayOS `PAID` / `CANCELLED` trong synthetic E2E được phát trực tiếp qua `supertest` tới endpoint HTTP nội bộ của ứng dụng test:
  `POST /payments/webhook/payos`
- Chữ ký HMAC-SHA256 được tính toán bằng key test cục bộ (`PAYOS_CHECKSUM_KEY = 'test-payos-checksum-secret-64-hex'`).
- Không có webhook nào được gửi qua mạng internet công cộng hay qua các dịch vụ tunnel ngoài.

---

## 4. Bảng Đối chiếu Ranh giới Môi trường (Boundary Reconciliation)

| Thành phần kỹ thuật | Môi trường Ứng dụng / Production | Môi trường Synthetic E2E Harness | Cơ chế Ngăn chặn Ghi nhầm (Safety Guard) |
| :--- | :--- | :--- | :--- |
| **MongoDB Host** | Atlas Cloud (`cluster0...`) | `127.0.0.1:27028` (Local Docker) | `contractTestTarget()` ném Exception nếu sai host/port |
| **Database Name** | `vibehue_db` | `contract_synthetic_<hex>_test` | Hard-check đuôi `_test` và tiền tố `contract` |
| **Replica Set** | Atlas Replica Cluster | `rsContractTest` | Kiểm tra lệnh `adminCommand({ hello: 1 }).setName` |
| **Storage Engine** | GridFS on Atlas Cloud | Test MinIO / In-Memory Map | Memory isolation; không có credentials cloud |
| **PayOS Gateway** | Live PayOS Production | `PAYOS_SIMULATOR` nội bộ | Không có API Key thật; `paymentMethod` cố định SIMULATOR |
| **PayOS Webhook** | Public Internet Callback | Local `supertest` HTTP injection | Chữ ký ký bằng mock secret nội bộ |
| **Feature Flags** | `false` (Bất hoạt mặc định) | `true` (Override trong process test) | Không sửa `.env`; biến chỉ tồn tại trong bộ nhớ Jest worker |

---

## 5. Tuyên bố Bảo mật & Không Rò rỉ Dữ liệu Nhạy cảm
- Báo cáo này đã loại bỏ hoàn toàn các chuỗi ký tự mật khẩu, private key, token xác thực.
- Tất cả connection string trong tài liệu đều sử dụng chuỗi mẫu loopback `127.0.0.1` với mục đích kiểm toán an ninh kỹ thuật.
