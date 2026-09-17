# Enterprise Maintenance Implementation Ledger

Branch: `maintainpro/phase-15-sqlserver-migration`  
Updated: 2026-09-17 (continuation)

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
| Failure/RCA/CAPA workflow | PARTIAL | PARTIAL | PARTIAL | N | — | — | PARTIAL | N | PARTIAL |
| Asset criticality engine | N | N | N | N | — | — | N | N | NOT_IMPLEMENTED |
| Downtime segments | PARTIAL | PARTIAL | N | N | — | — | PARTIAL | N | PARTIAL |
| Condition-based maintenance | PARTIAL | PARTIAL | N | N | — | — | N | N | PARTIAL |
| Safety / Permit / LOTO | PARTIAL | N | N | N | — | — | N | N | PARTIAL |
| Parts reserve / ERP handoff | PARTIAL | PARTIAL | N | PARTIAL | Y | Y | PARTIAL | PARTIAL | PARTIAL |
| Vendor portal | N | N | N | N | — | — | N | N | NOT_IMPLEMENTED |
| Offline PWA | N | N | N | N | — | — | N | N | DEFERRED |
| Advanced analytics | PARTIAL | PARTIAL | N | PARTIAL | Y | Y | — | PARTIAL | PARTIAL |

## This continuation

| Item | Status | Notes |
|------|--------|-------|
| `TenantFeatureFlag` + Admin UI + `/auth/me.enabledFeatures` + nav filter | IMPLEMENTED | Migration `20260917193000` |
| `MaintenanceTemplate` version/revise + WO snapshot fields | IMPLEMENTED | Create WO accepts `maintenanceTemplateId` |
| `EntityWarranty` + `WarrantyClaim` lifecycle | IMPLEMENTED | Admin `/admin/warranties` |
| ConfigChangeHistory for flags/templates/warranty | IMPLEMENTED | |

## Commits

- `85c0806d` prior mission end (continuation start)
- _(this batch)_ feat(admin): tenant feature flags, maintenance templates, warranty claims

## Validation

- migrate `20260917193000_feature_flags_templates_warranty` — applied
- seed ×2 — pass (templates created then skipped)
- typecheck api+web — pass
- `enterprise-features-templates-warranty.spec.ts` — pass
- `maintenance-config-sla.spec.ts` — pass
