# Enterprise Maintenance Implementation Ledger

Branch: `maintainpro/phase-15-sqlserver-migration`  
Updated: 2026-09-17 (ERP exception center)

## Remaining-work matrix (audit)

| Feature | DB | Backend | Admin | Ops UI | RBAC | Tenant | History | Tests | Status |
|---------|----|---------|-------|--------|------|--------|---------|-------|--------|
| Compact JWT / session | — | Y | — | Y | Y | Y | — | Y | IMPLEMENTED |
| Unified jobDomain engine | Y | Y | Y | Y | Y | Y | Y | Y | IMPLEMENTED |
| Job categories / Priority SLA / codes / reasons / config history | Y | Y | Y | Y | Y | Y | Y | Y | IMPLEMENTED |
| Checklist templates + WO snapshot | Y | Y | Y | PARTIAL | Y | Y | Y | Y | IMPLEMENTED |
| Feature flags / module control | Y | Y | Y | Nav filter | Y | Y | Y | Y | IMPLEMENTED |
| MaintenanceTemplate + WO snapshot | Y | Y | Y | PARTIAL | Y | Y | Y | Y | IMPLEMENTED |
| Warranty + recovery claims | Y | Y | Y | Y | Y | Y | Y | Y | IMPLEMENTED |
| Failure/RCA/CAPA workflow | Y | Y | Y | PARTIAL | Y | Y | Y | Y | IMPLEMENTED |
| Asset criticality engine | Y | Y | Y | PARTIAL | Y | Y | Y | Y | IMPLEMENTED |
| Downtime segments | Y | Y | — | API | Y | Y | Y | Y | IMPLEMENTED |
| Condition-based maintenance | Y | Y | Y | PARTIAL | Y | Y | Y | Y | IMPLEMENTED |
| Safety / Permit / LOTO | Y | Y | Y | PARTIAL | Y | Y | Y | Y | IMPLEMENTED |
| Parts reserve / ERP handoff | PARTIAL | Y (adapter+retry) | — | Exception center | Y | Y | PARTIAL | Y | PARTIAL |
| Vendor portal | N | N | N | N | — | — | N | N | NOT_IMPLEMENTED |
| Offline PWA | N | N | N | N | — | — | N | N | DEFERRED |
| Advanced analytics | PARTIAL | PARTIAL | N | PARTIAL | Y | Y | — | PARTIAL | PARTIAL |

## Commits (this continuation)

- `7d2d6d1d` downtime / RCA / permits
- `d82540e1` CBM + LOTO
- ERP exception center (pending)

## Validation

- migrate CBM/LOTO — applied
- reliability tests 9/9; erp-exceptions 2/2
- typecheck api — pass (prior batches)
- remote prior HEAD — `d82540e1`

## External dependencies

- Live Bileeta ERP API credentials/contracts — **BLOCKED BY EXTERNAL DEPENDENCY** (mock + file import + exception center available)
