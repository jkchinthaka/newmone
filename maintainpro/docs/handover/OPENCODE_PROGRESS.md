# OpenCode Progress — Go-Live Ops Track

**Branch:** `chore/golive-ops`  
**Base:** `origin/release/maintainpro-final-consolidation-20261013`  
**Started:** 2026-10-19  
**Target:** Go-live 2026-10-21, Code freeze 2026-10-20 18:00

---

## Task B — Go-Live Ops Pack (Docs & Scripts Only) ✅ COMPLETE

### Files Created

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

---

## Task A — Save-Mapping Tests (Phase 2) 🔄 IN PROGRESS

### Setup (Pending)
- [ ] `npm install` in golive-ops worktree
- [ ] `prisma generate` + 3 phase15 patch scripts
- [ ] Create disposable DB `maintainpro_e2e_save` on localhost
- [ ] Apply migrations + UAT/e2e seed (SEED_DEMO=false)
- [ ] Test backup script against disposable DB
- [ ] Start stack: API 3050, Web 3051 (build/start:qa, no watch)

### Test Spec: `apps/web/e2e-real/save-mapping.spec.ts` (Pending)
12 flows to implement:
1. WO create
2. WO assign/reassign
3. My Jobs start/hold/resume
4. WO complete with before + after photo upload
5. WO verify/close
6. WO cancel
7. Approvals approve/reject
8. Parts request and issue
9. Meter reading
10. Vendor repair quotation with tax 18%
11. Admin asset create + tag upload
12. Admin user create + role assign

### For Each Flow: Check
- [ ] Valid submit → success message
- [ ] Page RELOAD → value persists
- [ ] SQL check: DB row + audit row exist
- [ ] Invalid input → field-named error, no partial row
- [ ] Double-click submit → exactly 1 row

### Results File: `docs/handover/SAVE_MAPPING_RESULTS.md` (Pending)
Format: flow | save | reload | DB | audit | invalid | double-click | FAIL detail (repro + suspected file:line)

---

## Git Status

```bash
# Current branch
git branch --show-current
# chore/golive-ops

# Files staged for commit
git status --short
```

---

## Next Actions

1. Commit Task B files on `chore/golive-ops`
2. Push branch to origin
3. Begin Task A setup (npm install, prisma generate, patches)
4. Create disposable DB and run backup test
5. Build save-mapping.spec.ts for 12 flows
6. Execute tests, document results
7. Stop stack on 3050/3051
8. Final commit + push

---

## Blockers / Notes

- None currently
- Cursor works in separate worktree (`release-final-20261013`) on ports 3040/3041 with DB `maintainpro_e2e_wo_verify` — no conflict
- Must not touch that worktree, ports, or DB