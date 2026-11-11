# BÁO CÁO KIỂM THỬ HỒI QUY TOÀN DIỆN (PROVIDER P0 REGRESSION REPORT)
## 10 KỊCH BẢN KIỂM THỬ AN TOÀN BẮT BUỘC (MANDATORY REGRESSION SUITE)

---

## 1. Tóm tắt Kết quả Kiểm thử (Executive Summary)

- **Tệp kiểm thử độc lập:** `backend/src/modules/contracts/tests/provider-p0-consent-guard.spec.ts`
- **Môi trường kiểm thử:** Test harness cô lập (Isolated In-Memory Mocks & Jest Circus), không kết nối và không ghi dữ liệu lên cụm MongoDB Atlas trực tiếp.
- **Tổng số kịch bản P0 bắt buộc:** 10 kịch bản (chia thành 12 unit tests cụ thể).
- **Kết quả thực thi bộ test P0:** **12/12 PASS (100% ĐẠT)**.
- **Kết quả thực thi toàn bộ các bộ test Hợp đồng:** **45/45 PASS (100% ĐẠT)**.
- **Biên dịch TypeScript (`tsc --noEmit`):** **Thành công 0 lỗi**.

---

## 2. Chi tiết 10 Kịch bản Kiểm thử P0

| # | Kịch bản kiểm thử (Scenario) | Mục tiêu xác minh | Phương thức / Dịch vụ kiểm tra | Mã lỗi / Kết quả kỳ vọng | Trạng thái |
| :-: | :--- | :--- | :--- | :--- | :-: |
| **1** | **Provider chưa chấp thuận -> Không tự tạo bản ghi active** | Xác minh `ContractPreparationService` không tự động chèn/upsert acceptance vào bảng `provider_contract_acceptances`. | `ContractPreparationService.prepare()` | Ném ngoại lệ, `updateOneSpy` và `insertOneSpy` **không bao giờ được gọi**. | **PASS** |
| **2** | **Provider chưa chấp thuận -> Khách chuẩn bị hợp đồng bị chặn** | Xác minh đơn hàng fail-closed và API `readiness` báo blocker khi thiếu cam kết của shop. | `ContractPreparationService.prepare()` & `ContractReadService.readiness()` | Ném `PROVIDER_AUTO_ACCEPTANCE_MISSING`. Readiness trả về blocker `PROVIDER_AUTO_ACCEPTANCE_MISSING` và status `PROVIDER_ACCEPTANCE_MISSING`. | **PASS** |
| **3** | **Cơ chế Draft -> Không thể tạo chấp thuận hợp lệ cho giao dịch thật** | Xác minh nếu quy chế sàn chưa được phê duyệt (`DRAFT`), shop không thể kích hoạt cam kết có hiệu lực. | `ProviderContractApprovalService.accept()` | Ném `UnprocessableEntityException('CONTRACT_MECHANISM_NOT_APPROVED')`. | **PASS** |
| **4** | **Provider gửi mã băm cũ/sai lệch -> Từ chối chấp thuận** | Xác minh nếu shop gửi hash quy chế không khớp với phiên bản hiện hành, hệ thống từ chối ngay lập tức. | `ProviderContractApprovalService.accept()` | Ném `ConflictException('CONTRACT_MECHANISM_CHANGED')`. | **PASS** |
| **5** | **User khác không thể chấp thuận/thu hồi thay shop** | Xác minh chỉ đúng tài khoản chủ sở hữu Provider (`ownProvider`) mới có quyền thực hiện thao tác cam kết hoặc thu hồi. | `ProviderContractApprovalService.accept()` & `revoke()` | Ném `NotFoundException('PROVIDER_NOT_FOUND')`. | **PASS** |
| **6** | **Thu hồi cam kết (Revoke) -> Chặn ngay đơn hàng tiếp theo** | Xác minh sau khi shop bấm Revoke, trạng thái chuyển thành `REVOKED` và các lượt chuẩn bị đơn hàng sau đó lập tức bị chặn. | `ProviderContractApprovalService.revoke()` & `ContractPreparationService.prepare()` | `revokeResult.revoked: true`. Gọi prepare sau đó ném `PROVIDER_AUTO_ACCEPTANCE_MISSING`. | **PASS** |
| **7** | **Đã có chấp thuận hợp lệ -> Chuẩn bị hợp đồng thành công** | Xác minh khi shop đã ký cam kết đầy đủ, đúng hash và đúng fingerprint, luồng tạo hợp đồng V2 hoạt động trơn tru. | `ContractPreparationService.prepare()` | Trả về `{ contractId, versionId, version: 1, reused: false }` với trạng thái `Offered`. | **PASS** |
| **8** | **Bảo toàn bất biến các ContractVersion đã được khách ký (`ACCEPTED`)** | Xác minh việc chuẩn bị lại hợp đồng khi booking thay đổi không bao giờ sửa đổi hoặc ghi đè phiên bản cũ đã được khách ký nhận. | `ContractPreparationService.prepare()` | `acceptedVersion.state` vẫn giữ nguyên `Accepted`, không đổi hash; hệ thống sinh phiên bản Version 2 riêng biệt. | **PASS** |
| **9** | **Đơn nhiều shop: 1 shop chưa ký cam kết -> Chặn thanh toán toàn đơn** | Xác minh trong đơn hàng Combo/nhiều áo dài, nếu Shop A đã ký nhưng Shop B chưa ký cam kết, cổng thanh toán phải bị chặn hoàn toàn. | `ContractCheckoutGuard.evaluate()` | Ném lỗi chặn không cho tạo liên kết thanh toán PayOS. | **PASS** |
| **10** | **Tắt Feature Flag / Đơn Chụp ảnh -> Không bị ảnh hưởng** | Xác minh khi tắt cờ `CONTRACTS_V2_ENABLED` hoặc đối với đơn chụp ảnh (`PHOTOGRAPHY`), luồng thanh toán legacy không bị chặn. | `ContractCheckoutGuard.evaluate()` | Trả về `{ binding: null, context: null }` an toàn, cho phép tiếp tục thanh toán. | **PASS** |

---

## 3. Nhật ký Chạy Test Thực tế (Raw Test Execution Logs)

### 3.1. Kết quả chạy bộ kiểm thử `provider-p0-consent-guard.spec.ts`
```text
PASS src/modules/contracts/tests/provider-p0-consent-guard.spec.ts
  P0 — Provider Consent Authenticity & Fail-Closed Safety Gate
    Scenario 1: Provider has not accepted -> no new active acceptance is created
      √ does not insert or upsert any provider_contract_acceptances record during prepare (23 ms)
    Scenario 2: Provider has not accepted -> booking preparation fails closed
      √ ContractPreparationService fails closed with PROVIDER_AUTO_ACCEPTANCE_MISSING (1 ms)
      √ ContractReadService.readiness reports PROVIDER_ACCEPTANCE_MISSING blocker (30 ms)
    Scenario 3: Draft mechanism -> cannot create valid acceptance for real transaction
      √ throws CONTRACT_MECHANISM_NOT_APPROVED when mechanism is in DRAFT state (3 ms)
    Scenario 4: Provider accepts with stale hash -> request rejected
      √ throws CONTRACT_MECHANISM_CHANGED when sent hash does not match current approved mechanism (1 ms)
    Scenario 5: Different provider cannot accept/revoke on behalf of shop
      √ rejects accept/revoke when user does not own the provider (1 ms)
    Scenario 6: Revoke -> subsequent booking preparation fails closed
      √ marks acceptance as REVOKED and causes subsequent prepare to fail closed (1 ms)
    Scenario 7: Valid acceptance exists -> preparation succeeds
      √ successfully prepares a draft contract and version when provider has actively accepted (4 ms)
    Scenario 8: Existing accepted ContractVersion documents remain immutable
      √ never mutates an already ACCEPTED contract version document when new state is prepared (6 ms)
    Scenario 9: Multi-provider: one shop lacking acceptance blocks checkout guard
      √ fails closed when provider B lacks active acceptance even if provider A is accepted (4 ms)
    Scenario 10: Feature flag OFF -> legacy checkout and photography unaffected
      √ returns null binding and does not block checkout when CONTRACTS_V2_ENABLED is false (1 ms)
      √ returns null binding for PHOTOGRAPHY bookings without blocking (1 ms)

Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Snapshots:   0 total
Time:        1.812 s
```

### 3.2. Kết quả kiểm thử liên kết toàn bộ phân hệ Hợp đồng (Full Contracts Suite)
```text
PASS src/modules/contracts/contract-services.spec.ts
PASS src/modules/contracts/tests/provider-p0-consent-guard.spec.ts
PASS src/modules/contracts/contract-phase4.spec.ts
PASS src/modules/contracts/tests/isolation-negative.spec.ts

Test Suites: 4 passed, 4 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        4.013 s
```

---

## 4. Kết luận Đảm bảo Chất lượng (Quality Assurance Sign-Off)

Toàn bộ 10 kịch bản an toàn P0 đã được triển khai, kiểm thử và vượt qua 100%. Hệ thống đã đạt trạng thái **Fail-Closed vững chắc**: không còn kẽ hở nào cho phép backend tự động tạo hoặc âm thầm sửa đổi cam kết thay cho Nhà cung cấp.
