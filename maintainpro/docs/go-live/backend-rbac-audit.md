# Backend RBAC Audit

Generated: 2026-07-03T03:02:19.013Z

MaintainPro API route protection review for UAT-022. Global guards: `JwtAuthGuard`, `TenantContextGuard`, `RolesGuard`, `PermissionsGuard`.

## Summary

| Metric | Count |
|--------|------:|
| Total routes scanned | 509 |
| PASS | 485 |
| FIXED | 0 |
| TODO | 24 |

High-risk endpoints (work order status, overrides, parts, invoices, exports, admin) must have `@Roles` and/or `@Permissions`.

## Route Matrix

| Endpoint | Method | Controller | Permission | Roles | Scope | Audit | Status |
|----------|--------|------------|------------|-------|-------|-------|--------|
| `/[predictive-ai, ai]/actions/assign-technician` | POST | `modules/predictive-ai/predictive-ai.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/[predictive-ai, ai]/actions/create-work-order` | POST | `modules/predictive-ai/predictive-ai.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/[predictive-ai, ai]/actions/schedule-maintenance` | POST | `modules/predictive-ai/predictive-ai.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/[predictive-ai, ai]/context` | GET | `modules/predictive-ai/predictive-ai.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/[predictive-ai, ai]/conversations/:id/messages` | GET | `modules/predictive-ai/predictive-ai.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/[predictive-ai, ai]/conversations/:id` | GET | `modules/predictive-ai/predictive-ai.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/[predictive-ai, ai]/conversations` | GET | `modules/predictive-ai/predictive-ai.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/[predictive-ai, ai]/conversations` | POST | `modules/predictive-ai/predictive-ai.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/[predictive-ai, ai]/copilot` | POST | `modules/predictive-ai/predictive-ai.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/[predictive-ai, ai]/field-insights` | GET | `modules/predictive-ai/predictive-ai.controller.ts` | predictive_insights.view | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR, MANAGER, TECHNICIAN, MECHANIC, DRIVER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/[predictive-ai, ai]/logs` | GET | `modules/predictive-ai/predictive-ai.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, SUPERVISOR, MANAGER, TECHNICIAN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/[predictive-ai, ai]/predictive-logs` | GET | `modules/predictive-ai/predictive-ai.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/accidents/:id/evidence` | POST | `modules/accidents/accidents.controller.ts` | accidents.report | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/accidents/:id` | GET | `modules/accidents/accidents.controller.ts` | accidents.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/accidents/:id` | PATCH | `modules/accidents/accidents.controller.ts` | accidents.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/accidents` | GET | `modules/accidents/accidents.controller.ts` | accidents.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/accidents` | POST | `modules/accidents/accidents.controller.ts` | accidents.report | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/admin/invitations` | GET | `modules/admin/admin-access.controller.ts` | — | RoleName.SUPER_ADMIN, RoleName.ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/admin/invitations` | POST | `modules/admin/admin-access.controller.ts` | — | RoleName.SUPER_ADMIN, RoleName.ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/admin/roles-permissions` | GET | `modules/admin/admin-access.controller.ts` | — | RoleName.SUPER_ADMIN, RoleName.ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/admin/tenants` | GET | `modules/admin/admin-access.controller.ts` | — | RoleName.SUPER_ADMIN, RoleName.ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/admin/users` | GET | `modules/admin/admin-access.controller.ts` | — | RoleName.SUPER_ADMIN, RoleName.ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/:id/documents/:documentId` | GET | `modules/assets/assets.controller.ts` | — | ...ASSET_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/:id/documents` | POST | `modules/assets/assets.controller.ts` | — | ...ASSET_WRITE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/:id/maintenance-history` | GET | `modules/assets/assets.controller.ts` | — | ...ASSET_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/:id/qr-code/download` | GET | `modules/assets/assets.controller.ts` | — | ...ASSET_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/:id/qr-code/regenerate` | POST | `modules/assets/assets.controller.ts` | — | ...ASSET_WRITE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/:id/qr-code` | GET | `modules/assets/assets.controller.ts` | — | ...ASSET_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/:id/restore` | POST | `modules/assets/assets.controller.ts` | — | ...ASSET_WRITE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/:id/status` | PATCH | `modules/assets/assets.controller.ts` | — | ...ASSET_WRITE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/:id` | DELETE | `modules/assets/assets.controller.ts` | — | ...ASSET_DELETE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/:id` | GET | `modules/assets/assets.controller.ts` | — | ...ASSET_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/:id` | PATCH | `modules/assets/assets.controller.ts` | — | ...ASSET_WRITE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/bulk-action` | POST | `modules/assets/assets.controller.ts` | — | ...ASSET_WRITE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/bulk-import` | POST | `modules/assets/assets.controller.ts` | — | ...ASSET_WRITE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/export` | GET | `modules/assets/assets.controller.ts` | — | ...ASSET_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/filter-options` | GET | `modules/assets/assets.controller.ts` | — | ...ASSET_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/summary` | GET | `modules/assets/assets.controller.ts` | — | ...ASSET_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets/validate-tag` | GET | `modules/assets/assets.controller.ts` | — | ...ASSET_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets` | GET | `modules/assets/assets.controller.ts` | — | ...ASSET_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/assets` | POST | `modules/assets/assets.controller.ts` | — | ...ASSET_WRITE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/audit-logs/export` | GET | `modules/audit/audit.controller.ts` | audit.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/audit-logs` | GET | `modules/audit/audit.controller.ts` | audit.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/auth/forgot-password` | POST | `modules/auth/auth.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS (public) |
| `/auth/google` | GET | `modules/auth/auth.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS (public) |
| `/auth/invite/accept` | POST | `modules/auth/auth.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/auth/invite/verify` | GET | `modules/auth/auth.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS (public) |
| `/auth/login` | POST | `modules/auth/auth.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS (public) |
| `/auth/logout-all` | POST | `modules/auth/auth.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS (public) |
| `/auth/logout` | POST | `modules/auth/auth.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/auth/me` | GET | `modules/auth/auth.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS (public) |
| `/auth/refresh` | POST | `modules/auth/auth.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS (public) |
| `/auth/register` | POST | `modules/auth/auth.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS (public) |
| `/auth/reset-password` | POST | `modules/auth/auth.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS (public) |
| `/billing/checkout-session` | POST | `modules/billing/billing.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS (public) |
| `/billing/subscription` | GET | `modules/billing/billing.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/billing/webhooks/stripe` | POST | `modules/billing/billing.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/cleaning/analytics` | GET | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/enforcement/run` | POST | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/issues/:id/create-work-order` | POST | `modules/cleaning/cleaning.controller.ts` | facility_issues.manage | SUPER_ADMIN, ADMIN, FACILITY_MANAGER, BUILDING_SUPERVISOR, MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/issues/:id` | PATCH | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/issues/duplicate-check` | POST | `modules/cleaning/cleaning.controller.ts` | — | CLEANER, SUPERVISOR, ADMIN, SUPER_ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/issues` | GET | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN, SUPERVISOR, CLEANER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/issues` | POST | `modules/cleaning/cleaning.controller.ts` | — | CLEANER, SUPERVISOR, ADMIN, SUPER_ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/locations/:id/qr` | GET | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/locations/:id/regenerate-qr` | POST | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/locations/:id` | DELETE | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/locations/:id` | GET | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN, SUPERVISOR, CLEANER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/locations/:id` | PATCH | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/locations` | GET | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/locations` | POST | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/scan` | POST | `modules/cleaning/cleaning.controller.ts` | — | CLEANER, SUPERVISOR, ADMIN, SUPER_ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/schedule/calendar` | GET | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/users/cleaners` | GET | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/visits/:id/sign-off` | POST | `modules/cleaning/cleaning.controller.ts` | — | SUPERVISOR, ADMIN, SUPER_ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/visits/:id/submit` | POST | `modules/cleaning/cleaning.controller.ts` | — | CLEANER, SUPERVISOR, ADMIN, SUPER_ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/visits/:id` | GET | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN, SUPERVISOR, CLEANER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/visits/export` | GET | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/visits/scan` | POST | `modules/cleaning/cleaning.controller.ts` | — | CLEANER, SUPERVISOR, ADMIN, SUPER_ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/cleaning/visits` | GET | `modules/cleaning/cleaning.controller.ts` | — | SUPER_ADMIN, ADMIN, SUPERVISOR, CLEANER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/compliance/expiring-documents` | GET | `modules/compliance/compliance.controller.ts` | compliance.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/compliance/summary` | GET | `modules/compliance/compliance.controller.ts` | compliance.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/delivery-readiness/categories` | GET | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/delivery-readiness/checklists/:id/items` | POST | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/delivery-readiness/checklists/:id` | GET | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/delivery-readiness/checklists/:id` | PATCH | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/delivery-readiness/checklists` | GET | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/delivery-readiness/checklists` | POST | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/delivery-readiness/dashboard` | GET | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/delivery-readiness/final-report` | GET | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/delivery-readiness/items/:id/accept-risk` | POST | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.accept_risk | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/delivery-readiness/items/:id/complete` | POST | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/delivery-readiness/items/:id/fail` | POST | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/delivery-readiness/items/:id` | PATCH | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/delivery-readiness/items` | GET | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/delivery-readiness/sign-off` | POST | `modules/delivery-readiness/delivery-readiness.controller.ts` | delivery.sign_off | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/departments/:id/deactivate` | PATCH | `modules/departments/departments.controller.ts` | — | ...DEPARTMENT_MANAGE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/departments/:id` | GET | `modules/departments/departments.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, ASSET_MANAGER, SUPERVISOR, MECHANIC, TECHNICIAN, VIEWER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/departments/:id` | PATCH | `modules/departments/departments.controller.ts` | — | ...DEPARTMENT_MANAGE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/departments/:id` | PUT | `modules/departments/departments.controller.ts` | — | ...DEPARTMENT_MANAGE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/departments` | GET | `modules/departments/departments.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, ASSET_MANAGER, SUPERVISOR, MECHANIC, TECHNICIAN, VIEWER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/departments` | POST | `modules/departments/departments.controller.ts` | — | ...DEPARTMENT_MANAGE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/driver-intelligence/dashboard` | GET | `modules/driver-intelligence/driver-intelligence.controller.ts` | dashboard_analytics.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/driver-intelligence/drivers/:id/eligibility` | GET | `modules/driver-intelligence/driver-intelligence.controller.ts` | driver_intelligence.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/driver-intelligence/drivers/:id/inputs` | PATCH | `modules/driver-intelligence/driver-intelligence.controller.ts` | driver_intelligence.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/driver-intelligence/drivers/:id` | GET | `modules/driver-intelligence/driver-intelligence.controller.ts` | driver_intelligence.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/driver-intelligence/drivers` | GET | `modules/driver-intelligence/driver-intelligence.controller.ts` | driver_intelligence.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/driver-intelligence/rankings/best-drivers` | GET | `modules/driver-intelligence/driver-intelligence.controller.ts` | driver_intelligence.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/drivers` | GET | `modules/drivers/drivers.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/drivers` | POST | `modules/drivers/drivers.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/access-checklist/:id` | PATCH | `modules/erp-integration/erp-integration.controller.ts` | erp.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/access-checklist` | GET | `modules/erp-integration/erp-integration.controller.ts` | erp.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/erp/import/batches/:id/apply` | POST | `modules/erp-integration/erp-integration.controller.ts` | erp.import | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/import/batches/:id/approve` | POST | `modules/erp-integration/erp-integration.controller.ts` | erp.import | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/import/batches/:id/cancel` | POST | `modules/erp-integration/erp-integration.controller.ts` | erp.import | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/import/batches/:id/dry-run` | POST | `modules/erp-integration/erp-integration.controller.ts` | erp.import | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/import/batches/:id` | GET | `modules/erp-integration/erp-integration.controller.ts` | erp.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/erp/import/batches` | GET | `modules/erp-integration/erp-integration.controller.ts` | erp.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/erp/import/batch` | POST | `modules/erp-integration/erp-integration.controller.ts` | erp.import | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/mappings/:id` | PATCH | `modules/erp-integration/erp-integration.controller.ts` | erp.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/mappings` | GET | `modules/erp-integration/erp-integration.controller.ts` | erp.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/erp/mappings` | POST | `modules/erp-integration/erp-integration.controller.ts` | erp.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/mock/status` | GET | `modules/erp-integration/erp-integration.controller.ts` | erp.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/mock/sync` | POST | `modules/erp-integration/erp-integration.controller.ts` | erp.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/readiness` | GET | `modules/erp-integration/erp-integration.controller.ts` | erp.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/erp/reconciliation/:id/accept` | POST | `modules/erp-integration/erp-integration.controller.ts` | erp.reconcile | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/reconciliation/:id/mark-corrected` | POST | `modules/erp-integration/erp-integration.controller.ts` | erp.reconcile | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/reconciliation/:id/review` | POST | `modules/erp-integration/erp-integration.controller.ts` | erp.reconcile | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/erp/reconciliation/:id` | GET | `modules/erp-integration/erp-integration.controller.ts` | erp.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/erp/reconciliation` | GET | `modules/erp-integration/erp-integration.controller.ts` | erp.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/erp/report` | GET | `modules/erp-integration/erp-integration.controller.ts` | erp.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/erp/status` | GET | `modules/erp-integration/erp-integration.controller.ts` | erp.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/buildings/:buildingId` | GET | `modules/facilities/facilities.controller.ts` | facilities.view | ...FACILITY_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/buildings/:buildingId` | PATCH | `modules/facilities/facilities.controller.ts` | facilities.manage | ...FACILITY_MANAGE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/buildings` | GET | `modules/facilities/facilities.controller.ts` | facilities.view | ...FACILITY_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/buildings` | POST | `modules/facilities/facilities.controller.ts` | facilities.manage | ...FACILITY_MANAGE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/dashboard` | GET | `modules/facilities/facilities.controller.ts` | facilities.view | ...FACILITY_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/floors/:floorId` | GET | `modules/facilities/facilities.controller.ts` | facilities.view | ...FACILITY_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/floors/:floorId` | PATCH | `modules/facilities/facilities.controller.ts` | facilities.manage | ...FACILITY_MANAGE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/floors` | GET | `modules/facilities/facilities.controller.ts` | facilities.view | ...FACILITY_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/floors` | POST | `modules/facilities/facilities.controller.ts` | facilities.manage | ...FACILITY_MANAGE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/properties/:propertyId` | GET | `modules/facilities/facilities.controller.ts` | facilities.view | ...FACILITY_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/properties/:propertyId` | PATCH | `modules/facilities/facilities.controller.ts` | facilities.manage | ...FACILITY_MANAGE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/properties` | GET | `modules/facilities/facilities.controller.ts` | facilities.view | ...FACILITY_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/properties` | POST | `modules/facilities/facilities.controller.ts` | facilities.manage | ...FACILITY_MANAGE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/reports/aging` | GET | `modules/facilities/facilities.controller.ts` | facilities.view | ...FACILITY_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/rooms/:roomId` | GET | `modules/facilities/facilities.controller.ts` | facilities.view | ...FACILITY_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/rooms` | GET | `modules/facilities/facilities.controller.ts` | facilities.view | ...FACILITY_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/facilities/rooms` | POST | `modules/facilities/facilities.controller.ts` | facilities.manage | ...FACILITY_MANAGE_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/fleet/alerts` | GET | `modules/fleet/fleet.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/fleet/geofences/:id` | DELETE | `modules/fleet/fleet.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/fleet/geofences` | GET | `modules/fleet/fleet.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/fleet/geofences` | POST | `modules/fleet/fleet.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/fleet/live-map` | GET | `modules/fleet/fleet.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/fuel/logs` | GET | `modules/fuel/fuel.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, ASSET_MANAGER, SUPERVISOR, DRIVER, VIEWER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/cutover-checklist/items/:id` | PATCH | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/cutover-checklist/items` | POST | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/cutover-checklist` | GET | `modules/go-live/go-live.controller.ts` | go_live.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/go-live/dashboard` | GET | `modules/go-live/go-live.controller.ts` | go_live.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/go-live/decision-board/decision` | POST | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/decision-board` | GET | `modules/go-live/go-live.controller.ts` | go_live.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/go-live/export` | GET | `modules/go-live/go-live.controller.ts` | go_live.export | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/final-report` | GET | `modules/go-live/go-live.controller.ts` | go_live.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/go-live/live-issues` | GET | `modules/go-live/go-live.controller.ts` | go_live.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/go-live/pilots/:id/complete` | POST | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/pilots/:id/extend` | POST | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/pilots/:id/start` | POST | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/pilots/:id` | PATCH | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/pilots` | GET | `modules/go-live/go-live.controller.ts` | go_live.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/go-live/pilots` | POST | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/rollback-plan/:id` | PATCH | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/rollback-plan` | GET | `modules/go-live/go-live.controller.ts` | go_live.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/go-live/rollback-plan` | POST | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/signoff` | GET | `modules/go-live/go-live.controller.ts` | go_live.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/go-live/signoff` | POST | `modules/go-live/go-live.controller.ts` | go_live.sign_off | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/waves/:id/complete` | POST | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/waves/:id/pause` | POST | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/waves/:id/start` | POST | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/waves/:id` | PATCH | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/go-live/waves` | GET | `modules/go-live/go-live.controller.ts` | go_live.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/go-live/waves` | POST | `modules/go-live/go-live.controller.ts` | go_live.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/health/readiness` | GET | `health.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/health` | GET | `health.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/insurance-claims/:id` | GET | `modules/insurance-claims/insurance-claims.controller.ts` | insurance_claims.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/insurance-claims/:id` | PATCH | `modules/insurance-claims/insurance-claims.controller.ts` | insurance_claims.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/insurance-claims` | GET | `modules/insurance-claims/insurance-claims.controller.ts` | insurance_claims.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/insurance-claims` | POST | `modules/insurance-claims/insurance-claims.controller.ts` | insurance_claims.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/analytics/top-used` | GET | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/analytics/usage` | GET | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/erp/readiness` | GET | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, MANAGER, INVENTORY_KEEPER, ASSET_MANAGER, OPERATIONS_MANAGER, PROCUREMENT_OFFICER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/erp/stock-sync/dry-run` | POST | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, MANAGER, INVENTORY_KEEPER, ASSET_MANAGER, OPERATIONS_MANAGER, PROCUREMENT_OFFICER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/low-stock` | GET | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts/:id/movements` | GET | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts/:id/purchase-history` | GET | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts/:id/stock-in` | POST | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts/:id/stock-out` | POST | `modules/inventory/inventory.controller.ts` | inventory.stock_issue | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, INVENTORY_KEEPER, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts/:id/work-orders` | GET | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts/:id` | DELETE | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts/:id` | GET | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts/:id` | PATCH | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts/bulk-category` | PATCH | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts/bulk-delete` | POST | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts` | GET | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/parts` | POST | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/purchase-orders/:id/approve-finance` | PATCH | `modules/inventory/inventory.controller.ts` | purchase_orders.approve_finance | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/purchase-orders/:id/approve-operational` | PATCH | `modules/inventory/inventory.controller.ts` | purchase_orders.approve_operational | SUPER_ADMIN, ADMIN, MANAGER, ASSET_MANAGER, INVENTORY_KEEPER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/purchase-orders/:id/erp-sync/retry` | POST | `modules/inventory/inventory.controller.ts` | purchase_orders.erp_sync_retry | SUPER_ADMIN, ADMIN, MANAGER, INVENTORY_KEEPER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/purchase-orders/:id/erp-sync` | POST | `modules/inventory/inventory.controller.ts` | purchase_orders.erp_sync | SUPER_ADMIN, ADMIN, MANAGER, INVENTORY_KEEPER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/purchase-orders/:id/reject` | PATCH | `modules/inventory/inventory.controller.ts` | purchase_orders.reject | SUPER_ADMIN, ADMIN, MANAGER, ASSET_MANAGER, INVENTORY_KEEPER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/purchase-orders/:id` | GET | `modules/inventory/inventory.controller.ts` | part_requests.view | SUPER_ADMIN, ADMIN, ASSET_MANAGER, INVENTORY_KEEPER, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/purchase-orders/:id` | PATCH | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/purchase-orders` | GET | `modules/inventory/inventory.controller.ts` | part_requests.view | SUPER_ADMIN, ADMIN, ASSET_MANAGER, INVENTORY_KEEPER, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/inventory/purchase-orders` | POST | `modules/inventory/inventory.controller.ts` | inventory.manage | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/job-codes/:id` | GET | `modules/job-codes/job-codes.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, TECHNICIAN, MECHANIC, SUPERVISOR, VIEWER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/job-codes/:id` | PATCH | `modules/job-codes/job-codes.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/job-codes` | GET | `modules/job-codes/job-codes.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, TECHNICIAN, MECHANIC, SUPERVISOR, VIEWER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/job-codes` | POST | `modules/job-codes/job-codes.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/maintenance/calendar` | GET | `modules/maintenance/maintenance.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/maintenance/logs` | GET | `modules/maintenance/maintenance.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/maintenance/logs` | POST | `modules/maintenance/maintenance.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/maintenance/predictive-alerts` | GET | `modules/maintenance/maintenance.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/maintenance/schedules/:id` | DELETE | `modules/maintenance/maintenance.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/maintenance/schedules/:id` | GET | `modules/maintenance/maintenance.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/maintenance/schedules/:id` | PATCH | `modules/maintenance/maintenance.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/maintenance/schedules` | GET | `modules/maintenance/maintenance.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/maintenance/schedules` | POST | `modules/maintenance/maintenance.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/notifications/:id/actions` | POST | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/:id/explain` | POST | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/:id/read` | PATCH | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/ai-summary` | GET | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/analytics` | GET | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/mark-all-read` | PATCH | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/preferences` | GET | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/preferences` | PATCH | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/push/devices` | POST | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/push/readiness` | GET | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/readiness` | GET | `modules/notifications/notifications.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/notifications/rules` | GET | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/rules` | PATCH | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/notifications/templates/samples` | GET | `modules/notifications/notifications.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/notifications/uat/email-test` | POST | `modules/notifications/notifications.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/notifications/uat/sms-test` | POST | `modules/notifications/notifications.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/notifications` | GET | `modules/notifications/notifications.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/post-go-live/:id/approve` | POST | `modules/post-go-live/post-go-live.controller.ts` | change_request.approve | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/post-go-live/:id/reject` | POST | `modules/post-go-live/post-go-live.controller.ts` | change_request.approve | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/post-go-live/:id` | GET | `modules/post-go-live/post-go-live.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/post-go-live/dashboard` | GET | `modules/post-go-live/post-go-live.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/post-go-live/handover` | GET | `modules/post-go-live/post-go-live.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/post-go-live/handover` | PATCH | `modules/post-go-live/post-go-live.controller.ts` | operations.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/post-go-live/hypercare/:id/complete` | POST | `modules/post-go-live/post-go-live.controller.ts` | operations.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/post-go-live/hypercare/:id/extend` | POST | `modules/post-go-live/post-go-live.controller.ts` | operations.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/post-go-live/hypercare/:id` | PATCH | `modules/post-go-live/post-go-live.controller.ts` | operations.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/post-go-live/hypercare` | GET | `modules/post-go-live/post-go-live.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/post-go-live/hypercare` | POST | `modules/post-go-live/post-go-live.controller.ts` | operations.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/post-go-live/monitoring/dashboard` | GET | `modules/post-go-live/post-go-live.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/post-go-live/report` | GET | `modules/post-go-live/post-go-live.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/post-go-live/training/:id/complete` | POST | `modules/post-go-live/post-go-live.controller.ts` | operations.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/post-go-live/training/:id/mark-retraining` | POST | `modules/post-go-live/post-go-live.controller.ts` | operations.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/post-go-live/training/:id` | PATCH | `modules/post-go-live/post-go-live.controller.ts` | operations.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/post-go-live/training` | GET | `modules/post-go-live/post-go-live.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/post-go-live/training` | POST | `modules/post-go-live/post-go-live.controller.ts` | operations.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/post-go-live` | GET | `modules/post-go-live/post-go-live.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/post-go-live` | POST | `modules/post-go-live/post-go-live.controller.ts` | change_request.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/categories` | GET | `modules/qa/qa.controller.ts` | qa.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/qa/dashboard` | GET | `modules/qa/qa.controller.ts` | qa.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/qa/issues/:id/accept-risk` | POST | `modules/qa/qa.controller.ts` | qa.accept_risk | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/issues/:id/assign` | POST | `modules/qa/qa.controller.ts` | qa.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/issues/:id/close` | POST | `modules/qa/qa.controller.ts` | qa.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/issues/:id/rca` | POST | `modules/qa/qa.controller.ts` | qa.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/issues/:id/regression-test` | POST | `modules/qa/qa.controller.ts` | qa.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/issues/:id/reopen` | POST | `modules/qa/qa.controller.ts` | qa.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/issues/:id/status` | POST | `modules/qa/qa.controller.ts` | qa.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/issues/:id/triage` | POST | `modules/qa/qa.controller.ts` | qa.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/issues/:id` | GET | `modules/qa/qa.controller.ts` | qa.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/qa/issues/:id` | PATCH | `modules/qa/qa.controller.ts` | qa.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/issues/from-health-check` | POST | `modules/qa/qa.controller.ts` | qa.manage | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/issues` | GET | `modules/qa/qa.controller.ts` | qa.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/qa/issues` | POST | `modules/qa/qa.controller.ts` | qa.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/qa/reports/release-quality` | GET | `modules/qa/qa.controller.ts` | qa.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/reports/:module/export` | GET | `modules/reports/reports.controller.ts` | — | ...REPORT_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/dashboard` | GET | `modules/reports/reports.controller.ts` | — | ...REPORT_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/downtime` | GET | `modules/reports/reports.controller.ts` | — | ...REPORT_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/fleet-efficiency` | GET | `modules/reports/reports.controller.ts` | — | ...REPORT_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/fraud-control/admin-overrides/export` | GET | `modules/fraud-control/fraud-control.controller.ts` | — | ...FRAUD_REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/fraud-control/admin-overrides` | GET | `modules/fraud-control/fraud-control.controller.ts` | — | ...FRAUD_REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/fraud-control/dashboard` | GET | `modules/fraud-control/fraud-control.controller.ts` | — | ...FRAUD_REPORT_ROLES, SUPERVISOR, SECURITY_OFFICER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/inventory` | GET | `modules/reports/reports.controller.ts` | — | ...REPORT_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/maintenance-cost` | GET | `modules/reports/reports.controller.ts` | — | ...REPORT_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/maintenance/assets` | GET | `modules/reports/maintenance-reports.controller.ts` | — | ...MAINTENANCE_REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/maintenance/costs` | GET | `modules/reports/maintenance-reports.controller.ts` | — | ...COST_REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/maintenance/exceptions/:type/export` | GET | `modules/reports/maintenance-reports.controller.ts` | — | ...MAINTENANCE_REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/maintenance/exceptions/:type` | GET | `modules/reports/maintenance-reports.controller.ts` | — | ...MAINTENANCE_REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/maintenance/exceptions` | GET | `modules/reports/maintenance-reports.controller.ts` | — | ...MAINTENANCE_REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/maintenance/kpis` | GET | `modules/reports/maintenance-reports.controller.ts` | — | ...MAINTENANCE_REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/maintenance/parts` | GET | `modules/reports/maintenance-reports.controller.ts` | — | ...MAINTENANCE_REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/maintenance/workforce` | GET | `modules/reports/maintenance-reports.controller.ts` | — | ...MAINTENANCE_REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/cost-by-asset` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...MANAGEMENT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/cost-by-branch` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...MANAGEMENT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/cost-by-category` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...MANAGEMENT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/cost-by-department` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...SUPERVISOR_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/cost-by-vehicle` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...MANAGEMENT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/downtime-cost` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...MANAGEMENT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/monthly-cost-trend` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...MANAGEMENT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/parts-usage-by-technician` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...PARTS_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/profitability/summary` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...MANAGEMENT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/repair-vs-replace` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...MANAGEMENT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/repeated-breakdowns` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...SUPERVISOR_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/top-high-cost-assets` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...MANAGEMENT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/top-high-cost-vehicles` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...MANAGEMENT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/management/vendor-cost-comparison` | GET | `modules/management-intelligence/management-intelligence.controller.ts` | — | ...MANAGEMENT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/options` | GET | `modules/reports/reports.controller.ts` | — | ...REPORT_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/utilities` | GET | `modules/reports/reports.controller.ts` | — | ...REPORT_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/work-orders/category-summary/export` | GET | `modules/reports/work-order-category-reports.controller.ts` | — | ...REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/work-orders/category-summary` | GET | `modules/reports/work-order-category-reports.controller.ts` | — | ...REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/work-orders/top-issues` | GET | `modules/reports/work-order-category-reports.controller.ts` | — | ...REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/work-orders/triage` | GET | `modules/reports/work-order-category-reports.controller.ts` | — | ...REPORT_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/reports/work-orders` | GET | `modules/reports/reports.controller.ts` | — | ...REPORT_READ_ROLES | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/roles/:id` | PATCH | `modules/roles/roles.controller.ts` | roles.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/roles/permissions` | GET | `modules/roles/roles.controller.ts` | permissions.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/roles/permissions` | POST | `modules/roles/roles.controller.ts` | permissions.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/roles` | GET | `modules/roles/roles.controller.ts` | roles.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/roles` | POST | `modules/roles/roles.controller.ts` | roles.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/automation-rules` | GET | `modules/settings/settings.controller.ts` | settings.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/automation-rules` | PATCH | `modules/settings/settings.controller.ts` | settings.system.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/digest-schedules` | GET | `modules/settings/settings.controller.ts` | settings.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/digest-schedules` | PATCH | `modules/settings/settings.controller.ts` | settings.system.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/feature-toggles` | GET | `modules/settings/settings.controller.ts` | settings.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/feature-toggles` | PATCH | `modules/settings/settings.controller.ts` | settings.system.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/integrations` | GET | `modules/settings/settings.controller.ts` | settings.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/integrations` | PATCH | `modules/settings/settings.controller.ts` | settings.system.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/organization` | GET | `modules/settings/settings.controller.ts` | settings.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/organization` | PATCH | `modules/settings/settings.controller.ts` | settings.organization.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/profile` | GET | `modules/settings/settings.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/settings/profile` | PATCH | `modules/settings/settings.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/settings/system` | GET | `modules/settings/settings.controller.ts` | settings.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/settings/system` | PATCH | `modules/settings/settings.controller.ts` | settings.system.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/suppliers/:id` | GET | `modules/suppliers/suppliers.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MANAGER, OPERATIONS_MANAGER, SUPERVISOR, INVENTORY_KEEPER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/suppliers/:id` | PATCH | `modules/suppliers/suppliers.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/suppliers` | GET | `modules/suppliers/suppliers.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MANAGER, OPERATIONS_MANAGER, SUPERVISOR, INVENTORY_KEEPER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/suppliers` | POST | `modules/suppliers/suppliers.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/:id/mark-deployed` | POST | `modules/post-go-live/support.controller.ts` | release.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/:id/schedule` | POST | `modules/post-go-live/support.controller.ts` | release.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/:id` | GET | `modules/post-go-live/support.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/support/:id` | PATCH | `modules/post-go-live/support.controller.ts` | release.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/escalation-matrix/:id` | PATCH | `modules/post-go-live/support.controller.ts` | support.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/escalation-matrix` | GET | `modules/post-go-live/support.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/support/escalation-matrix` | POST | `modules/post-go-live/support.controller.ts` | support.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/sla/breaches` | GET | `modules/post-go-live/support.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/support/sla/dashboard` | GET | `modules/post-go-live/support.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/support/sla/recalculate` | POST | `modules/post-go-live/support.controller.ts` | support.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/tickets/:id/acknowledge` | POST | `modules/post-go-live/support.controller.ts` | support.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/tickets/:id/assign` | POST | `modules/post-go-live/support.controller.ts` | support.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/tickets/:id/close` | POST | `modules/post-go-live/support.controller.ts` | support.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/tickets/:id/reopen` | POST | `modules/post-go-live/support.controller.ts` | support.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/tickets/:id/resolve` | POST | `modules/post-go-live/support.controller.ts` | support.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/tickets/:id/status` | POST | `modules/post-go-live/support.controller.ts` | support.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/tickets/:id` | GET | `modules/post-go-live/support.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/support/tickets/:id` | PATCH | `modules/post-go-live/support.controller.ts` | support.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support/tickets/mine` | GET | `modules/post-go-live/support.controller.ts` | support.create | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/support/tickets` | GET | `modules/post-go-live/support.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/support/tickets` | POST | `modules/post-go-live/support.controller.ts` | support.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/support` | GET | `modules/post-go-live/support.controller.ts` | operations.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/support` | POST | `modules/post-go-live/support.controller.ts` | release.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/tenants/:id/invitations` | GET | `modules/invitations/invitations.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/tenants/me` | GET | `modules/tenancy/tenancy.controller.ts` | — | — | tenant via JwtAuthGuard + TenantContextGuard | yes | TODO |
| `/traffic-fines/:id/payment` | POST | `modules/traffic-fines/traffic-fines.controller.ts` | traffic_fines.payment | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/traffic-fines/:id/responsibility` | POST | `modules/traffic-fines/traffic-fines.controller.ts` | traffic_fines.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/traffic-fines/:id` | GET | `modules/traffic-fines/traffic-fines.controller.ts` | traffic_fines.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/traffic-fines` | GET | `modules/traffic-fines/traffic-fines.controller.ts` | traffic_fines.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/traffic-fines` | POST | `modules/traffic-fines/traffic-fines.controller.ts` | traffic_fines.report | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/people/:id/deactivate` | POST | `modules/people/people.controller.ts` | users.status.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/people/:id/disable-login` | POST | `modules/people/people.controller.ts` | users.status.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/people/:id/enable-login` | POST | `modules/people/people.controller.ts` | users.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/people/:id/reactivate` | POST | `modules/people/people.controller.ts` | users.status.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/people/:id/technician-profile` | POST | `modules/people/people.controller.ts` | users.edit | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/people/:id` | GET | `modules/people/people.controller.ts` | users.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/people/:id` | PATCH | `modules/people/people.controller.ts` | users.edit | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/people` | GET | `modules/people/people.controller.ts` | users.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/people` | POST | `modules/people/people.controller.ts` | users.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/technicians/:id` | PATCH | `modules/people/people.controller.ts` | users.edit | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/technicians/assignable` | GET | `modules/people/people.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/technicians` | GET | `modules/people/people.controller.ts` | users.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/users/:id/resend-invite` | POST | `modules/people/people.controller.ts` | users.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/users/:id/reset-password` | POST | `modules/people/people.controller.ts` | users.edit | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/users/:id/send-invite` | POST | `modules/people/people.controller.ts` | users.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/vehicle-documents/:id/reject` | POST | `modules/vehicle-documents/vehicle-documents.controller.ts` | vehicle_documents.verify | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/vehicle-documents/:id/verify` | POST | `modules/vehicle-documents/vehicle-documents.controller.ts` | vehicle_documents.verify | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/vehicle-documents/:id` | GET | `modules/vehicle-documents/vehicle-documents.controller.ts` | vehicle_documents.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/vehicle-documents/:id` | PATCH | `modules/vehicle-documents/vehicle-documents.controller.ts` | vehicle_documents.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/vehicles/:vehicleId/documents` | GET | `modules/vehicle-documents/vehicle-documents.controller.ts` | vehicle_documents.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/unknown/vehicles/:vehicleId/documents` | POST | `modules/vehicle-documents/vehicle-documents.controller.ts` | vehicle_documents.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/users/:id/status` | PATCH | `modules/users/users.controller.ts` | users.status.manage | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/users/:id` | GET | `modules/users/users.controller.ts` | users.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/users/:id` | PATCH | `modules/users/users.controller.ts` | users.edit | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/users/invite` | POST | `modules/users/users.controller.ts` | users.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/users` | GET | `modules/users/users.controller.ts` | users.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/users` | POST | `modules/users/users.controller.ts` | users.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/bills/:id/pay` | PATCH | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/bills/:id` | GET | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/bills/overdue` | GET | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/bills/pay` | PATCH | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/bills` | GET | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/bills` | POST | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/meters/:id/consumption-chart` | GET | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/meters/:id/readings` | GET | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/meters/:id/readings` | POST | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/meters/:id` | GET | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/meters/:id` | PATCH | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/meters` | GET | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/meters` | POST | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/readings` | GET | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/utilities/readings` | POST | `modules/utilities/utilities.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/:id/assign-driver` | POST | `modules/vehicles/vehicles.controller.ts` | vehicles.edit | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/:id/fuel-analytics` | GET | `modules/vehicles/vehicles.controller.ts` | vehicles.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/vehicles/:id/fuel-log` | POST | `modules/vehicles/vehicles.controller.ts` | vehicles.operate | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/:id/fuel-logs` | GET | `modules/vehicles/vehicles.controller.ts` | vehicles.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/vehicles/:id/gate-in` | POST | `modules/vehicles/vehicles.controller.ts` | gate.in.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/:id/gate-movements` | GET | `modules/vehicles/vehicles.controller.ts` | vehicles.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/:id/gate-out` | POST | `modules/vehicles/vehicles.controller.ts` | gate.out.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/:id/history` | GET | `modules/vehicles/vehicles.controller.ts` | vehicles.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/vehicles/:id/meter-logs` | GET | `modules/vehicles/vehicles.controller.ts` | vehicles.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/vehicles/:id/meter-reading` | POST | `modules/vehicles/vehicles.controller.ts` | vehicles.operate | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/:id/service-rule` | GET | `modules/vehicles/vehicles.controller.ts` | vehicles.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/vehicles/:id/service-rule` | PATCH | `modules/vehicles/vehicles.controller.ts` | vehicles.edit | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/:id/trip-end` | POST | `modules/vehicles/vehicles.controller.ts` | vehicles.operate | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/:id/trip-start` | POST | `modules/vehicles/vehicles.controller.ts` | vehicles.operate | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/:id/trips` | GET | `modules/vehicles/vehicles.controller.ts` | vehicles.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/vehicles/:id` | DELETE | `modules/vehicles/vehicles.controller.ts` | vehicles.delete | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/:id` | GET | `modules/vehicles/vehicles.controller.ts` | vehicles.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/vehicles/:id` | PATCH | `modules/vehicles/vehicles.controller.ts` | vehicles.edit | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles/alerts` | GET | `modules/vehicles/vehicles.controller.ts` | vehicles.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/vehicles/summary` | GET | `modules/vehicles/vehicles.controller.ts` | vehicles.view | — | tenant via JwtAuthGuard + TenantContextGuard | no | PASS |
| `/vehicles` | GET | `modules/vehicles/vehicles.controller.ts` | vehicles.view | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/vehicles` | POST | `modules/vehicles/vehicles.controller.ts` | vehicles.create | — | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/activity` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/approve` | PATCH | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/assignees/:assigneeId` | DELETE | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/assignees` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/assignees` | POST | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/assign` | POST | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/attachments` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/classify-triage` | PATCH | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/evidence/:evidenceId/accept` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/evidence/:evidenceId/reject` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/evidence/:evidenceId` | DELETE | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, TECHNICIAN, FACILITY_MANAGER, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/evidence/:evidenceId` | PATCH | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, TECHNICIAN, FACILITY_MANAGER, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/evidence/confirm` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, TECHNICIAN, FACILITY_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/evidence/upload-request` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, TECHNICIAN, FACILITY_MANAGER, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/evidence` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, TECHNICIAN, FACILITY_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/evidence` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, TECHNICIAN, FACILITY_MANAGER, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/history` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/notes` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/part-requests/:requestId/approve-finance` | PATCH | `modules/work-orders/work-orders.controller.ts` | part_requests.approve_finance | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/part-requests/:requestId/approve-operational` | PATCH | `modules/work-orders/work-orders.controller.ts` | part_requests.approve_operational | SUPER_ADMIN, ADMIN, MANAGER, ASSET_MANAGER, INVENTORY_KEEPER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/part-requests/:requestId/issue` | POST | `modules/work-orders/work-orders.controller.ts` | part_requests.issue, inventory.stock_issue | SUPER_ADMIN, ADMIN, ASSET_MANAGER, INVENTORY_KEEPER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/part-requests/:requestId/reject` | PATCH | `modules/work-orders/work-orders.controller.ts` | part_requests.reject | SUPER_ADMIN, ADMIN, MANAGER, ASSET_MANAGER, INVENTORY_KEEPER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/part-requests` | GET | `modules/work-orders/work-orders.controller.ts` | part_requests.view | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, TECHNICIAN, INVENTORY_KEEPER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/part-requests` | POST | `modules/work-orders/work-orders.controller.ts` | part_requests.create | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, TECHNICIAN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/parts/:lineId/confirm-return` | POST | `modules/work-orders/work-orders.controller.ts` | inventory.stock_issue | SUPER_ADMIN, ADMIN, INVENTORY_KEEPER, OPERATIONS_MANAGER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/parts/:lineId/return` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MECHANIC, TECHNICIAN, INVENTORY_KEEPER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/parts/:lineId/use` | PATCH | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MECHANIC, TECHNICIAN, INVENTORY_KEEPER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/parts/summary` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, TECHNICIAN, INVENTORY_KEEPER, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/parts` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, TECHNICIAN, INVENTORY_KEEPER, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/parts` | POST | `modules/work-orders/work-orders.controller.ts` | inventory.stock_issue | SUPER_ADMIN, ADMIN, ASSET_MANAGER, INVENTORY_KEEPER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/reject-supervisor` | POST | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/reject` | PATCH | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/reopen` | POST | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/status` | PATCH | `modules/work-orders/work-orders.controller.ts` | work_orders.update_status | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/submit-for-approval` | POST | `modules/work-orders/work-orders.controller.ts` | work_orders.manage, work_orders.update_status | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/taxonomy` | PATCH | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/vendor-repair/authorize` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/vendor-repair/invoices/:invoiceId/approve` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/vendor-repair/invoices/:invoiceId/reject` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/vendor-repair/invoices` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/vendor-repair/quotations/:quotationId/approve` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/vendor-repair/quotations/:quotationId/reject` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/vendor-repair/quotations` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/vendor-repair/request` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/vendor-repair/select-vendor` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/vendor-repair/vendor-completed` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR, TECHNICIAN, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/vendor-repair` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR, TECHNICIAN, MECHANIC | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/verify-qr` | POST | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, ASSET_MANAGER, MECHANIC, TECHNICIAN, FACILITY_MANAGER, MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id/verify-supervisor` | POST | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id` | DELETE | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/:id` | PATCH | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/action-required` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN, SUPERVISOR, INVENTORY_KEEPER, SECURITY_OFFICER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/bulk/assign` | POST | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/bulk/status` | POST | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/category-summary` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR, INVENTORY_KEEPER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/governance/exceptions` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/governance/parts-exceptions` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, INVENTORY_KEEPER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/queues/:queueKey` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN, SUPERVISOR, INVENTORY_KEEPER, SECURITY_OFFICER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/queues/diagnostics` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/queues` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN, SUPERVISOR, INVENTORY_KEEPER, SECURITY_OFFICER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/smart-views` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN, SUPERVISOR, INVENTORY_KEEPER, SECURITY_OFFICER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/taxonomy/:id/usage` | GET | `modules/work-order-taxonomy/work-order-taxonomy.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/taxonomy/:id` | PATCH | `modules/work-order-taxonomy/work-order-taxonomy.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/taxonomy/search` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN, SUPERVISOR, INVENTORY_KEEPER, SECURITY_OFFICER, VIEWER, DRIVER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/taxonomy/suggest` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN, SUPERVISOR, INVENTORY_KEEPER, SECURITY_OFFICER, VIEWER, DRIVER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/taxonomy` | GET | `modules/work-order-taxonomy/work-order-taxonomy.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, SUPERVISOR | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders/taxonomy` | POST | `modules/work-order-taxonomy/work-order-taxonomy.controller.ts` | — | SUPER_ADMIN, ADMIN | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders` | GET | `modules/work-orders/work-orders.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, MECHANIC, TECHNICIAN, SUPERVISOR, INVENTORY_KEEPER, SECURITY_OFFICER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/work-orders` | POST | `modules/work-orders/work-orders.controller.ts` | work_orders.manage | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/workforce/assignment-preview` | GET | `modules/workforce/workforce.controller.ts` | — | SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/workforce/employees/:id` | GET | `modules/workforce/workforce.controller.ts` | — | ...WORKFORCE_EMPLOYEE_READERS | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/workforce/employees/:id` | PUT | `modules/workforce/workforce.controller.ts` | — | ...WORKFORCE_EMPLOYEE_MANAGERS | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/workforce/employees` | GET | `modules/workforce/workforce.controller.ts` | — | ...WORKFORCE_EMPLOYEE_READERS | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |
| `/workforce/employees` | POST | `modules/workforce/workforce.controller.ts` | — | ...WORKFORCE_EMPLOYEE_MANAGERS | tenant via JwtAuthGuard + TenantContextGuard | yes | PASS |

## High-Risk Endpoint Checklist

| Area | Expected guard | Audit | Notes |
|------|----------------|-------|-------|
| Work order status update | `work_orders.update_status` or manager roles | yes | Service writes audit on sensitive transitions |
| Supervisor verification | supervisor/manager roles | yes | Governance service audited |
| Admin override | reason required + audit metadata.overrideFlag | yes | Fraud control report |
| Parts issue/return | `part_requests.issue` / inventory permissions | yes | Maker-checker enforced UAT-020 |
| Stock adjustment | `inventory.manage` | yes | Inventory service audit |
| Vendor/invoice approval | finance + manager permissions | yes | Maker-checker + fraud events |
| Gate-out override | `gate.override.approve` | yes | Gate block audit events |
| User/role management | `users.*` / `roles.manage` | yes | Admin console |
| Report export | manager/finance roles + export audit | yes | CSV export writes `report_exported` |
| Master data update | module manage permissions | yes | Department/asset services |
| Settings update | `settings.*.manage` | yes | Settings service audit |

## TODO Guidance

Routes marked TODO lack explicit `@Roles` or `@Permissions` on the handler. Review each endpoint:
- If intentionally self-service (e.g. profile), document exception.
- If tenant-scoped read for all authenticated users, add `@Permissions` view key.
- If mutation, add strict permission before production expansion.

## Verification

Re-generate this report:

```bash
node scripts/generate-backend-rbac-audit.mjs
```
