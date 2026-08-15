# Facility Operations Workflow Blueprint

**Source:** curated from GitHub PR #4 (`cursor/facility-workflow-blueprint-199d`, June 2026).  
**Status:** living product blueprint — **not** an instruction to rebuild MaintainPro.  
**Last reviewed:** 2026-08-15 against current NestJS + Prisma MongoDB codebase.

> **Do not merge PR #4 as-is.** Its README rewrite and master agent prompt are obsolete.  
> This file keeps only still-useful facility-operations guidance, aligned with today’s architecture.

## Related docs (prefer these for implementation)

| Document | Use when |
|----------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Current modular monolith, guards, data topology |
| [BUILDING_FACILITY_MODULE_PLAN.md](BUILDING_FACILITY_MODULE_PLAN.md) | Historical FAC-* plan (parts superseded — see status matrix below) |
| [FACILITY_LOCATION_BACKFILL_RUNBOOK.md](FACILITY_LOCATION_BACKFILL_RUNBOOK.md) | Location backfill operations |
| [ENTERPRISE_ROADMAP.md](ENTERPRISE_ROADMAP.md) | Prioritized platform roadmap |
| [ROLE_MATRIX.md](ROLE_MATRIX.md) | Current roles/permissions |
| systems/FG_SYNC.md (under `maintainpro/systems/`) | FG Digital Recording unified Mongo integration |

## Current architecture anchors (do not reinvent)

- **API:** NestJS modular monolith (`apps/api/src/modules/*`)
- **Web:** Next.js App Router (`apps/web`)
- **Mobile:** Flutter + Riverpod (`apps/mobile`)
- **Data:** single Prisma schema → MongoDB (`prisma/schema.prisma`); dual DB replication remains MaintainPro-owned
- **Tenancy / auth:** `tenantId` + JWT + RolesGuard + PermissionsGuard
- **Facility domain modules today:** `facilities`, `cleaning`, plus shared `work-orders`, `assets`, `inventory`, `utilities`, `procurement`

```text
Property → Building → Floor → Room
                              ├── FacilityIssue (optional roomId, workOrderId)
                              ├── CleaningLocation (cleaning vertical)
                              └── Asset (reuse — do not fork a second asset register)
                                      └── WorkOrder (execution engine)
```

## Implementation status matrix

Legend: **DONE** = present in schema/API/UI; **PARTIAL** = usable but incomplete; **FUTURE** = blueprint aspiration only.

| Area | Status | Notes |
|------|--------|-------|
| Property → Building → Floor → Room hierarchy | **DONE** | Prisma models + `facilities` module + `/facilities` UI |
| Facility roles (`FACILITY_MANAGER`, `BUILDING_SUPERVISOR`, `CLEANER`) | **DONE** | In `RoleName` + navigation |
| Facility issues (severity, SLA, photos, category) | **DONE** | `FacilityIssue` + `/cleaning/issues` |
| Issue → Work Order bridge | **DONE** | `FacilityIssue.workOrderId` + bridge tests |
| Facility dashboard / aging / reports | **DONE / PARTIAL** | `/facilities`, `/facilities/reports`, aging views |
| Cleaning visits, QR, checklists, sign-off | **DONE** | `/cleaning/*` + mobile cleaning screens |
| Utilities meters/bills | **DONE / PARTIAL** | `utilities` module + `/utilities` |
| Work order lifecycle (assign, parts, evidence) | **DONE / PARTIAL** | Core CMMS; approval builder / mobile signature still roadmap |
| Inventory + procurement | **DONE / PARTIAL** | Spare parts, POs; ERP sync is separate (do not redesign here) |
| Vendor repair cases / quotations / invoices | **PARTIAL** | Models exist; full vendor *portal* UX is **FUTURE** |
| Dedicated requester / public portal | **FUTURE** | Intake today is authenticated app flows |
| Full preventive-maintenance scheduler (calendar/meter auto-WO) | **PARTIAL / FUTURE** | Maintenance module exists; blueprint PM engine not fully productized |
| Budgeting module | **FUTURE** | Not a first-class domain module |
| Power BI native connector | **FUTURE** | Prefer CSV/JSON export + reports module first |
| Predictive maintenance (rules/AI) | **PARTIAL / FUTURE** | `predictive-ai` hooks + roadmap rules; not full facility PM AI |
| Document management (building library) | **PARTIAL** | Evidence/attachments + vehicle docs; not a full DMS |
| FG Digital Recording (`/fg`) | **IN PROGRESS (separate track)** | Shared Mongo `maintainpro_prod` / `fg_*` — do not fold into facility blueprint work |

## Product identity (still valid)

- **Product:** MaintainPro  
- **Facility lens:** buildings, locations, repair requests, work orders, cleaning, utilities, and management reporting in one tenant-aware system  
- **Rule:** extend existing Work Order / Asset / Inventory engines — **never** duplicate them under a second “facility CMMS”

## Core operating model (target workflow)

Useful as the long-term facility repair story. Today’s primary path is **FacilityIssue → WorkOrder**.

```text
Requester reports issue
  → Facility team reviews / classifies
  → Priority, SLA, location, asset, category assigned
  → Technician or vendor assigned (via Work Order)
  → Parts, permits, approvals checked
  → Work executed with notes, photos, labor, parts
  → Supervisor verifies completion
  → Requester sign-off or reopen (partial / future portal)
  → Costs, documents, audit, reports updated
```

## Location hierarchy (implemented shape)

```text
Tenant
  → Property
    → Building
      → Floor
        → Room / Area
          → FacilityIssue / CleaningLocation / Asset
            → WorkOrder (execution)
```

## Recommended navigation (mapped to current routes)

| Blueprint idea | Current route / module |
|----------------|------------------------|
| Facilities / hierarchy | `/facilities` |
| Facility reports / aging | `/facilities/reports`, aging views |
| Facility issues | `/cleaning/issues` |
| Cleaning operations | `/cleaning`, visits, scan, sign-off, analytics, locations |
| Work orders | `/work-orders` |
| Assets | `/assets` |
| Inventory / procurement | `/inventory`, `/procurement` |
| Utilities | `/utilities` |
| Admin | `/settings`, admin console |
| FG quality recording | `/fg/` (nginx-prepared; separate system) |

Roles such as **VENDOR** / **REQUESTER** as first-class product personas remain **FUTURE** unless already seeded; do not invent RBAC that conflicts with [ROLE_MATRIX.md](ROLE_MATRIX.md).

## Repair categories (still useful taxonomy)

Keep as product vocabulary when extending `FacilityIssueCategory` / WO taxonomy:

- Electrical, Plumbing, HVAC / AC, Lift / elevator  
- Civil, Carpentry, Painting, Cleaning, Pest control  
- Fire safety, Security, Utility, General maintenance  

## Status flows (target vs today)

### Target repair-request flow (blueprint)

```text
Submitted → Under Review → Approved → Converted to Work Order
  → Assigned → In Progress → Completed → Supervisor Verified
  → Requester Signed Off → Closed
```

Exception statuses (target): Rejected, Duplicate, On Hold, Waiting for Parts/Vendor/Approval, Reopened, Cancelled.

### Today

- `FacilityIssue` uses its own `FacilityIssueStatus` lifecycle (open → assigned/resolved/closed patterns).  
- Execution after conversion uses the **Work Order** status machine.  
- Do not replace WO statuses with the blueprint diagram; bridge them.

## Preventive maintenance (future depth)

Still useful as a backlog definition:

- Calendar, meter, condition, and compliance-based schedules  
- Auto-create Work Orders, checklist templates, compliance % reports  

Implement only by extending `maintenance` / work-order scheduling — not a parallel PM product.

## Vendor portal (future)

Useful backlog: approved vendor companies, assigned jobs, quotations, progress, invoices, document expiry.  
Partial backend entities already exist (`VendorRepairCase`, `VendorQuotation`, `VendorInvoice`) — deepen those rather than starting a new vendor schema.

## Cleaning integration (mostly done)

Blueprint cleaning records/reports largely map to the live cleaning module. Prefer extending `/cleaning/*` over redesigning facility navigation.

## Dashboard KPIs (keep as checklist)

| KPI family | Status |
|------------|--------|
| Open facility issues, SLA breach, aging | **DONE / PARTIAL** |
| Building / room open-work heatmaps | **PARTIAL** |
| Cleaning compliance / missed visits | **DONE / PARTIAL** |
| Technician workload | **PARTIAL** (WO + workforce planning roadmap) |
| Executive cost by building | **FUTURE / PARTIAL** via reports |

## Security and tenancy (non-negotiable)

Unchanged and already platform policy:

1. Every facility record is tenant-scoped.  
2. No cross-tenant reads/writes.  
3. Role + permission checks on mutations.  
4. Audit sensitive creates/updates/status transitions.  
5. Never commit secrets, production URIs, or dump production data into docs/tests.

## Explicit non-goals for this blueprint

- Do **not** overwrite `README.md` with the June 2026 PR README.  
- Do **not** re-run obsolete “Phase 1 security rebuild” from the old master prompt.  
- Do **not** change `fix/live-production-remediation`, production data, FG Mongo cutover behavior, or ERP Excel/sync design via this document.  
- Do **not** treat Power BI / budgeting / requester portal as committed delivery.

## Suggested implementation order (remaining work only)

1. Close remaining facility UX gaps (hierarchy polish, issue filters, report exports).  
2. Deepen issue↔WO↔parts evidence loops where PARTIAL.  
3. Vendor portal UX on existing vendor models.  
4. PM scheduler maturity on maintenance module.  
5. Requester portal (authenticated first; public later).  
6. Budgeting / Power BI only after export APIs are stable.

For agent execution of remaining work, see the trimmed [FACILITY_OPERATIONS_REMAINING_WORK_PROMPT.md](FACILITY_OPERATIONS_REMAINING_WORK_PROMPT.md) (replacement for the obsolete PR #4 master prompt).
