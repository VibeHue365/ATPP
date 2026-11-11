# VIBEHUE — PHASE 8B.1: BLOCKERS, MATURITY MATRIX & TRANSITION GATE

**Assessment Date:** 2026-10-29T21:55:00+07:00  
**Phase:** 8B.1 Complete → Pre-Phase 8C Gate  

---

## 1. Classification of Dependencies & Systems

To maintain absolute architectural honesty, all components tested in Phase 8B.1 are categorized into three explicit buckets:

### Category A: REAL SERVICE + REAL TEST DATABASE (High Confidence)
*These components were executed using production TypeScript business logic against real MongoDB replica set (`rsContractTest` at `127.0.0.1:27028`) with real ACID transactions, collections, and indexes:*
- `ContractPreparationService`: Real snapshot building, policy fingerprinting, canonical serialization, SHA-256 hash calculation, voucher allocation fail-closed.
- `ContractConsentService`: Real idempotency checks, atomic MongoDB transaction, optimistic concurrency control, consent log creation, version state transitions.
- `ContractCheckoutGuard`: Real booking inspection, version verification, hold expiration enforcement, fail-closed contract requirements.
- `ContractEvidenceService`: Real atomic CAS claim leases, real PDF generation via `ContractPdfGenerator`, storage metadata tracking, download streaming and presigned URL access logic.
- `ContractPdfGenerator`: Real PDF binary rendering via `pdf-lib` and `@pdf-lib/fontkit` using TrueType `NotoSans` fonts, pagination, Vietnamese diacritic support, SHA-256 calculation.
- `ContractReadService`: Real role-based access control, ownership verification, anti-enumeration 404 security.
- `V2PaymentFinalizationService`: Real multi-document ACID transaction, escrow record creation, hold confirmations, booking state transition (`V2_PAYMENT_FINALIZED`).
- `WebhookEventRepository`: Real atomic locking, deduplication, and idempotency control.

### Category B: MOCKED EXTERNAL DEPENDENCY (Controlled Synthetic Simulation)
*These external third-party services were simulated locally without network calls:*
- **PayOS Payment Gateway Outbound API:** The PayOS hosted payment link creation and bank checkout UI were simulated locally via deterministic HMAC-SHA256 signature generation matching PayOS SDK specifications. No calls to `api-merchant.payos.vn` were made.
- **PayOS Inbound Webhook Delivery:** Simulated via direct HTTP handler invocations with signed synthetic payloads rather than public webhook delivery over the Internet.
- **Object Storage (MinIO / S3):** Handled via an in-memory test implementation of `StorageService` for upload/download bytes. Real network MinIO uploads/presigned URLs were verified separately in Phase 6 unit suites.

### Category C: NOT VERIFIED / REAL STAGING REMAINING
*These items require external environments and are intentionally NOT yet verified:*
- **Public Internet Webhook Callback:** Real PayOS server calling a publicly reachable HTTPS callback URL (requires public staging URL or webhook tunnel).
- **Production MongoDB Atlas Cluster:** Atlas cluster migration and production indexing (must remain untouched until planned release).
- **Legal Counsel Final Approval:** Official corporate approval of the Vietnamese Ao Dai rental contract terms and policy mechanism (currently synthetic approved template/mechanism).

---

## 2. Unresolved Blockers & Hard Pre-Requisites for Phase 8C (Staging Pilot)

The following blockers MUST be resolved prior to deploying to a staging/production pilot:

| Blocker ID | Severity | Description | Action Required |
| :--- | :---: | :--- | :--- |
| **BLK-8C-01** | **P0** | **Legal Template Draft Status:** Production template in database remains in `DRAFT` status (`approvedAt: null`). | Legal counsel must review template terms and platform must execute formal admin approval before live rollout. |
| **BLK-8C-02** | **P0** | **Feature Flag Safeguard:** `CONTRACTS_V2_ENABLED` and `VITE_CONTRACTS_V2_ENABLED` are both `false`. | Must remain `false` until database indexes are applied to staging Atlas cluster. |
| **BLK-8C-03** | **P1** | **Public Webhook Endpoint:** Local test runner cannot receive real asynchronous callbacks from PayOS production servers. | When staging environment is provisioned, staging domain must have SSL and be registered in PayOS sandbox developer portal. |
| **BLK-8C-04** | **P1** | **MinIO / S3 Bucket Provisioning:** Object storage bucket `vibehue-contracts` must exist with private ACL and server-side encryption. | Bucket provisioning script or IaC must be executed on staging infrastructure. |

---

## 3. Go / No-Go Decision for Phase 8C

- **Synthetic E2E Execution:** **GO** — 17/17 scenarios passed cleanly on isolated infrastructure.
- **Security & Authorization:** **GO** — IDOR isolation, anti-enumeration 404, and hold expiry gates verified.
- **Regression Impact:** **GO** — 0 regressions across legacy V1 bookings, photography packages, and frontend features.
- **Live Staging Pilot Advancement:** **HOLD** — Pending explicit user authorization to configure staging environment and register PayOS sandbox credentials.
