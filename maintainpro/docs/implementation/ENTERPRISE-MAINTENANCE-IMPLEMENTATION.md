# Enterprise Maintenance Implementation Ledger

Branch: `maintainpro/phase-15-sqlserver-migration`  
Updated: 2026-09-17 (CBM + LOTO batch)

## Remaining-work matrix (audit)

| Feature | DB | Backend | Admin | Ops UI | RBAC | Tenant | History | Tests | Status |
|---------|----|---------|-------|--------|------|--------|---------|-------|--------|
| Compact JWT / session | — | Y | — | Y | Y | Y | — | Y | IMPLEMENTED |
| Unified jobDomain engine | Y | Y | Y | Y | Y | Y | Y | Y | IMPLEMENTED |
| Job categories / Priority SLA / codes / reasons / config history | Y | Y | Y | Y | Y | Y | Y | Y | IMPLEMENTED |
| Checklist templates + WO snapshot | Y | Y | Y | PARTIAL | Y | Y | Y | Y | IMPLEMENTED |
| Feature flags / module control | Y | Y | Y | Nav filter | Y | Y | Y | Y | IMPLEMENTED |
| MaintenanceTemplate + WO snapshot | Y | Y | Y | PARTIAL (create path) | Y | Y | Y | Y | IMPLEMENTED |
| Warranty + recovery claims | Y | Y | Y | Y | Y | Y | Y | Y | IMPLEMENTED |
| Failure/RCA/CAPA workflow | Y | Y | Y | PARTIAL | Y | Y | Y | Y | IMPLEMENTED |
| Asset criticality engine | Y | Y | Y | PARTIAL | Y | Y | Y | Y | IMPLEMENTED |
| Downtime segments | Y | Y | — | API | Y | Y | Y | Y | IMPLEMENTED |
| Condition-based maintenance | Y | Y | Y | PARTIAL | Y | Y | Y | Y | IMPLEMENTED |
| Safety / Permit / LOTO | Y | Y | Y | PARTIAL | Y | Y | Y | Y | IMPLEMENTED |
| Parts reserve / ERP handoff | PARTIAL | PARTIAL | N | PARTIAL | Y | Y | PARTIAL | Y (concurrency) | PARTIAL |
| Vendor portal | N | N | N | N | — | — | N | N | NOT_IMPLEMENTED |
| Offline PWA | N | N | N | N | — | — | N | N | DEFERRED |
| Advanced analytics | PARTIAL | PARTIAL | N | PARTIAL | Y | Y | — | PARTIAL | PARTIAL |

## This continuation

| Item | Status | Notes |
|------|--------|-------|
| Downtime / RCA / Permit (`7d2d6d1d`) | IMPLEMENTED | |
| `ConditionMonitoringRule` + `ConditionEvent` + meter hook | IMPLEMENTED | Deduped OPEN events; Admin UI |
| `LotoRecord` + start gate + isolator≠verifier SoD | IMPLEMENTED | Wired on WO `IN_PROGRESS` |

## Commits

- `7d2d6d1d` downtime / RCA / permits
- This batch: CBM + LOTO (pending push)

## Validation

- migrate `20260917210000_cbm_loto` — applied
- `reliability-downtime-rca-permits.spec.ts` — 9/9 pass
- typecheck api — pass
