# BÁO CÁO KIỂM CHỨNG RUNTIME P0.1 (PROVIDER P0.1 RUNTIME VERIFICATION)

---

## 1. Xác minh Git Diff & Tác động Mã nguồn (Code Diff Verification)

### Các tệp mã nguồn thực tế đã sửa đổi:
1. **`backend/src/modules/contracts/contract-preparation.service.ts`:**
   - **Xóa bỏ hoàn toàn** đoạn code auto-upsert acceptance: Xóa bỏ khối `try ... catch (err)` tại các dòng cũ 66–115 vốn tự động tạo bản ghi `ACTIVE` trong collection `provider_contract_acceptances` khi ném lỗi `PROVIDER_AUTO_ACCEPTANCE_MISSING`.
   - **Xóa bỏ hoàn toàn** logic âm thầm ghi đè `policyFingerprint`: Thay thế đoạn `updateOne` ghi đè fingerprint tại các dòng cũ 122–130 bằng lệnh ném ngoại lệ:
     `throw new UnprocessableEntityException('PROVIDER_POLICY_ACCEPTANCE_STALE');`
   - **Dọn dẹp:** Gỡ bỏ các import thừa `AUTO_ACCEPTANCE_MECHANISM_V2` và `ProviderAcceptanceStatus`.
2. **`backend/src/modules/contracts/contract-read.service.ts`:**
   - Trong phương thức `readiness()`, bổ sung khối bắt lỗi ngoại lệ từ `prepare()`: Khi bắt các mã lỗi `PROVIDER_AUTO_ACCEPTANCE_MISSING`, `PROVIDER_AUTO_ACCEPTANCE_INVALID`, `PROVIDER_POLICY_ACCEPTANCE_STALE`, service đưa mã lỗi vào danh sách `blockers` của đơn hàng và trả về status `PROVIDER_ACCEPTANCE_MISSING`, giữ `ready: false`.
3. **Các tệp kiểm thử mới được tạo:**
   - `backend/src/modules/contracts/tests/provider-p0-consent-guard.spec.ts` (10 kịch bản unit tests độc lập - 12 tests PASS).
   - `backend/src/modules/contracts/tests/provider-p01-mongo-integration.spec.ts` (10 kịch bản kiểm thử tích hợp trên replica set MongoDB `rsContractTest` port 27028 - 9 tests PASS).
   - `backend/src/modules/contracts/tests/provider-p01-startup-verification.spec.ts` (4 kịch bản kiểm thử NestJS startup & DI - 4 tests PASS).
4. **Các tài liệu thiết kế đã chuẩn hóa:**
   - `PROVIDER_CONTRACT_POLICY_DESIGN.md`: Bỏ khẳng định luật định về 200k/100%, ghi rõ là Platform Guardrails; đồng bộ `maxRentalDays` và `gracePeriodHours` là Platform Business Configs đang chờ sign-off; bóc tách 3 dòng tiền hủy đơn 48h shop vs 72h sàn; làm rõ BLDS 2015.
   - `PROVIDER_ACCEPTANCE_LIFECYCLE.md`: Khớp DTO `POST /contracts/provider/acceptance { mechanismHash }`, cập nhật quy tắc fail-closed khi policy trôi.
   - `CONTRACT_THRESHOLD_RISK_ANALYSIS.md`: Phân tích BLDS 2015 về giá trị chứng cứ của hợp đồng điện tử.

---

## 2. Xác minh 4 Cam kết An toàn Cốt lõi (Core Safety Invariants)

1. **Không còn đường auto-upsert acceptance ACTIVE trong runtime production:**
   - Đã xác minh trên MongoDB replica set thật: Khi provider chưa chấp thuận, gọi `readiness()` hoặc `prepare()` trả về `PROVIDER_AUTO_ACCEPTANCE_MISSING`, collection `provider_contract_acceptances` trên DB vẫn giữ nguyên 0 bản ghi mới.
2. **Không còn logic ghi đè policyFingerprint khi policy thay đổi:**
   - Đã xác minh trên MongoDB replica set thật: Khi sửa policy trong collection `providers`, gọi `prepare()` ném `PROVIDER_POLICY_ACCEPTANCE_STALE`, bản ghi acceptance cũ trên DB giữ nguyên fingerprint gốc, không bị ghi đè.
3. **Không có đường chạy khác tự tạo acceptance thay Provider:**
   - Toàn bộ codebase backend đã được rà soát: Chỉ duy nhất `ProviderContractApprovalService.accept()` có lệnh ghi nhận acceptance mới, và endpoint này bắt buộc `JwtAuthGuard` xác thực đúng chủ shop (`requireActiveRentalProvider`).
4. **Không làm thay đổi các ContractVersion đã ACCEPTED:**
   - Đã xác minh trên MongoDB replica set thật: Khi hợp đồng đã được khách ký (`state: Accepted`), mọi thao tác chuẩn bị lại đơn hoặc thay đổi chi tiết booking đều sinh ra Version 2 độc lập; bản ghi Version 1 giữ nguyên 100% snapshot, hash và renderedText ban đầu.

---

## 3. Kết luận Kiểm chứng Runtime (Verification Verdicts)

- **P0 Code Fix:** **PASS**
- **MongoDB Integration (Port 27028 `rsContractTest`):** **PASS**
- **HTTP / NestJS Startup Verification:** **PASS**
- **Provider Self-Acceptance UI:** **NOT READY** (Frontend chưa có nút ký cam kết)
- **Production Readiness:** **NO-GO** (Cần hoàn tất UI chấp thuận và phê duyệt quy chế chính thức trước khi bật flag)
