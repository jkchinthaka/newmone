# MaintainPro UAT Index (UAT-007 – UAT-023)

**Document owner:** QA Lead + Engineering  
**Last updated:** 2026-07-02  
**Staging reference:** Web `https://newmone.chinthakajayaweera1.workers.dev` · API `https://newmone.onrender.com/api`  
**Credentials:** Secret manager only — never commit passwords or connection strings.

This index tracks enterprise UAT phases from workforce planning through security/RBAC go-live certification. Earlier phases (UAT-001 – UAT-006) are documented in [UAT_CHECKLIST.md](../UAT_CHECKLIST.md) and [PRODUCTION_GO_LIVE_DECISION_PACK.md](../PRODUCTION_GO_LIVE_DECISION_PACK.md).

---

## Phase summary

| UAT | Phase name | Purpose | Status | Baseline commit | Validation command |
|-----|------------|---------|--------|-----------------|-------------------|
| **UAT-007** | Workforce Planning | Multi-assignee work orders, conditional asset validation, workload dashboard, leave/capacity checks on assignment API | **Completed** (PARTIAL PASS) | `d469a34` | `npm run uat:007:validate` |
| **UAT-008** | Work Order History | Merge legacy FMS context into WO History tab; admin-only raw archive; read-only history API | **Completed** (PARTIAL PASS) | `e9b8393` | `npm run uat:008:validate` |
| **UAT-009** | Work Order Governance | WO approve/reject, supervisor verification, completion governance, high-cost evidence tracking | **Completed** | `e145870` | Via `uat:010:validate` chain |
| **UAT-010** | Parts & Inventory Governance | Part request maker-checker, issue/return controls, negative-stock prevention, duplicate detection | **Completed** | `de38c96` | `npm run uat:010:validate` |
| **UAT-011** | Maintenance Exception Reports | Maintenance risk score, exception dashboard, governance-aligned counts (UAT-009/010) | **Completed** | `3c68b1d` | `npm run uat:011:validate` |
| **UAT-012** | Evidence & QR Verification | Before/after evidence requirements, QR mismatch blocks, evidence storage readiness | **Completed** | `97431e5` | `npm run uat:012:validate` |
| **UAT-013** | Vendor Repair & Invoicing | External repair quotations, invoice controls, vendor repair tab on WO detail | **Completed** | `ab1c26b` | `npm run uat:013:validate` |
| **UAT-014** | Role-Based Queues | Smart views, queue grouping, role-scoped work order boards | **Completed** | `5d6762e` | `npm run uat:014:validate` |
| **UAT-015** | Work Order Taxonomy | Category/taxonomy filters, taxonomy suggest/search, category-wise reporting | **Completed** | `0057e2d` | `npm run uat:015:validate` |
| **UAT-016** | API Stabilization | Work order API resilience, queue summary performance, taxonomy suggestion stability on Render | **Completed** | `1e7e627` | Covered by UAT-017 regression |
| **UAT-017** | Deployment Readiness | Public health endpoints, database-unavailable handling, deployment-readiness API, Cloudflare build | **Completed** | `d879d60` (perf chain) | `npm run uat:017:validate` |
| **UAT-018** | Navigation & Workspaces | Role-based navigation, persona workspaces, action center alignment | **Completed** | `ee30b22` | `npm run uat:018:validate` |
| **UAT-019** | High-Volume Work Orders | Bulk actions, advanced filters, queue summary at scale | **Completed** | `0d66e1d` | `npm run uat:019:validate` |
| **UAT-020** | Fraud & Off-System Prevention | Maker-checker enforcement, anti-fraud policy, gate/parts/invoice controls | **Completed** | `eac328d` | `npm run uat:020:validate` |
| **UAT-021** | Management Intelligence | Profitability summary, management intelligence reports, finance-role gating | **Completed** | `d371733` | `npm run uat:021:validate` |
| **UAT-022** | Security RBAC & Go-Live Pack | Backend RBAC audit, permission matrix, audit standard, developer-protection docs | **In progress** | — | `node scripts/generate-backend-rbac-audit.mjs` + security tests |
| **UAT-023** | Pilot Rollout & Go-Live Readiness | Pilot plan, performance/backup/security reports, training, SOPs, cutover & monitoring | **In progress** | TBD | Manual checklist + `npm run smoke:deploy` |

---

## UAT-023 deliverables (in progress)

| Artifact | Path | Status |
|----------|------|--------|
| Pilot rollout plan | [pilot-rollout-plan.md](pilot-rollout-plan.md) | Complete |
| Performance test report | [performance-test-report.md](performance-test-report.md) | Complete |
| Backup/restore test report | [backup-restore-test-report.md](backup-restore-test-report.md) | Complete |
| Security review report | [security-review-report.md](security-review-report.md) | Complete |
| Management sign-off | [management-sign-off.md](management-sign-off.md) | Template |
| Final go-live checklist | [final-go-live-checklist.md](final-go-live-checklist.md) | Complete |
| Pilot support process | [pilot-support-process.md](pilot-support-process.md) | Complete |
| Pilot feedback form | [pilot-feedback-form.md](pilot-feedback-form.md) | Complete |
| Live monitoring plan | [live-monitoring-plan.md](live-monitoring-plan.md) | Complete |
| Cutover plan | [cutover-plan.md](cutover-plan.md) | Complete |
| Role training packs | [training/](training/) | Complete (7 files) |
| Standard operating procedures | [sop/](sop/) | Complete (12 files) |

---

## UAT-022 deliverables (in progress)

| Artifact | Path | Status |
|----------|------|--------|
| Permission matrix | [permission-matrix.md](permission-matrix.md) | Draft |
| Backend RBAC audit | [backend-rbac-audit.md](backend-rbac-audit.md) | Generated (347 PASS / 24 TODO) |
| Audit trail standard | [audit-trail-standard.md](audit-trail-standard.md) | Complete |
| Anti-fraud policy | [anti-fraud-policy.md](anti-fraud-policy.md) | Complete |
| Developer protection pack | [developer-protection/](developer-protection/) | In progress |
| Security RBAC tests | `apps/api/test/security-rbac-audit.spec.ts` | Complete |

---

## Regression chain (recommended before production cutover)

Run from `maintainpro/` on the approved release branch:

```bash
npm run uat:021:validate    # Full chain through management intelligence
npm run uat:020:validate    # Fraud control regression
node scripts/generate-backend-rbac-audit.mjs
npm run smoke:deploy
```

For cutover-specific operator tasks, see [developer-protection/deployment-checklist.md](developer-protection/deployment-checklist.md) and [PRODUCTION_OPERATOR_CHECKLIST.md](../PRODUCTION_OPERATOR_CHECKLIST.md).

---

## Known partial-pass items (carry forward)

| Area | UAT | Gap | Mitigation |
|------|-----|-----|------------|
| Roster CRUD UI | UAT-007 | Schema seeded; full UI roadmap | Use workforce API; manual roster entry |
| Skill suggestion engine | UAT-007 | Designation filter only | Manager assigns manually |
| Legacy FMS localStorage | UAT-008 | Not in API | Admin archive for historical rows |
| Evidence byte upload | UAT-012 | Staging `STORAGE_MODE=disabled` | Enable Cloudinary/MinIO at cutover |
| Notification routes RBAC | UAT-022 | 24 TODO endpoints in RBAC audit | Document exceptions; tighten before expansion |
| FINANCE role | UAT-021 | `FINANCE_APPROVER` string role, not Prisma `RoleName` | Assign via custom role mapping or MANAGER/OPS with `purchase_orders.approve_finance` |

---

## Sign-off reference

Formal UAT sign-off uses [developer-protection/uat-sign-off-template.md](developer-protection/uat-sign-off-template.md). Production go/no-go remains governed by [PRODUCTION_GO_LIVE_DECISION_PACK.md](../PRODUCTION_GO_LIVE_DECISION_PACK.md) until operator checklist completion.
