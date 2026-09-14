# MaintainPro — Branch Recovery and Integration Rule

**Date:** 2026-09-14  
**Repository:** `https://github.com/jkchinthaka/newmone.git`  
**Status:** Binding process rule until V1 integration is complete

---

## Do not merge yet

- Do **not** merge `maintainpro/phase-14-production` (or any Phase 8–14 branch) into `main`.
- Do **not** merge any phase into `main` until the final integrated branch passes full CI/UAT.

---

## Two diverged lines (current fact)

Both lines fork from the same `main` tip (`290bf3a`). They are **not** sequential with each other.

| Line | Branches | Role |
|------|----------|------|
| **Canonical foundation** | `maintainpro/phase-00-audit` → `maintainpro/phase-01-scope-cleanup` | Continue from here |
| **Provisional engines** | `phase-08` … `phase-14-production` | Keep as historical/reference; do not discard; do not treat as final |

Phases **2–7 have not been implemented** as the required sequential foundation. Phase 8–14 work is provisional until reconciled after Phase 7.

---

## Mandatory execution order (now)

Continue from completed Phase 1 tip (`maintainpro/phase-01-scope-cleanup` @ `b108e76`):

1. Phase 2 — Responsive Web / PWA  
2. Phase 3 — Organization & Functional Locations  
3. Phase 4 — Universal Asset Engine  
4. Phase 5 — Maintenance Requests & Triage  
5. Phase 6 — Work Order Core  
6. Phase 7 — Approval Engine  

Do **not** merge Phase 8–14 directly into `main` before those phases exist.

---

## After Phase 7 — integration

1. Create dedicated branch from Phase 7 tip: `maintainpro/integration-v1`
2. Selectively integrate existing Phase 8–14 commits **in order**:
   Phase 8 → 9 → 10 → 11 → 12 → 13 → 14
3. Preferred methods: compare against Phase 7 foundation; cherry-pick where clean; manually port where schema/logic changed
4. Never blindly overwrite newer Phase 2–7 models
5. Resolve schema conflicts in favour of the Master Implementation Instruction
6. Preserve useful tests; rewrite only where architecture legitimately changed

### After each integration step

1. Prisma validation/generation  
2. Typecheck  
3. API tests  
4. Relevant web tests  
5. Build  
6. Fix regressions  
7. Update `IMPLEMENTATION_LOG.md`  
8. Commit  
9. Push `maintainpro/integration-v1`  

Do not claim Phase 8–14 final until they pass again on top of Phase 0–7 architecture.

---

## Git safety

- No force-push  
- No rewrite of existing phase branch history  
- Keep Phase 8–14 branches as historical/reference; do not delete them  

---

## Final V1 dependency order

```text
Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7
  → integrated 8 → 9 → 10 → 11 → 12 → 13 → 14
```

Target: one coherent production system on a single integrated line — not independent phase branches with conflicting architectures.

---

## Reference SHAs (at rule capture)

| Ref | SHA |
|-----|-----|
| `origin/main` | `290bf3a` |
| Phase 0 tip | `f78d465` |
| Phase 1 tip (continue from) | `b108e76` |
| Phase 8 tip | `844f176` |
| Phase 14 tip (do not merge) | `ce38e89` |
| Common merge-base (all lines) | `290bf3a` |
