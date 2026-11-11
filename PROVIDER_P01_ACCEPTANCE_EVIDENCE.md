# BẰNG CHỨNG KIỂM THỬ TÍCH HỢP P0.1 (PROVIDER P0.1 ACCEPTANCE EVIDENCE)
## XÁC MINH TRÊN MONGODB REPLICA SET CÔ LẬP (PORT 27028 — `rsContractTest`)

---

## 1. Môi trường Thực thi & Cơ chế Scratch Database

- **Cụm cơ sở dữ liệu:** Docker Container `vibehue-contract-test-contract-mongo-1`
- **Địa chỉ:** `127.0.0.1:27028`
- **Replica Set:** `rsContractTest` (Trạng thái: `PRIMARY` có đầy đủ ACID Multi-document Transactions)
- **Tên Scratch Database kiểm thử:** `contract_p01_<randomHex>_test`
- **Quy tắc an toàn:**
  - Khởi tạo scratch DB tự động trước khi chạy test suite.
  - Thiết lập đầy đủ các chỉ mục duy nhất (`unique indexes`) bắt buộc:
    - `{ bookingId: 1, providerId: 1, scope: 1 }` trên `digital_contracts`
    - `{ contractId: 1, version: 1 }` trên `contract_versions`
    - `{ contractVersionId: 1, actorUserId: 1 }` trên `contract_consents`
    - `{ providerId: 1, scope: 1 }` với `{ status: 'ACTIVE' }` trên `provider_contract_acceptances`
  - Khối `afterAll` tự động gọi `connection.dropDatabase()` dọn dẹp sạch sẽ 100% dữ liệu sau khi hoàn tất.
  - Tuyệt đối không kết nối, không đọc và không ghi lên MongoDB Atlas production.

---

## 2. Bằng chứng Thực thi 10 Kịch bản Kiểm thử Tích hợp MongoDB

| STT | Kịch bản kiểm thử | Hành vi hệ thống & Bằng chứng DB thực tế | Kết quả |
| :-: | :--- | :--- | :-: |
| **1 & 2** | Provider thiếu acceptance -> readiness fail-closed & DB không có bản ghi mới | Khách gọi `readiness()`, backend ném `PROVIDER_AUTO_ACCEPTANCE_MISSING`. Truy vấn DB thực tế: `countDocuments({ providerId }) === 0`. Không có bản ghi nào bị tạo lén. | **PASS** |
| **3** | Provider có acceptance hợp lệ qua đường xác thực -> prepare thành công | Provider gọi `approval.accept(user, hash)`. DB ghi nhận document `ACTIVE` với `acceptedByUserId` và `policyFingerprint`. Khách gọi `prepare()` thành công tạo Version 1 `Offered` gắn đúng `providerAcceptanceId`. | **PASS** |
| **4** | Sửa đổi policy -> hệ thống báo stale, DB không tự cập nhật | Cập nhật trực tiếp policy trong collection `providers`. Gọi `prepare()` ném lỗi `PROVIDER_POLICY_ACCEPTANCE_STALE`. Bản ghi acceptance trên DB giữ nguyên fingerprint cũ, không bị ghi đè. | **PASS** |
| **5** | Revoke -> Chặn booking mới | Provider gọi `approval.revoke(user)`. Trạng thái trên DB chuyển thành `REVOKED`. Lượt gọi `prepare()` tiếp theo lập tức ném `PROVIDER_AUTO_ACCEPTANCE_MISSING`. | **PASS** |
| **6** | User khác không thể chấp thuận thay shop | User B gọi `accept()` thay cho shop A. Hệ thống ném `PROVIDER_NOT_FOUND`. Truy vấn DB: `countDocuments({ acceptedByUserId: imposterId }) === 0`. | **PASS** |
| **7** | Yêu cầu đồng thời (Concurrent requests) không sinh duplicate ACTIVE | Chạy đồng thời 5 request `accept()` song song. Nhờ Partial Unique Index trên MongoDB, chỉ 1 bản ghi `ACTIVE` tồn tại duy nhất: `countDocuments({ providerId, status: 'ACTIVE' }) === 1`. | **PASS** |
| **8** | Đơn hàng nhiều shop: 1 shop thiếu acceptance -> chặn checkout | Booking gồm Shop A và Shop B. Shop A đã có hợp đồng chấp thuận, Shop B chưa có. Gọi `guard.evaluate()` lập tức bị chặn ném lỗi, không thể thanh toán. | **PASS** |
| **9** | Tắt Feature Flag -> Đơn hàng legacy không bị ảnh hưởng | Với đơn hàng `contractFlowVersion: 1` hoặc khi tắt cờ V2, `guard.evaluate()` trả về `{ binding: null, context: null }`, checkout diễn ra bình thường. | **PASS** |
| **10** | ContractVersion ACCEPTED bảo toàn snapshot và contentHash | Khách chấp thuận Version 1 (`state: Accepted`). Sau đó cập nhật chi tiết booking và chuẩn bị lại sinh Version 2. Đọc lại Version 1 trên MongoDB: hash, renderedText, pricing total giữ nguyên 100%. | **PASS** |

---

## 3. Bằng chứng Kiểm tra Khởi động NestJS (Startup Verification Evidence)

Tệp kiểm thử: `backend/src/modules/contracts/tests/provider-p01-startup-verification.spec.ts`

```text
PASS src/modules/contracts/tests/provider-p01-startup-verification.spec.ts
  P0.1 — NestJS Startup & Dependency Injection Verification
    √ 1. Compiles ContractsModule successfully without UnknownDependenciesException (2 ms)
    √ 2. Successfully resolves ContractsController and its routes (1 ms)
    √ 3. Successfully resolves all core contract domain services (1 ms)
    √ 4. Feature flag CONTRACTS_V2_ENABLED factory correctly defaults to false when unconfigured (1 ms)
```

- Không có lỗi `UnknownDependenciesException`.
- `ContractsModule` biên dịch thành công.
- `ContractsController` ánh xạ chính xác toàn bộ 9 routes liên quan đến hợp đồng điện tử.
- Tất cả các dịch vụ nghiệp vụ (`ContractPreparationService`, `ContractReadService`, `ProviderContractApprovalService`, `ContractCheckoutGuard`, `ContractMechanismService`) được IoC container resolve thành công.
