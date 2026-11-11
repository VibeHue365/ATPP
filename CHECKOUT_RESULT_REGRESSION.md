# VIBEHUE — CHECKOUT RESULT REGRESSION & TEST VERIFICATION MATRIX (P0)

**Date**: 2026-11-03  
**Database**: Isolated MongoDB Replica Set `127.0.0.1:27028` (`rsContractTest`)  
**Git Branch**: `feat/electronic-contracts`  

---

## 1. Phân định rõ ràng: Test UI React vs. Test Backend State

| Phân loại | Công cụ | Tập tin kiểm thử | Số lượng | Môi trường thực thi | Mô tả kiểm chứng |
|---|---|---|:---:|---|---|
| **React UI Tests** | Vitest + RTL | [`frontend/tests/checkout-result-page.test.tsx`](file:///d:/gameeee/KI8/DOAN/Vibehue/frontend/tests/checkout-result-page.test.tsx) | **9 tests** | JSDOM / React Test Runner | Khởi chạy thực tế component `<CheckoutResultPage />`, mock HTTP, kích hoạt fake timers 30 chu kỳ, kiểm tra hiển thị DOM, nút bấm, giỏ hàng, thông điệp an toàn. |
| **Backend State Tests** | Jest + Supertest | [`backend/src/modules/payments/tests/checkout-stuck-runtime-verification.spec.ts`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/tests/checkout-stuck-runtime-verification.spec.ts) | **16 tests** | MongoDB Replica Set `127.0.0.1:27028` | Ghi/đọc trực tiếp trên database thật `contract_stuck_test`, kiểm tra session transactions, immutable binding, guard fail-closed, lease locks. |

---

## 2. Giải đáp chi tiết các câu hỏi về Feature Flag & Phạm vi ảnh hưởng

1. **Tại sao Feature flag OFF trả `CONTRACTS_V2_DISABLED` trong test mới?**
   - [`contract-checkout-guard.service.ts#L74`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/contracts/contract-checkout-guard.service.ts#L74): Khi một booking được đánh dấu là `contractFlowVersion === 2` (thuê áo dài V2) mà cờ `CONTRACTS_V2_ENABLED` bị tắt (`false`), Guard bắt buộc ném `ServiceUnavailableException('CONTRACTS_V2_DISABLED')` để **bảo vệ hệ thống không thực thi đơn hàng V2 dở dang khi động cơ Hợp đồng đang tắt**.
2. **Legacy checkout thực sự vẫn hoạt động hay không?**
   - **HOÀN TOÀN BÌNH THƯỜNG (PASS)**.
   - Khi `contractFlowVersion` là `null` (hoặc khác 2):
     - Tại [`contract-checkout-guard.service.ts#L69-L72`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/contracts/contract-checkout-guard.service.ts#L69-L72), Guard kiểm tra ngay đầu hàm:
       `if (booking.contractFlowVersion !== 2 || booking.bookingType === 'PHOTOGRAPHY') return { binding: null, context: null };`
       -> Trả về `null` ngay lập tức, **hoàn toàn không kích hoạt kiểm tra hợp đồng hay ném lỗi cờ**.
     - Luồng thanh toán legacy [`payments.service.ts#L153-L210`](file:///d:/gameeee/KI8/DOAN/Vibehue/backend/src/modules/payments/services/payments.service.ts#L153-L210) tiếp tục chạy trực tiếp.
3. **Photography-only vẫn hoàn tất thanh toán được không?**
   - **HOÀN TOÀN BÌNH THƯỜNG (PASS)**.
   - Gói chụp ảnh thuần túy (`bookingType === BookingType.Photography`) được loại trừ khỏi luồng Hợp đồng thuê đồ, thanh toán cọc và xác nhận đơn không bị cản trở.
4. **15 scenarios tương ứng với 16 tests thế nào?**
   - **1 test ở Section 1**: `Runtime Verification 1-8` kiểm chứng toàn diện 8 điểm dữ liệu DB và side effect của GET.
   - **15 tests ở Section 5**: Kiểm chứng tuần tự từng kịch bản từ Scenario 1 đến Scenario 15.
   - Tổng cộng: **1 + 15 = 16 tests**.

---

## 3. Ma trận kết quả 16 Tests Backend Replica Set (100% PASS)

```bash
PASS src/modules/payments/tests/checkout-stuck-runtime-verification.spec.ts
  P0 Runtime Root Cause & 15 Safety Regression Scenarios
    P0 Section 1 — Runtime Root Cause Verification & Deadlock Evidence
      √ Runtime Verification 1-8: Confirms exact DB state, guard failure, needsManualReview setting, and side effects on GET (292 ms)
    P0 Section 5 — 15 Synthetic Regression Tests
      √ Scenario 1: Simulator success normal (legacy booking auto-confirms payment and booking) (39 ms)
      √ Scenario 2: Simulator pending (payment remains in Pending before webhook or confirmation) (6 ms)
      √ Scenario 3: Simulator failed/cancelled (payment fails, booking cancels) (31 ms)
      √ Scenario 4: Mechanism DRAFT (Guard throws CONTRACT_MECHANISM_NOT_APPROVED) (35 ms)
      √ Scenario 5: Provider acceptance missing (Guard fails closed when provider has no acceptance) (47 ms)
      √ Scenario 6: Provider acceptance stale (Guard fails closed when mechanism hash does not match) (32 ms)
      √ Scenario 7: Customer ACCEPTed but not yet paid (version Accepted, consent stored, payment Pending) (15 ms)
      √ Scenario 8: Payment SUCCESS but booking not CONFIRMED (needsManualReview flag and reviewRequired recovery) (22 ms)
      √ Scenario 9: Duplicate webhook (Idempotent: second event acknowledged without duplicate mutations) (10 ms)
      √ Scenario 10: Retry and recovery (Lease acquisition and retry count tracking) (16 ms)
      √ Scenario 11: Frontend polling timeout (Verified contract: 30 polls bounded) (1 ms)
      √ Scenario 12: Network error (Safe rejection handling without altering DB) (7 ms)
      √ Scenario 13: Legacy checkout (contractFlowVersion = null bypasses ContractCheckoutGuard) (13 ms)
      √ Scenario 14: Photography-only checkout (bookingType = PHOTOGRAPHY bypasses rental guard) (11 ms)
      √ Scenario 15: Feature flag OFF (CONTRACTS_V2_ENABLED = false throws CONTRACTS_V2_DISABLED) (20 ms)

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
```

---

## 4. Ma trận kết quả 9 Tests Frontend Vitest UI (100% PASS)

```bash
PASS tests/checkout-result-page.test.tsx
  P0: CheckoutResultPage Terminal States & Anti-Stuck Verification
    √ 1. SUCCESS + Confirmed Booking (clean, no review flag): Clears cart and provides view order link
    √ 2. REVIEW_REQUIRED (SUCCESS captured but unconfirmed booking): Stops spinner, does NOT clear cart, warns against duplicate payment
    √ 3. REVIEW_REQUIRED priority: When needsManualReview=true, even if confirmed=true, stays in REVIEW_REQUIRED
    √ 4. Payment SUCCESS but booking CANCELLED: Routes to REVIEW_REQUIRED, NOT to retry payment
    √ 5. FAILED payment: Shows failure message and provides Return to Cart link
    √ 6. CANCELLED booking with PENDING payment: Shows cancelled message and provides Return to Cart link
    √ 7. Polling Exhaustion / TIMEOUT: Does NOT claim money is safe, warns against double payment, stops spinner
    √ 8. Controlled "Kiểm tra lại" button: Performs a single verification without launching infinite 30-poll loop
    √ 9. Network / Server Error: Displays connection issue with single retry button

Test Files  1 passed (1)
Tests       9 passed (9)
```
