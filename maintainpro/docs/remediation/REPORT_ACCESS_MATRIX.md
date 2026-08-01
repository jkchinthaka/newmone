# Report Access Matrix (Phase 5D)

**Status:** CONTRACT_DEFINED  
**Preserve:** Phase 5B `fe3b3992d883d33c916b3595769add2c4db8878a` / `30712469601`; Phase 5C `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / `30715842098`

Phase 5D replaces broad controller-only role arrays with **module permissions**. Controller and service must enforce the same matrix. Permission failures → exact **403**. Unknown/unsupported modules → exact **400**. Tenant filtering remains mandatory.

## Permission catalog (module keys)

| Permission | Module surface |
| --- | --- |
| `reports.operations.view` | Operations / work-order operational reports |
| `reports.financials.view` | Financial summaries and cost ledgers (selected basis) |
| `reports.user_activity.view` | User activity reports |
| `reports.assets.view` | Asset reports |
| `reports.inventory.view` | Inventory reports |
| `reports.performance.view` | Performance / KPI reports |
| `reports.system_logs.view` | System log report **and** requires `audit.view` (both) |
| `reports.driver_intelligence.view` | Driver intelligence |
| `reports.fuel.view` | Fuel analytics |
| `reports.vehicle_cost.view` | Vehicle cost analytics |
| `reports.management.view` | Management intelligence reports |
| `reports.export` | Export capability (never alone) |

Legacy coarse `reports.view` may map via `COMPATIBLE_PERMISSION_ALIASES` during migration but must not grant every module permanently.

## Export rule

Export of module **M** requires:

1. `reports.<M>.view` (or management/ops equivalent for that module), **and**
2. `reports.export`

Missing either → **403**. Export actions are audited (see export safety contract).

## Role guidance

| Role | Allowed report modules (default seed intent) | Denied |
| --- | --- | --- |
| SUPER_ADMIN / ADMIN | All modules + export as seeded | — |
| MANAGER / OPERATIONS_MANAGER | operations, performance, inventory, assets, management (as seeded), export if seeded | system_logs without audit.view |
| FINANCE (canonical; FINANCE_APPROVER alias) | financials, management (finance views), limited procurement-linked financials | system_logs, user_activity dump, technician-only scopes |
| PROCUREMENT_OFFICER | operations (procurement-related), inventory (receiving), not full financials unless granted | system_logs; unrestricted user_activity |
| ASSET_MANAGER | assets, operations (asset WO), vehicle_cost if granted | system_logs; sensitive finance |
| SUPERVISOR | operations / performance (team scope) | financials, system_logs, export unless granted |
| TECHNICIAN | No org report modules by default; personal ops via dashboard own-scope | financials, inventory org, system_logs, export |
| INVENTORY_KEEPER | **inventory** + **operations** only as approved | financials, system_logs, management, user_activity, driver/fuel/vehicle_cost unless explicitly granted |
| VIEWER | **Limited** approved read-only modules only (not automatic all-modules) | system_logs, sensitive financials, export unless separately permitted |
| DRIVER / CLEANER | None of the org MIS modules by default | All sensitive reports |

## System logs

`reports.system_logs.view` **requires** `audit.view` (or equivalent). Either alone is insufficient.

## Enforcement checklist

1. Same matrix in controller guards and service `assertModuleAccess`.
2. Export needs module-view + `reports.export`.
3. VIEWER is limited — not all modules.
4. INVENTORY_KEEPER = inventory/ops only as approved.
5. FINANCE gets approved finance/procurement financial views; alias `FINANCE_APPROVER` must not diverge.
6. Technician = authorized personal/operational scope only.
7. System logs need audit.view.
8. Tenant filter mandatory.
9. Failures: **403** permission, **400** unsupported module.
10. Production permission migration is **operator-owned**; do not run production seed from CI.

## Test IDs

- E2E-REPORT-001 … E2E-REPORT-008 — module permission allow/deny, export dual-permission, VIEWER limit, keeper limit, system logs + audit.view, tenant isolation, 400 unsupported
- E2E-DASH-007, E2E-DASH-008
