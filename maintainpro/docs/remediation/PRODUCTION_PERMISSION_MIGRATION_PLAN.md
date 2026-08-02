# Production Permission Migration Plan

**Analyzer (dry-run only):** `npm run analyze:permission-migration` → `scripts/security/analyze-permission-migration.mjs`
**CI apply:** unavailable / forbidden.

| Permission | Target roles | Existing production state | Migration action |
| --- | --- | --- | --- |
| reports.* | ADMIN, MANAGER, VIEWER, FINANCE (financials) | UNKNOWN — operator inventory | ADD_IF_MISSING |
| purchase_orders.* | ADMIN, PROCUREMENT_OFFICER, FINANCE | UNKNOWN | ADD_IF_MISSING |
| inventory.erp_dry_run / erp_apply | ADMIN, MANAGER | UNKNOWN | ADD_IF_MISSING (apply ADMIN-only) |
| go_live.* | ADMIN, SUPER_ADMIN | UNKNOWN | ADD_IF_MISSING |
| operations.* | ADMIN, OPERATIONS_MANAGER | UNKNOWN | ADD_IF_MISSING |
| audit.view | ADMIN, SUPER_ADMIN | UNKNOWN | ADD_IF_MISSING |

Rules: dry-run; tenant-by-tenant report; add-only default; no broad role replacement; no deletion without approval; no production seed; detect unknown roles / inactive / SoD conflicts / excess admins; safe counts only; operator confirmation before any apply; rollback mapping documented offline.