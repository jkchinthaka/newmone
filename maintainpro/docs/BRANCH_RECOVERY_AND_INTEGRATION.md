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

Canonical line (continue here):

0. Phase 0 — Audit (`maintainpro/phase-00-audit`)
1. Phase 1 — Scope cleanup (`maintainpro/phase-01-scope-cleanup` @ `d954360`)
2. Phase 2 — Responsive Web / PWA (`maintainpro/phase-02-responsive-pwa` @ `e18a58c`)
3. Phase 3 — Organization & Functional Locations (`maintainpro/phase-03-organization-locations` @ `b8d53ff`)
4. Phase 4 — Universal Asset Engine (`maintainpro/phase-04-universal-assets` @ `a50b6b9624b1a0f281e20095badf453d7ab02fdb`)
5. Phase 5 — Maintenance Requests & Triage (`maintainpro/phase-05-requests-triage` @ `6b5948032d2226b7938bbac52ea4931db79110d6`)
6. Phase 6 — Work Order Core (`maintainpro/phase-06-work-orders` @ `bb48180af64f9d5bae066f9c6428911450989585`)
7. Phase 7 — Approval Engine (`maintainpro/phase-07-approval-engine` @ `b871a8da7d2b5f8782f39ff6e9719622ae55aa25`)
8. Phase 8+ — Canonical integration on `maintainpro/integration-v1` (starts from Phase 7 tip; historical Phase 8–14 are reference only)

Do **not** merge Phase 8–14 directly into `main` before those phases exist.

Phase 8 historical branch `maintainpro/phase-08-maintenance-planning` @ `844f176` remains untouched. Canonical planning lives on `integration-v1`.

Phase 9 historical branch `maintainpro/phase-09-parts-erp-vendors` @ `1562147` remains untouched. Canonical parts/ERP/vendors live on `integration-v1` (baseline `9d18b59`). Supplier is the Vendor entity; no competing Vendor model.

Phase 10 historical branch tip @ `96fbe49` remains untouched (REFERENCE ONLY). Canonical fleet lifecycle lives on `integration-v1` (baseline `465c73d`). `_p10_extract/` has been removed after integration. Vehicle = Asset extension; `Vehicle.assetId` unique link established in Phase 4; full fleet lifecycle in Phase 10. Gate write path remains in `vehicles.service.gateOut`; `FleetLifecycleService.evaluateGateEligibility` is read-only.

Phase 11 historical branch tip @ `e0899df` remains untouched (REFERENCE ONLY). Canonical domain coverage lives on `integration-v1` (baseline `3e96648`). `_p11_extract/` has been removed after integration. `DomainProfile` is configuration metadata keyed by `AssetDomain.code` — NOT a separate engine module. All domains share the same shared WO/PM/compliance/parts/vendor engines.

Phase 12 historical branch tip @ `df16071` remains untouched (REFERENCE ONLY). Canonical admin governance lives on `integration-v1` (baseline `3694173`). `_p12_extract/` has been removed after integration. `AdminGovernanceModule` is a standalone Nest module (no schema changes). `evaluateUserDeactivation` is wired into `UsersService.applyProtectedUserStatusUpdate` for tenant-ADMIN and TECHNICIAN open WO protections. No go-live/delivery/QA/billing admin clutter.

Phase 13 historical branch tip @ `4a8499c` (origin/maintainpro/phase-13-ux-reports) remains untouched (REFERENCE ONLY). Canonical UX Reports & KPI Role Dashboards live on `integration-v1` (baseline `15e5f67`). `_p13_extract/` has been removed after integration. `ReportingKpisModule` is a standalone Nest module (no schema changes). KPI formula version `2026-09-15.v1`. Single Home entry maintained at `/action-center`. N/A ≠ 0 invariant enforced for MTBF and other INSUFFICIENT_DATA KPIs.

Phase 14 historical branch tip @ `ce38e89` (origin/maintainpro/phase-14-production) remains untouched (REFERENCE ONLY). Canonical production hardening & go-live docs live on `integration-v1` (baseline `dacae29`). `_p14_extract/` has been removed after integration. Phase 14 delivers: acceptance coverage map (33 items), hardening tests (20+), production readiness report (verdict: READY FOR STAGING UAT), UAT runbook, go-live checklist, migration runbook, data disposition report, root alias deployment/rollback pointers. No new Prisma models. No new API routes. Soft-retired modules remain registered. Main merge recommendation: NO until go-live blockers cleared.

Phase 7 must not cherry-pick Phase 8–14. Procurement Part/PO approvals stay domain-separate. Gate uses hook only until Phase 10.

Phase 6 must not cherry-pick Phase 8–14. OVERDUE is derived; TECHNICIAN_COMPLETED remains the tech-completion step (UI: Completed).

Phase 5 must not cherry-pick Phase 8–14. FacilityIssue remains until proven migration; SupportTicket stays out of MR scope.

Phase 4 must not cherry-pick Phase 8–14. Vehicle↔Asset link is preparatory only; Fleet depth remains Phase 10.

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
| Phase 13 tip (reference) | `4a8499c` |
| Phase 14 tip (reference) | `ce38e89` |
| integration-v1 Phase 14 baseline | `dacae29` |
| Common merge-base (all lines) | `290bf3a` |
