# VibeHue — Phase 5 approval checklist

Status: **unsigned proposal, 2026-10-28**. Checking a box requires a named approver and evidence. This document does not authorize migration, flag activation, payment integration, frontend work, or PDF generation.

## A. Phase 4.5 reconciliation gate

- [ ] Product/engineering accepts the distinction between the 11 isolated integration passes and the 10 skips in the earlier full Jest run; record the run dates and test counts. The full run lacked `CONTRACT_TEST_*` variables by design.
- [ ] QA records baseline reproduction at unchanged HEAD `916b858f13f988b83d2b3abcdd30906427d9405c`: same installed dependencies/config, targeted Jest exit 1, 8 failed / 3 passed; lists five booking DI failures and three settlement mock failures.
- [ ] Re-run MongoDB integration against the isolated replica set after Docker access is restored. Current audit's `docker info` exited 1 due to Docker API permission denied; do not call it freshly verified.
- [ ] Add combined race tests for expiry + concurrent consent, cancellation + payment, item mutation + binding, and provider revocation + consent/payment. Each must assert persisted DB state and hold/inventory effects.

## B. Business and legal choices — choose and sign each item

| Decision | Options and consequence | Proposed gate |
| --- | --- | --- |
| Approved template and AUTO mechanism | Approve exact versioned Vietnamese text and policy reference; otherwise no live offer. | Product + legal sign-off on rendered example and hash. |
| Nature of AUTO_ACCEPTANCE | Treat it as provider pre-authorization of a versioned mechanism; alternatively require provider action per transaction (manual bilateral scope). Neither option by itself is a claim of a legally recognized electronic signature. | Legal reviews wording and evidence method; MVP recommendation is pre-authorization only. |
| Formation trigger (`formedAt`) | Customer acceptance of approved specific offer, provider event, payment, or another reviewed event. Each changes when the contract is considered formed. | Explicitly choose; do not populate from consent code by inference. |
| Effectiveness trigger (`effectiveAt`) | Same as formation, successful payment, start of rental, or another approved condition. This affects cancellation obligations and communication. | Explicitly choose independently of `formedAt`. |
| Provider revocation cutoff | New offers only (historical accepted unpaid offer may proceed if still valid); or also block accepted unpaid offers (requires customer remedy). | Explicitly choose and document grandfathering. |
| Amendment/DECLINE | New version and re-consent; or cancel/rebook. Existing pending payment link must be invalidated or explicitly re-bound. | Choose user-facing and backend rule; no silent reuse. |
| Multi-provider combo allocation | Approved itemized formula for voucher, shared fees and deposits; or keep those combos outside V2 until formula approved. | Finance/Product formula and reconciliation example; default block affected cases. |
| Late money | Existing refund/review workflow versus an approved exception; never silently revive expired hold. | Finance/operations approve timeline and authority. |
| Admin override | No silent bypass (recommended); if exception required, design a separate authenticated, audited decision with reason and dual approval. | Product/security explicit decision. |

## C. Database rollout gate

- [ ] Explicit target database identity, replica health and operator are recorded; no URI or secret is pasted into reports.
- [ ] Read-only preflight from `PHASE5_PLAN.md` has zero unreviewed duplicates/orphans/invalid legacy records and records actual current index definitions.
- [ ] `scripts/migrate-contract-v2.js --dry-run` fingerprint is reviewed; its test-only `--apply` is **not** used on the application database.
- [ ] Backup completed and **restore tested** on a separate environment; point-in-time/recovery window approved.
- [ ] Production migration and index-change tool/runbook is independently reviewed, has target allowlist, checkpoint/retry behavior, legacy evidence preservation and no startup auto-index side effects.
- [ ] Migration tested on an authorized DB copy with partial failure, rerun, old `SIGNED` contract intact, two providers in one booking and duplicate rejection.
- [ ] Maintenance window and sequence approved: backfill → create/verify compound index → drop old booking-only index → verify → separate canary. If a stage fails, flag stays OFF and operator follows rollback/recovery plan.

## D. HTTP and payment safety gate

- [ ] Real JWT HTTP tests cover customer/provider/admin roles, cross-tenant access, forged actor, expired token, idempotency conflict, stale version/hash and log redaction.
- [ ] Payment entrypoint inventory is signed off: create-link, existing pending link, zero-value payment, status polling, admin confirm, simulator confirm/cancel, PayOS webhook, pending-checkout resumption.
- [ ] Central readiness guard validates every rental provider and exact accepted version/hash/fingerprint at initiation **and** finalization; legacy and photography-only paths retain current behavior.
- [ ] Booking hold expiry, cancellation and item/reschedule mutations are serialized against payment binding; no unguarded read-then-write status overwrite.
- [ ] Duplicate and late/out-of-order PayOS events, booking expiry during payment, and success-with-finalization-failure have durable testable recovery paths.
- [ ] Deployed webhook checksum configuration and simulator isolation are verified.
- [ ] Targeted and full backend tests/build, relevant frontend build and e2e tests have recorded commands/exit codes. Compare any failures to the eight reproduced baseline failures; do not declare PASS while new failures exist.

## E. Authorization to proceed

| Scope | Approval required | Current status |
| --- | --- | --- |
| Phase 5 source implementation | Explicit user approval after reviewing this plan, risk matrix and decisions above | **NOT APPROVED** |
| Application DB migration/index change | Separate operational approval after preflight/backup/rehearsal | **NOT APPROVED** |
| `CONTRACTS_V2_ENABLED` activation/canary | Separate release approval after runtime and security gates | **NOT APPROVED** |
| PDF generation | Separate scope approval | **NOT APPROVED** |

Approval record to fill later: approver, date, selected decisions, approved scope, rollout target, rollback owner, evidence links. Empty boxes are blockers, not implied consent.
