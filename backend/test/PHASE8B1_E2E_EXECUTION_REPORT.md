# VIBEHUE — PHASE 8B.1: ISOLATED SYNTHETIC E2E EXECUTION REPORT

**Execution Timestamp:** 2026-10-29T21:52:02+07:00  
**Test Suite:** `backend/src/modules/contracts/tests/contract-synthetic-e2e.spec.ts`  
**Execution Environment:** Isolated Docker Replica Set `rsContractTest` (`127.0.0.1:27028`)  
**Overall Result:** **17/17 PASSED (100%)** — Total suite time: 21.907s  

---

## 1. Summary of Execution Matrix (17 Scenarios)

| Scenario ID | Scenario Name & Scope | Result | Duration | Real Domain Services | Mocked Dependencies | Initial State → Final State |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| **E2E-01** | Rental booking một provider chuẩn bị hợp đồng tự động | **PASS** | 153ms | `ContractPreparationService`, `ContractReadService` | In-memory ObjectStorage | Booking: PendingPayment → Contract: Created, Version: Offered |
| **E2E-02** | Combo booking nhiều provider (phân tách HĐ độc lập & voucher fail-closed) | **PASS** | 200ms | `ContractPreparationService`, `ContractReadService` | In-memory ObjectStorage | 2 independent contracts created; Unallocated voucher: Throws `ConflictException(VOUCHER_ALLOCATION_REQUIRED)` |
| **E2E-03** | Khách ACCEPT tất cả hợp đồng trước khi thanh toán | **PASS** | 407ms | `ContractConsentService`, `ContractReadService` | In-memory ObjectStorage | Version: Offered → Accepted (occurredAt, hash matching). Readiness: `providers.every(p => p.status === 'ACCEPTED')` |
| **E2E-04** | Khách DECLINE một hợp đồng (chặn tạo thanh toán ngay lập tức) | **PASS** | 137ms | `ContractConsentService`, `ContractCheckoutGuard` | In-memory ObjectStorage | Version: Offered → Declined. Checkout Guard: Throws `ForbiddenException(CONTRACT_CONSENT_DECLINED)` |
| **E2E-05** | Hợp đồng stale version (xung đột hash khi điều khoản thay đổi) | **PASS** | 85ms | `ContractConsentService` | In-memory ObjectStorage | Tampered contentHash in consent request → Throws `ConflictException(CONTRACT_CONTENT_STALE)` |
| **E2E-06** | Booking hold expired (chặn luồng consent & thanh toán sau 15 phút) | **PASS** | 35ms | `ContractConsentService`, `ContractCheckoutGuard` | In-memory ObjectStorage | `holdExpiresAt` past date → Consent: Throws `ConflictException(BOOKING_HOLD_EXPIRED)`. Guard: Throws `ConflictException` |
| **E2E-07** | Payment sandbox success qua PayOS Webhook (finalization, escrow, PDF) | **PASS** | 2491ms | `V2PaymentFinalizationService`, `ContractEvidenceService`, `ContractPdfGenerator` | In-memory ObjectStorage, Local HMAC Webhook Simulator | Payment: Pending → Success. Booking: PendingPayment → Confirmed (`V2_PAYMENT_FINALIZED`). Escrow: Held. Version document: `READY`, SHA-256 generated |
| **E2E-08** | Payment sandbox failure / cancel (không kích hoạt escrow, giữ nguyên trạng thái) | **PASS** | 34ms | Webhook verification logic | In-memory ObjectStorage, Local Webhook Simulator | Webhook code != '00' → Payment: Cancelled/Failed. Escrow: None inserted. Booking status: Untouched |
| **E2E-09** | Duplicate webhook (xử lý idempotent, không nhân đôi escrow hay trừ kho) | **PASS** | 22ms | `WebhookEventRepository`, Atomic DB constraints | In-memory ObjectStorage | 1st webhook: Claims lock & processes. 2nd duplicate webhook: Returns `{ state: 'processed' }` with ZERO duplicate writes |
| **E2E-10** | Recovery sau khi worker bị gián đoạn (Atomic CAS claim lease phục hồi PDF hỏng) | **PASS** | 2046ms | `ContractEvidenceService`, `ContractPdfGenerator` | In-memory ObjectStorage | Stuck in `GENERATING` with expired lease (retryCount: 0) → Recovery worker claims lease, generates PDF, commits `READY` |
| **E2E-11** | PDF generation READY (chuẩn 2 trang, tiếng Việt Unicode, font Noto Sans) | **PASS** | 1909ms | `ContractEvidenceService`, `ContractPdfGenerator` | In-memory ObjectStorage | PDF buffer conforms to PDF-1.7, contains Vietnamese diacritics (ă, â, ê, ô, ơ, ư, đ, Đ), exact 2 pages |
| **E2E-12** | PDF hash verification (xác thực SHA-256 byte stream thời gian thực) | **PASS** | 1948ms | `ContractEvidenceService`, `ContractPdfGenerator` | In-memory ObjectStorage | Stored SHA-256 matches real-time `crypto.createHash('sha256').update(buffer).digest('hex')` |
| **E2E-13** | Customer download PDF & tra cứu evidence metadata (xác thực quyền sở hữu) | **PASS** | 2018ms | `ContractEvidenceService`, `ContractReadService` | In-memory ObjectStorage | Customer: Downloads valid signed PDF + retrieves evidence metadata. Non-owner Customer B: HTTP 404 (anti-enumeration) |
| **E2E-14** | Provider isolation (cô lập IDOR tuyệt đối giữa các đối tác) | **PASS** | 138ms | `ContractReadService`, `ContractEvidenceService` | In-memory ObjectStorage | Provider A cannot read Provider B's contract in same combo booking → HTTP 404. Direct evidence lookup by contractId: HTTP 404 |
| **E2E-15** | Legacy checkout regression (đơn hàng V1 bỏ qua modal, checkout mượt mà) | **PASS** | 26ms | `ContractCheckoutGuard` | In-memory ObjectStorage | Booking `contractFlowVersion: 1` → Guard returns `{ allowed: true, requirement: 'NOT_REQUIRED' }` |
| **E2E-16** | Photography-only regression (không sinh hợp đồng thuê áo dài) | **PASS** | 26ms | `ContractPreparationService`, `ContractCheckoutGuard` | In-memory ObjectStorage | Booking with only Photography Package items → 0 contracts prepared. Guard returns `NOT_REQUIRED` |
| **E2E-17** | Feature flag mismatch (hành vi fail-closed khi backend `CONTRACTS_V2_ENABLED=false`) | **PASS** | 36ms | `ContractPreparationService`, `ContractCheckoutGuard` | In-memory ObjectStorage | Backend `enabled: false` → Preparation: Throws `ServiceUnavailableException(CONTRACTS_V2_DISABLED)`. Guard: Throws `ServiceUnavailableException` |

---

## 2. Detailed Technical Observations per Category

### 2.1 Multi-Provider Separation & Voucher Policy (E2E-01 & E2E-02)
- In single-provider bookings, exactly 1 contract document is generated for the rental provider.
- In multi-provider combo bookings, independent contracts are prepared per rental provider.
- In voucher redemption without explicit per-provider discount allocation, the preparation engine fails closed with `ConflictException('VOUCHER_ALLOCATION_REQUIRED')`, preventing unallocated subsidy risks across providers.

### 2.2 Customer Consent & Guard Gate (E2E-03 to E2E-06)
- Customer explicit acceptance updates version state to `ACCEPTED` and stores the immutable hash fingerprints.
- If customer DECLINES any contract, `ContractCheckoutGuard` immediately aborts checkout with `ForbiddenException('CONTRACT_CONSENT_DECLINED')`.
- If contract content or booking fingerprint changes between offer and consent, `CONTRACT_CONTENT_STALE` is thrown.
- If booking hold expires (> 15 minutes), consent attempt throws `ConflictException('BOOKING_HOLD_EXPIRED')`.

### 2.3 Webhook Payment Processing & Finalization (E2E-07 to E2E-09)
- Webhook signature is validated using deterministic HMAC-SHA256 sorted query format.
- Successful webhook (`code: '00'`) executes `V2PaymentFinalizationService.finalize` within a MongoDB multi-document ACID transaction:
  - Transition booking to `CONFIRMED` with note `V2_PAYMENT_FINALIZED`.
  - Create escrow record with status `HELD`.
  - Confirm inventory and photography holds.
  - Trigger decoupled asynchronous PDF generation.
- Failed or cancelled webhooks leave booking in `PENDING_PAYMENT` and do not touch escrow.
- Duplicate webhooks are intercepted by `WebhookEventRepository.claimVerifiedEvent`, returning `{ state: 'processed' }` with idempotent zero-side-effect behavior.

### 2.4 Evidence Generation, Storage & CAS Recovery (E2E-10 to E2E-12)
- PDF is rendered using `pdf-lib` and `fontkit` with embedded `NotoSans-Regular` and `NotoSans-Bold`.
- Vietnamese diacritics are preserved without replacement or mojibake.
- Atomic CAS (Compare-And-Swap) lease claiming guarantees that workers interrupted mid-generation are recovered after lease expiry without duplicate file collisions.

### 2.5 Access Control & Anti-Enumeration (E2E-13 to E2E-14)
- Unauthorized users (non-participating customer or provider) querying contracts receive strict `404 Not Found` (anti-enumeration security pattern), preventing leakage of contract existence.
- Providers can only access contracts for which they are the contracted party.

### 2.6 Backward Compatibility & Regression Gate (E2E-15 to E2E-17)
- V1 bookings (`contractFlowVersion: 1`) bypass contracts completely with zero friction.
- Pure photography bookings without rental items do not trigger contract generation.
- When `CONTRACTS_V2_ENABLED=false`, all contract endpoints fail closed safely.
