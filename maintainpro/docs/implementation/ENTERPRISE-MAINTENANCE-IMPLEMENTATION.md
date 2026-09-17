# Enterprise Maintenance Implementation Ledger

Branch: `maintainpro/phase-15-sqlserver-migration`  
Updated: 2026-09-17 (downtime / RCA / permits batch)

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
| Condition-based maintenance | PARTIAL | PARTIAL | N | N | — | — | N | N | PARTIAL |
| Safety / Permit / LOTO | PARTIAL | Permit Y / LOTO N | Y | PARTIAL | Y | Y | Y | Y | PARTIAL |
| Parts reserve / ERP handoff | PARTIAL | PARTIAL | N | PARTIAL | Y | Y | PARTIAL | PARTIAL | PARTIAL |
| Vendor portal | N | N | N | N | — | — | N | N | NOT_IMPLEMENTED |
| Offline PWA | N | N | N | N | — | — | N | N | DEFERRED |
| Advanced analytics | PARTIAL | PARTIAL | N | PARTIAL | Y | Y | — | PARTIAL | PARTIAL |

## This continuation

| Item | Status | Notes |
|------|--------|-------|
| `DowntimeSegment` multi-period downtime | IMPLEMENTED | Open/close; category hours summary |
| `RcaCase` + `CapaAction` + repeat-failure flag | IMPLEMENTED | Configurable window via `ReliabilityPolicy` |
| `WorkPermit` + start gate for critical assets | IMPLEMENTED | WO `IN_PROGRESS` blocked with `SAFETY_BLOCK` |
| Asset criticality admin | IMPLEMENTED | Reuses `Asset.criticalityLevel`; Admin UI |
| ConfigChangeHistory for policy/criticality | IMPLEMENTED | |

## Commits

- Prior: `7f593d30` (feature flags / templates / warranty)
- This batch: downtime / RCA / permits (pending push)

## Validation

- migrate `20260917200000_downtime_rca_permits` — pending run
- tests `reliability-downtime-rca-permits.spec.ts` — pending run
