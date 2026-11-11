# VIBEHUE — PHASE 9A: ENVIRONMENT & TEST ISOLATION EVIDENCE
**Execution Date:** 2026-10-30  
**Target:** Phase 9A Isolated Browser End-to-End Verification  
**Git Branch:** `feat/electronic-contracts`  
**Compliance Status:** **100% ISOLATED — ZERO PRODUCTION IMPACT**

---

## 1. Real Browser Infrastructure Proof

| Parameter | Observed Execution Value | Verification Proof |
|---|---|---|
| **Browser Engine** | Google Chrome | System binary invoked via Playwright channel `chrome` |
| **Browser Version** | `Chrome 156.0.8078.76` | Confirmed via `browser.version()` runtime output |
| **Viewport & Locale** | 1440x900, `vi-VN` | High-fidelity desktop resolution with Vietnamese localization |
| **Traces Captured** | 3 Playwright Zip Archives | `trace_01_customer_login.zip`, `trace_03_contract_modal_content.zip`, `trace_10_profile_contracts.zip` |
| **Screenshots Captured**| 15 full resolution PNGs | Saved in `browser-evidence/01_*.png` to `15_*.png` |

---

## 2. In-Process Vite Frontend Servers

Two distinct Vite server instances were instantiated within the test runner process to evaluate both enabled and disabled feature flag configurations:

1. **Instance 1 (Contracts V2 Enabled):**
   - Host & Port: `http://127.0.0.1:5195`
   - Config: `define: { 'import.meta.env.VITE_CONTRACTS_V2_ENABLED': '"true"', 'import.meta.env.VITE_API_BASE_URL': '"http://127.0.0.1:5195"' }`
   - Purpose: Real browser execution of customer login, booking checkout, modal viewer, consent recording, PDF download.

2. **Instance 2 (Contracts V2 Disabled - Fail-closed):**
   - Host & Port: `http://127.0.0.1:5196`
   - Config: `define: { 'import.meta.env.VITE_CONTRACTS_V2_ENABLED': '"false"', 'import.meta.env.VITE_API_BASE_URL': '"http://127.0.0.1:5196"' }`
   - Purpose: Verifies SCN-14 fail-closed behavior where Contracts V2 UI is completely hidden and disabled notice is rendered.

Both servers were cleanly terminated via `.close()` during teardown.

---

## 3. Database Isolation Proof

### 3.1 Replica Set Verification
- **Connection URI:** `mongodb://127.0.0.1:27028/contract_browser_e2e_test?replicaSet=rsContractTest&directConnection=true`
- **Port:** `27028` (Container: `vibehue-contract-test-contract-mongo-1`)
- **Replica Set Name:** `rsContractTest`
- **Writable Primary Check:**
  ```javascript
  const hello = await adminDb.command({ hello: 1 });
  // hello.setName === 'rsContractTest' (PASS)
  // hello.isWritablePrimary === true (PASS)
  ```
- **Atlas DB Safety:** Zero connections were made to `mongodb+srv://...` or `vibehue_db`. Connection strings containing credentials or Atlas hosts were strictly excluded from test runners.

### 3.2 Scratch Database Lifecycle
- **Database Name:** `contract_browser_e2e_test`
- **Pre-Test State:** Cleaned before running scenarios via `.deleteMany({})`.
- **Unique Indexes:** Created exclusively inside `contract_browser_e2e_test`:
  - `digital_contracts`: `{ bookingId: 1, providerId: 1, scope: 1 }` (unique)
  - `contract_versions`: `{ contractId: 1, version: 1 }` (unique)
  - `contract_consents`: `{ contractVersionId: 1, actorUserId: 1 }` (unique)
- **Post-Test Teardown:**
  ```javascript
  await connection.db.dropDatabase();
  await connection.close();
  ```
  Scratch database was dropped automatically upon test completion. Zero residual artifacts remain in MongoDB.

---

## 4. Payment Gateway & Third-Party Isolation

- **PayOS Live Credentials:** Never loaded or called during test execution.
- **Outbound HTTP Calls:** All payment endpoints (`/payments/create-link`, `/payments/:code/status`) were intercepted in-memory by Playwright route handlers.
- **PayOS Simulator:** Hosted locally on test port without making external requests to `api.payos.vn`.

---

## 5. Configuration File Preservation

- Neither `backend/.env` nor `frontend/.env` were altered.
- `CONTRACTS_V2_ENABLED` remains `false` by default in production files.
- Feature flag injection occurred strictly in memory via Vite server options.
- No git commits or branch switches were executed during this verification.
