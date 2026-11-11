# Phase 4.5 — Database and concurrency verification

Date: 2026-10-28. Scope: contracts only. No checkout, payment, frontend, PDF, application database migration, feature flag change, commit or push.

## Isolated database

- Docker Compose project: `vibehue-contract-test`.
- MongoDB 7 single-node replica set: `rsContractTest`, bound to host `127.0.0.1:27028`.
- Database URI is supplied only to the test process through `CONTRACT_TEST_MONGODB_URI` and `CONTRACT_TEST_DB_NAME`. `backend/.env` was not edited or used as a test target.
- Tests create randomly named `contract_*_test` scratch databases. Their `finally`/`afterAll` blocks remove them. Post-run query returned `[]` for database names beginning `contract_`.
- The test gate rejects missing configuration, a non-loopback host, another port, a mismatched database name or replica-set name.

## Commands run and results

| Command | Exit | Result |
| --- | ---: | --- |
| `docker info --format '{{.ServerVersion}}'` | 0 | Docker 29.6.1, after Docker Desktop started |
| `docker compose -f test/contract-mongo.compose.yml -p vibehue-contract-test up -d` | 0 | Isolated MongoDB started |
| `docker compose ... exec -T contract-mongo mongosh --quiet --eval "rs.initiate(...)"` | 0 | `{ ok: 1 }` |
| `docker compose ... exec -T contract-mongo mongosh --quiet --eval "rs.status().myState"` | 0 | `1` (PRIMARY) |
| `CONTRACT_TEST_*` set for process, `npx jest --runInBand modules/contracts/contract-index.integration.spec.ts modules/contracts/contract-runtime.integration.spec.ts` | 0 | 2 suites, 11 tests passed |
| `npx jest --runInBand modules/contracts/contract-phase4.spec.ts modules/contracts/contract-services.spec.ts modules/contracts/contract-schema.spec.ts` | 0 | 3 suites, 33 tests passed |
| `npm run build` | 0 | Backend build passed |
| `npx eslint "src/modules/contracts/**/*.ts"` | 0 | Contract lint passed |
| `npx jest --runInBand` without test DB variables | 1 | 308 passed, 8 baseline failures, 10 integration tests skipped |

The full Jest failures remain the same two pre-existing suites: `bookings.service.spec.ts` lacks a `PromotionsService` test provider; `settlements.service.spec.ts` has `existing.map` and `startSession` mock failures. These files were not changed in Phase 4.5. Integration tests were run separately with the isolated test URI and passed; the full run deliberately had no test DB variables, so its integration suites skipped.

## Verified database outcomes

- Migration dry-run rejects invalid legacy data without writes. After removing the invalid scratch record, a test-only injected failure after one backfill leaves one marker. A fresh dry-run and rerun finishes the second marker. The legacy `SIGNED` status, terms and signature remain intact.
- The backfill script does not change indexes. On scratch DB only, the test verifies the old booking-only unique index, switches to unique `(bookingId, providerId, scope)`, inserts a second provider contract and rejects a duplicate. The migration rerun remains idempotent.
- ContractVersion and ContractConsent unique indexes reject duplicate rows, including concurrent inserts. Provider AUTO_ACCEPTANCE active uniqueness is enforced.
- Preparation creates one contract per rental provider, reuses an unchanged version, creates a new version after booking/item changes, preserves the old snapshot, refuses writes without the required index and does not create duplicates under concurrent prepare requests.
- Consent stores one decision with server time. Same-key retry returns the same result; a different key or opposite decision conflicts. Concurrent ACCEPT/ACCEPT and ACCEPT/DECLINE yield one consent whose action matches the persisted version state. DECLINE also blocks later ACCEPT.
- Stale version, stale fingerprint, altered content hash, another customer, revoked provider acceptance and booking expiry between reads leave zero consent rows. A forced failure after consent insertion rolls back both consent and version state.
- Customer/provider cross-access and a client-supplied `actorUserId` are rejected. Idempotency keys are unique per authenticated actor, so different customers may use the same key. Stored consent documents contain no JWT or refresh token. This verifies persisted evidence; HTTP-level JWT validation and application log redaction were not exercised end-to-end.

## Code fixes found during verification

- `ContractPreparationService.assertLiveHold` now re-reads live booking status and hold expiry, including inside a transaction.
- `assertSourcesUnchanged` now compares booking and rental-item fields used to build a contract, reducing reliance on `updatedAt` alone.
- Migration script gained `--test-fail-after=N`, guarded by its existing explicit test-database apply checks, solely to verify recovery from a partial backfill.

## Remaining gates before Phase 5

- Production template and AUTO_ACCEPTANCE mechanism are still DRAFT; no real contract offer or acceptance can be activated.
- `CONTRACTS_V2_ENABLED` remains OFF. The integration tests instantiate services with test-only approved fixtures; they do not enable the application flag.
- No HTTP end-to-end test with a real JWT was run. Audit persistence was checked, while deployed request logging was not exercised.
- The old unique index on the application database was not changed. A reviewed production migration and index rollout remains necessary before activating contracts.
- Payment readiness/guard has not been connected to any checkout, webhook, simulator or polling path.

Phase 5 proposal: approve the contract wording and AUTO mechanism, prepare a reviewed database migration/index rollout with rollback and read-only verification, add HTTP auth tests, then integrate readiness guards into every payment entry point with idempotent late-payment handling. No Phase 5 code was changed here.
