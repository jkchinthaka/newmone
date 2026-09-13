# Target Architecture (Phase 0)

**Baseline:** `origin/main` @ `290bf3a`  
**Product:** Company-wide Maintenance & Fleet Management System (CMMS)

---

## Clients

| Client | Role |
|--------|------|
| **Next.js PWA** (`apps/web`) | Primary office + field client |
| **Flutter** (`apps/mobile`) | Archive/decommission path — not pilot-certified; extract QR/offline/evidence knowledge into PWA |
| NestJS API | Single modular monolith |

---

## Logical architecture

```text
Next.js PWA (primary)     Flutter (thin / sunset)
         │                        │
         └──────────┬─────────────┘
                    ▼
         NestJS /api  (JWT → Tenant → Roles → Permissions)
                    ▼
         Tenant (isolation + optional billing)
                    ▼
         Organization UX = Tenant
         Site UX = Property (+ Building/Floor/Room)
                    ▼
    ┌───────────────┼────────────────┬──────────────┐
 Asset/Fleet     WO / PM / Req    Supply/ERP     Compliance
 (unify IDs)     Checklist/Insp    (Bileeta RO)   Docs/Cal
                    ▼
         MongoDB primary + backup outbox
```

---

## Core engines (gap vs target)

| Engine | Status on main | Notes |
|--------|----------------|-------|
| Organization / Site | PARTIAL | Property hierarchy EXISTS; naming REFACTOR |
| Asset | EXISTS / NEEDS REFACTOR | Unify with Vehicle |
| Requests | PARTIAL / DUPLICATED | FacilityIssue→WO; demo PendingRequest |
| Work Orders | EXISTS | Rich lifecycle |
| Approval | PARTIAL | WO/PR/PO stages; no configurable builder |
| PM | PARTIAL | MaintenanceSchedule; no full trigger engine on main |
| Checklist | PARTIAL | Cleaning/delivery only — generic PM MISSING |
| Inspection | PARTIAL | WO type only |
| Calibration | MISSING | Taxonomy seed only |
| Compliance | PARTIAL | Fleet docs focused |
| Parts / Bileeta | EXISTS | Bounded; mock gated |
| Vendors/contracts | PARTIAL | Supplier + vendor repair; formal AMC MISSING on main |
| Fleet | EXISTS | Heavy; gate/claims/fines |
| Admin | EXISTS / NEEDS REFACTOR | Delivery clutter |
| Data Quality | PARTIAL | BusinessException |
| PWA | PARTIAL | Manifest/SW; limited offline |
| Reports/KPIs | PARTIAL | Honest gaps in KPI matrix |

---

## Recommended RBAC baseline (do not implement in Phase 0)

Prefer ≤10 roles + permission packs:

SYSTEM_ADMIN · MAINTENANCE_MANAGER · MAINTENANCE_SUPERVISOR · TECHNICIAN · REQUESTER · STOREKEEPER · FLEET_MANAGER · FLEET_OFFICER · DRIVER · SECURITY_OFFICER · MANAGEMENT_VIEWER  

Map legacy RoleNames via aliases; do not delete enum values without migration.

---

## Tenancy recommendation

- **Keep** backend `Tenant` partitioning (high migration risk to remove).  
- **Simplify UX** to Organization / Site.  
- **Hide** SaaS tenant switching / billing for single-org Nelna deploy.  
- Site scope can layer on Property later without replacing Tenant.

---

## Mobile decommission plan

1. Freeze new Flutter features.  
2. Extract QR/offline/evidence contracts for PWA.  
3. Certify PWA field path.  
4. Archive Flutter or thin to QR+offline only.  
5. Do not destroy reusable knowledge before web parity.

---

## Common maintenance core (reuse)

Keep and strengthen: assets, work-orders, maintenance, inventory (usage), erp-integration (read/boundary), fleet/vehicles, facilities hierarchy, evidence, reports, admin (people/roles), audit, compliance (genericize).

Do not invent duplicate engines for farm/cleaning/FG.
