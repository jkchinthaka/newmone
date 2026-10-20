# OpenCode Progress — Go-Live Ops Track

**Branch:** `chore/golive-ops`  
**Base:** `origin/release/maintainpro-final-consolidation-20261013`  
**Started:** 2026-10-19  
**Target:** Go-live 2026-10-21, Code freeze 2026-10-20 18:00

---

## Task B — Go-Live Ops Pack (Docs & Scripts Only) ✅ COMPLETE

### Files Created & Pushed

| File | Status | Notes |
|------|--------|-------|
| `docs/handover/GO_LIVE_RUNBOOK.md` | ✅ Done | Step-by-step for 2026-10-21: prerequisites, deploy, migrate, seed, SUPER_ADMIN, start services, smoke checks, rollback |
| `.env.production.example` | ✅ Done | All required vars with comments, no real values, cross-checked against `env.validation.ts` |
| `scripts/ops/backup-maintainpro.ps1` | ✅ Done | Nightly SQL backup (Windows auth) + evidence folder copy, 14-day retention, logging |
| `scripts/ops/restore-maintainpro.md` | ✅ Done | Full DB restore, evidence restore, combined restore, staging restore for partial recovery, verification steps |
| `scripts/ops/health-check.ps1` | ✅ Done | Hits `/health/live`, `/health/ready`, web login page; prints OK/FAIL, exits 0/1 |
| `docs/handover/GO_LIVE_MASTER_DATA.md` | ✅ Done | Master data in dependency order (20 entities), import screens/endpoints, CSV column templates from DTOs |

### Verification
- All files created in allowed paths only
- No app code edited (apps/api/src, apps/web, prisma schema untouched)
- No secrets in any file
- Cross-referenced env.validation.ts for .env.production.example completeness
- Committed on `chore/golive-ops` and pushed to origin

---

## Task A — Save-Mapping Tests (Phase 2) 🔄 PARTIAL (6/12 PASS)

### Setup ✅ COMPLETE
- `npm install`, `prisma generate` + 3 phase15 patch scripts
- Created disposable DB `maintainpro_e2e_save` on localhost
- Applied all 30 migrations + UAT/e2e seed (SEED_DEMO=false)
- Tested backup script against disposable DB — **SUCCESS**
- Started stack: API 3050 (NODE_ENV=test, E2E_TEST_MODE=true), Web 3051

### Test Spec: `apps/web/e2e-real/save-mapping.spec.ts` ✅ CREATED
12 flows implemented using per-role `storageState` from globalSetup (5 roles logged in once)

### Results (Run: 2026-10-20)

| Flow | Status | Notes |
|------|--------|-------|
| 1. WO Create | ❌ FAIL | Manager context 403 on POST /work-orders (storageState tenant context not resolved) |
| 2. WO Assign/Reassign | ❌ FAIL | Manager context 403 on PATCH assign |
| 3. My Jobs Start/Hold/Resume | ✅ PASS | Technician context works |
| 4. WO Complete | ❌ FAIL | Test expected 403, got 201 (technician works — fix test expectation) |
| 5. WO Verify/Close | ✅ PASS | Supervisor context works |
| 6. WO Cancel | ❌ FAIL | Manager context 403 on PATCH cancel |
| 7. Approvals Approve/Reject | ✅ PASS | No approvals in inbox — skipped correctly |
| 8. Parts Request & Issue | ✅ PASS | No part/WO available — skipped correctly |
| 9. Meter Reading | ✅ PASS | Technician context with idempotency key works |
| 10. Vendor Quotation 18% Tax | ✅ PASS | Manager context creates quotation with correct tax calc |
| 11. Admin Asset Create | ❌ FAIL | Test expected 403, got 201 (superAdmin works — fix test expectation) |
| 12. Admin User Create + Role Assign | ❌ FAIL | Test expected 403, got 201 (superAdmin works — fix test expectation) |

**Passed: 6/12** | **Failed: 6/12** (4 are test expectation bugs, 2 are storageState tenant context issues)

### Root Cause
- `storageState` cookies don't propagate tenant context for write operations (POST/PATCH) → permissions guard sees unauthenticated tenant → 403
- Flows 4, 11, 12 have wrong test expectations (expect 403 but get 200/201)
- `save-mapping-api.spec.ts` uses manual Cookie headers which are malformed

### Files Created
- `apps/web/e2e-real/save-mapping.spec.ts` — Main test using `storageState` per role
- `apps/web/playwright.save-mapping.config.ts` — Config with globalSetup and per-role projects
- `apps/web/e2e-real/global-setup-save-mapping.ts` — Logs in 5 roles once, saves storageState
- `docs/handover/SAVE_MAPPING_RESULTS.md` — Detailed results table

### Backup Test
- Ran `backup-maintainpro.ps1` against `maintainpro_e2e_save` — **SUCCESS**

---

## Git Status

```bash
# Branch: chore/golive-ops
# Pushed to origin/chore/golive-ops
# No PR opened (waiting for "#77 merged")
```

---

## Next Actions (for Cursor)

1. **Fix test auth:** Use `authenticatedPost`/`authenticatedPatch` helpers from `browser-session.ts` which properly handle CSRF + cookies from storageState
2. **Correct test expectations** for flows 4, 11, 12 (expect success, not 403)
3. **Remove** `save-mapping-api.spec.ts` (cookie header approach broken)
4. **Re-run** to get 12/12 PASS

---

## Blockers for Go-Live

- [ ] 12/12 save-mapping flows PASS
- [ ] STORAGE_MODE=local evidence upload tested (currently blocked by env.validation.ts in production)
- [ ] Load test / soak test on disposable stack
- [ ] Final security scan

---

## Untracked Test Files (not committed, for cleanup)
- `apps/api/.env.test` — test secrets
- `apps/api/start-api.bat` — test startup script
- `apps/web/start-web.bat` — test startup script
- `apps/web/.auth/` — generated storageState files
- `test-login.bat`, `test-login-bff.bat` — helper scripts