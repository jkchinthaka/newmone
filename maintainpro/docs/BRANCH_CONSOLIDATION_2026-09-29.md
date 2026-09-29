# Branch consolidation — 2026-09-29

**Repository:** `https://github.com/jkchinthaka/newmone.git`
**Baseline:** `origin/main` @ `028ba871` · 68 remote branches including `main`
**Integration branch:** `integration/consolidate-2026-09-29`

Every branch tip listed here is preserved as the tag
`archive/2026-09-29/branch/<branch-name>` (see
[`BRANCH_RECOVERY_AND_INTEGRATION.md`](BRANCH_RECOVERY_AND_INTEGRATION.md) for restore commands).

## Integrated in this consolidation

| Branch | Tip | Handling |
| --- | --- | --- |
| `feature/erp-excel-inventory-sync` | `100f47f7` | Genuine merge. ERP Excel import release-gate hardening (atomic claim, multi-sheet staging, ZIP magic check) had never reached `main`. |
| `fix/fg-mongo-migrations-image` | `48d96170` | Genuine merge with per-file resolution. `main` already carried this line's runtime pieces (Mongo bootstrap/image guards, vehicle-master eligibility, FG SSO PRs #25–#33). Conflicts resolved to `main`'s newer SQL Server–era code. Mongo-era deploy config that merged cleanly (`maintainpro_prod` hardcoding, env templates) was restored to `main`. Kept: curated facility docs, historical release docs, and the `fg-runtime-compose-contract` selftest. |
| `release/fg-erp-combined-candidate` | `48d96170` | Same tip as the row above. |
| `feature/fg-maintainpro-platform-integration` | `1b256e08` | Ancestor of `fix/fg-mongo-migrations-image`. |
| `cursor/facility-workflow-blueprint-199d` (PR #4) | `d9ae4771` | Merged as superseded. Commit `674cee66` deliberately curated this blueprint and marked the original prompt "do not restore". The curated content is kept. |
| `ops/phase7b-nelna-http-readiness` | `631c2631` | Genuine merge: Phase 7A/7B evidence and sign-off templates (docs only). |
| `fix/phase7a-release-candidate-stability` | `99c0be62` | Ancestor of phase 7B. |
| `fix/e2e-auth-redirect-race` | `17552737` | Merged as superseded. `main`'s `01bc6cbb` helper already handles the redirect race, with retries. |
| Local working copy `C:/Dev/newmone` (uncommitted) | snapshot `e02813cd` | Committed as `feat(maintenance): inspection execution, reliability RCA/CAPA…`, byte-identical to the snapshot. Adds two additive SQL Server migrations. |

## Already contained in `main` (tip is an ancestor of `main`)

`feature/admin-access-control`, `feature/enterprise-bulk-import`,
`feature/fg-digital-recording-integration`, `feature/fg-permission-catalog-sync`,
`fix/cpanel-windows-package-build`, `fix/enterprise-production-hardening`,
`fix/fg-recorder-scope-admin-overlap`, `fix/fg-sso-public-origin`, `fix/fg-sso-recorder-scope`,
`fix/final-live-data-qa-20260829-194417`, `fix/live-production-remediation`,
`fix/phase1-phase2-production-remediation`, `fix/phase3-release-source-alignment`,
`fix/phase5a-inventory-access-controls`, `fix/phase5b-work-order-lifecycle`,
`fix/phase5c-procurement-po-erp-controls`, `fix/phase5d-dashboard-report-audit-controls`,
`fix/phase6a-backup-restore-recovery`, `fix/phase6b-monitoring-alerting-restart`,
`fix/phase6c-production-security-hardening`, `fix/restore-fg-compose-wiring`,
`maintainpro/action-center-remediation`, `maintainpro/d1-maintenance-request-hardening`,
`maintainpro/d2-work-order-core`, `maintainpro/d6-maintenance-dashboard`,
`maintainpro/db-normalization-safe-chain`, `maintainpro/docs-pr40-handover-merge-record`,
`maintainpro/enterprise-final-implementation`, `maintainpro/entity-picker-query-contract-hotfix`,
`maintainpro/final-acceptance-validation`, `maintainpro/final-enterprise-closure`,
`maintainpro/final-handover-qa`, `maintainpro/integration-v1`, `maintainpro/phase-00-audit` …
`maintainpro/phase-07-approval-engine`, `maintainpro/phase-15-sqlserver-migration`,
`maintainpro/runtime-hci-hardening`, `maintainpro/work-order-category-hci`,
`maintainpro/work-order-create-hci`, `qa/fix-live-production-readiness`,
`test/phase4-full-stack-e2e-qa`, `test/phase7-uat-go-live-decision`,
`update_worker_name_to_newmone`.

## Patch-equivalent to `main` (squash/rebase landed)

| Branch | Evidence |
| --- | --- |
| `maintainpro/filtering-views-audit` | Tip `fcdf3caf` has a tree identical to `main`'s `028ba871`. |
| `maintainpro/d3-d5-domain-jobs` | `git cherry` marks both commits `-` (landed via PR #53). |

## Superseded by documented re-integration

`maintainpro/phase-08-maintenance-planning` … `maintainpro/phase-14-production`
(tips `844f176` … `ce38e89`). These were reference-only by rule. Each phase was
re-integrated on `maintainpro/integration-v1`, which is in `main`; see
`BRANCH_RECOVERY_AND_INTEGRATION.md` and `IMPLEMENTATION_LOG.md`.

## Retained

| Branch | Reason |
| --- | --- |
| `main` | Primary branch. |
| `feature/mobile-v2` (PR #28, open) | Flutter Mobile V2 (73 commits, 555 mobile files). `TARGET_ARCHITECTURE.md` (2026-09-14) freezes new Flutter features in favour of the PWA, so merging it is a product decision. Its backend fixes are already covered in `main` (JWTs without permissions, four-eyes gate override). |

## Integration fixes made during consolidation

- `safeInternalReturnPath` now rejects control characters. `/%09/evil.example`
  previously produced an open redirect after login. Regression tests were added.
- The FG line's `JwtStrategy` `lockedUntil` check was not adopted. `lockedUntil` is only set
  by failed-login throttling, so enforcing it on live sessions would let anyone sign users out.
- A clean auto-merge would have duplicated 10 `fg.*` keys in `scripts/lib/admin-permission-keys.mjs`
  and widened seeded ADMIN privileges. `main`'s list is kept.
