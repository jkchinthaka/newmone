# RBAC matrix

Generated from `@Roles` and `@Permissions` on controllers. Auth and webhook routes are public by design. Queue enforcement for SECURITY_OFFICER is in the work-order queue service, which denies that role even where a controller decorator still lists it.

| Method | Path | Mutating | Roles |
|---|---|---|---|
| DELETE | //vehicle-documents/:id | yes | perm: "vehicle_documents.manage" |
| DELETE | /assets/:id | yes | roles: ...ASSET_DELETE_ROLES |
| DELETE | /assets/:id/documents/:documentId | yes | roles: ...ASSET_WRITE_ROLES |
| DELETE | /cleaning/locations/:id | yes | roles: "SUPER_ADMIN", "ADMIN" |
| DELETE | /departments/:id | yes | roles: ...DEPARTMENT_MANAGE_ROLES |
| DELETE | /fleet/geofences/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER" |
| DELETE | /inventory/parts/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"; perm: "inventory.manage" |
| DELETE | /job-codes/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| DELETE | /maintenance/schedules/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| DELETE | /notifications/push/devices/:installationId | yes | self |
| DELETE | /roles/:id | yes | perm: "roles.manage" |
| DELETE | /users/:id | yes | perm: "users.delete" |
| DELETE | /vehicles/:id | yes | perm: "vehicles.delete" |
| DELETE | /work-orders/:id | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "work_orders.manage" |
| DELETE | /work-orders/:id/assignees/:assigneeId | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"; perm: "work_orders.manage" |
| DELETE | /work-orders/:id/evidence/:evidenceId | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER" |
| GET | //admin/approvals/rules | no | roles: ...MANAGE_ROLES; perm: "approvals.rule.manage" |
| GET | //admin/approvals/rules/:id | no | roles: ...MANAGE_ROLES; perm: "approvals.rule.manage" |
| GET | //approvals/:id | no | roles: ...READ_ROLES; perm: "approvals.view" |
| GET | //approvals/hooks/gate-override | no | roles: ...MANAGE_ROLES; perm: "approvals.rule.manage" |
| GET | //approvals/inbox | no | roles: ...READ_ROLES; perm: "approvals.view" |
| GET | //condition-events | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "AUDITOR"; perm: "reliability.view" |
| GET | //condition-rules | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "AUDITOR"; perm: "reliability.view" |
| GET | //custom-fields | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "VIEWER", "AUDITOR"; perm: "admin.organization.manage" |
| GET | //loto | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC", "AUDITOR"; perm: "safety.permit.view" |
| GET | //people | no | perm: "users.view" |
| GET | //people/:id | no | perm: "users.view" |
| GET | //reliability/asset-criticality | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "AUDITOR"; perm: "reliability.view" |
| GET | //reliability/policy | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "AUDITOR"; perm: "reliability.view" |
| GET | //reliability/rca | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "AUDITOR"; perm: "reliability.view" |
| GET | //reliability/rca/:id | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "AUDITOR"; perm: "reliability.view" |
| GET | //reliability/repeat-candidates | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "AUDITOR"; perm: "reliability.view" |
| GET | //reliability/summary | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "AUDITOR"; perm: "reliability.view" |
| GET | //search | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "VIEWER", "DRIVER", "AUDITOR"; perm: "assets.view" |
| GET | //sod-policies | no | roles: "SUPER_ADMIN", "ADMIN", "AUDITOR"; perm: "admin.organization.manage" |
| GET | //technicians | no | perm: "users.view" |
| GET | //technicians/assignable | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| GET | //vehicle-documents/:id | no | perm: "vehicle_documents.view" |
| GET | //vehicles/:vehicleId/documents | no | perm: "vehicle_documents.view" |
| GET | //work-orders/:id/downtime | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC", "AUDITOR"; perm: "reliability.view" |
| GET | //work-permits | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC", "AUDITOR"; perm: "safety.permit.view" |
| GET | /[predictive-ai, ai]/context | no | self |
| GET | /[predictive-ai, ai]/conversations | no | self |
| GET | /[predictive-ai, ai]/conversations/:id | no | self |
| GET | /[predictive-ai, ai]/conversations/:id/messages | no | self |
| GET | /[predictive-ai, ai]/field-insights | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER", "TECHNICIAN", "MECHANIC", "DRIVER"; perm: "predictive_insights.view" |
| GET | /[predictive-ai, ai]/logs | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "SUPERVISOR", "MANAGER", "TECHNICIAN" |
| GET | /[predictive-ai, ai]/predictive-logs | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "SUPERVISOR" |
| GET | /accidents | no | perm: "accidents.view" |
| GET | /accidents/:id | no | perm: "accidents.view" |
| GET | /admin-governance/data-quality | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "admin.dataquality.view" |
| GET | /admin-governance/overview | no | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.overview.view" |
| GET | /admin-governance/system | no | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.system.view" |
| GET | /admin-governance/users/:id/deactivate-preview | no | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.users.manage" |
| GET | /admin/asset-tags/template.csv | no | roles: "SUPER_ADMIN", "ADMIN" |
| GET | /admin/asset-tags/template.xlsx | no | roles: "SUPER_ADMIN", "ADMIN" |
| GET | /admin/invitations | no | roles: RoleName.SUPER_ADMIN, RoleName.ADMIN |
| GET | /admin/maintenance-config/analysis-codes | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "MAINTENANCE_SUPERVISOR", "SUPERVISOR", "TECHNICIAN", "MECHANIC"; perm: "work_orders.complete" |
| GET | /admin/maintenance-config/config-history | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "AUDITOR"; perm: "admin.audit.view" |
| GET | /admin/maintenance-config/feature-flags | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "admin.overview.view" |
| GET | /admin/maintenance-config/integrations-status | no | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.system.view" |
| GET | /admin/maintenance-config/job-categories | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "admin.organization.manage" |
| GET | /admin/maintenance-config/maintenance-templates | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN"; perm: "planning.view" |
| GET | /admin/maintenance-config/overview | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "admin.overview.view" |
| GET | /admin/maintenance-config/priority-sla | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "admin.organization.manage" |
| GET | /admin/maintenance-config/reason-codes | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "MAINTENANCE_SUPERVISOR", "SUPERVISOR", "TECHNICIAN", "MECHANIC"; perm: "work_orders.hold" |
| GET | /admin/maintenance-config/tax-rate | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "admin.overview.view" |
| GET | /admin/replication/status | no | roles: "SUPER_ADMIN"; perm: "settings.system.manage" |
| GET | /admin/roles-permissions | no | roles: RoleName.SUPER_ADMIN, RoleName.ADMIN |
| GET | /admin/simulators/config-dependencies | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "AUDITOR"; perm: "admin.organization.manage" |
| GET | /admin/tenants | no | roles: RoleName.SUPER_ADMIN, RoleName.ADMIN |
| GET | /admin/users | no | roles: RoleName.SUPER_ADMIN, RoleName.ADMIN |
| GET | /admin/users/:id | no | roles: RoleName.SUPER_ADMIN |
| GET | /asset-taxonomy/attributes | no | roles: ...READ_ROLES |
| GET | /asset-taxonomy/categories | no | roles: ...READ_ROLES |
| GET | /asset-taxonomy/domain-profiles | no | roles: ...READ_ROLES |
| GET | /asset-taxonomy/domain-profiles/:code | no | roles: ...READ_ROLES |
| GET | /asset-taxonomy/domains/:id/can-delete | no | roles: ...WRITE_ROLES |
| GET | /asset-taxonomy/types | no | roles: ...READ_ROLES |
| GET | /assets | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/:id | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/:id/children | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/:id/documents/:documentId | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/:id/maintenance-history | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/:id/movements | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/:id/qr-code | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/:id/qr-code/download | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/data-quality | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/export | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/filter-options | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/summary | no | roles: ...ASSET_READ_ROLES |
| GET | /assets/validate-tag | no | roles: ...ASSET_READ_ROLES |
| GET | /audit-logs | no | perm: "audit.view" |
| GET | /audit-logs/:entity/:entityId | no | perm: "audit.view" |
| GET | /audit-logs/export | no | perm: "audit.view" |
| GET | /auth/entra/status | no | public |
| GET | /auth/google | no | public |
| GET | /auth/google/callback | no | public |
| GET | /auth/invite/verify | no | public |
| GET | /auth/me | no | public |
| GET | /billing/subscription | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER" |
| GET | /billing/usage | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER" |
| GET | /build-info | no | (guard only) |
| GET | /bulk-import | no | roles: "SUPER_ADMIN" |
| GET | /bulk-import/:entity/:importId | no | roles: "SUPER_ADMIN" |
| GET | /bulk-import/:entity/:importId/errors | no | roles: "SUPER_ADMIN" |
| GET | /bulk-import/:entity/template | no | roles: "SUPER_ADMIN" |
| GET | /cleaning/analytics | no | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR" |
| GET | /cleaning/dashboard | no | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR" |
| GET | /cleaning/issues | no | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR", "CLEANER", "ASSET_MANAGER" |
| GET | /cleaning/locations | no | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR" |
| GET | /cleaning/locations/:id | no | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR", "CLEANER" |
| GET | /cleaning/locations/:id/qr | no | roles: "SUPER_ADMIN", "ADMIN" |
| GET | /cleaning/schedule/calendar | no | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR" |
| GET | /cleaning/users/cleaners | no | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR" |
| GET | /cleaning/visits | no | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR", "CLEANER" |
| GET | /cleaning/visits/:id | no | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR", "CLEANER" |
| GET | /cleaning/visits/export | no | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR" |
| GET | /compliance/expiring-documents | no | perm: "compliance.view" |
| GET | /compliance/summary | no | perm: "compliance.view" |
| GET | /compliance/vehicles/:vehicleId | no | perm: "compliance.view" |
| GET | /delivery-readiness/categories | no | perm: "delivery.view" |
| GET | /delivery-readiness/checklists | no | perm: "delivery.view" |
| GET | /delivery-readiness/checklists/:id | no | perm: "delivery.view" |
| GET | /delivery-readiness/dashboard | no | perm: "delivery.view" |
| GET | /delivery-readiness/export | no | perm: "delivery.export" |
| GET | /delivery-readiness/final-report | no | perm: "delivery.view" |
| GET | /delivery-readiness/items | no | perm: "delivery.view" |
| GET | /departments | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "MECHANIC", "TECHNICIAN", "VIEWER" |
| GET | /departments/:id | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "MECHANIC", "TECHNICIAN", "VIEWER" |
| GET | /driver-intelligence/dashboard | no | perm: "dashboard_analytics.view" |
| GET | /driver-intelligence/drivers | no | perm: "driver_intelligence.view" |
| GET | /driver-intelligence/drivers/:id | no | perm: "driver_intelligence.view" |
| GET | /driver-intelligence/drivers/:id/eligibility | no | perm: "driver_intelligence.view" |
| GET | /driver-intelligence/rankings/best-drivers | no | perm: "driver_intelligence.view" |
| GET | /driver-intelligence/vehicles/:vehicleId/cost-summary | no | perm: "vehicle_cost_analytics.view" |
| GET | /drivers | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| GET | /drivers/:id | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| GET | /enterprise-ops/assets/health | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"; perm: "assets.manage" |
| GET | /enterprise-ops/budget | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FINANCE"; perm: "reports.vehicle_cost.view" |
| GET | /enterprise-ops/compatibilities | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER"; perm: "inventory.manage" |
| GET | /enterprise-ops/costs | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FINANCE"; perm: "reports.vehicle_cost.view" |
| GET | /enterprise-ops/dashboard | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "VIEWER"; perm: "operations.view" |
| GET | /enterprise-ops/dispatch | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "work_orders.manage" |
| GET | /enterprise-ops/events | no | roles: "SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"; perm: "operations.view" |
| GET | /enterprise-ops/exceptions | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "VIEWER"; perm: "operations.view" |
| GET | /enterprise-ops/exceptions/:id | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "VIEWER"; perm: "operations.view" |
| GET | /enterprise-ops/forecasts | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "TECHNICIAN", "MECHANIC"; perm: "operations.view" |
| GET | /enterprise-ops/health | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FLEET_MANAGER"; perm: "vehicles.view" |
| GET | /enterprise-ops/health/:vehicleId | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FLEET_MANAGER"; perm: "vehicles.view" |
| GET | /enterprise-ops/installed-parts | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER"; perm: "operations.view" |
| GET | /enterprise-ops/mappings | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "operations.view" |
| GET | /enterprise-ops/matching | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FINANCE", "PROCUREMENT_OFFICER"; perm: "purchase_orders.view" |
| GET | /enterprise-ops/policy | no | roles: "SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"; perm: "operations.view" |
| GET | /enterprise-ops/procurement | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER", "PROCUREMENT_OFFICER"; perm: "purchase_orders.view" |
| GET | /enterprise-ops/sla | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "VIEWER"; perm: "operations.view" |
| GET | /enterprise-ops/vendors | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER"; perm: "purchase_orders.view" |
| GET | /enterprise-ops/warranty | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER"; perm: "operations.view" |
| GET | /entitlements/me | no | self |
| GET | /erp/access-checklist | no | perm: "erp.view" |
| GET | /erp/connection-test | no | perm: "erp.view" |
| GET | /erp/exceptions | no | perm: "erp.view" |
| GET | /erp/import/batches | no | perm: "erp.view" |
| GET | /erp/import/batches/:id | no | perm: "erp.view" |
| GET | /erp/mappings | no | perm: "erp.view" |
| GET | /erp/mock/status | no | perm: "erp.view" |
| GET | /erp/readiness | no | perm: "erp.view" |
| GET | /erp/reconciliation | no | perm: "erp.view" |
| GET | /erp/reconciliation/:id | no | perm: "erp.view" |
| GET | /erp/report | no | perm: "erp.view" |
| GET | /erp/status | no | perm: "erp.view" |
| GET | /evidence/readiness | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER" |
| GET | /facilities/buildings | no | roles: ...FACILITY_READ_ROLES; perm: "facilities.view" |
| GET | /facilities/buildings/:buildingId | no | roles: ...FACILITY_READ_ROLES; perm: "facilities.view" |
| GET | /facilities/dashboard | no | roles: ...FACILITY_READ_ROLES; perm: "facilities.view" |
| GET | /facilities/floors | no | roles: ...FACILITY_READ_ROLES; perm: "facilities.view" |
| GET | /facilities/floors/:floorId | no | roles: ...FACILITY_READ_ROLES; perm: "facilities.view" |
| GET | /facilities/properties | no | roles: ...FACILITY_READ_ROLES; perm: "facilities.view" |
| GET | /facilities/properties/:propertyId | no | roles: ...FACILITY_READ_ROLES; perm: "facilities.view" |
| GET | /facilities/reports/aging | no | roles: ...FACILITY_READ_ROLES; perm: "facilities.view" |
| GET | /facilities/rooms | no | roles: ...FACILITY_READ_ROLES; perm: "facilities.view" |
| GET | /facilities/rooms/:roomId | no | roles: ...FACILITY_READ_ROLES; perm: "facilities.view" |
| GET | /fleet-lifecycle/cost-per-km | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "VIEWER"; perm: "fleet.view" |
| GET | /fleet-lifecycle/fuel-efficiency | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "VIEWER"; perm: "fleet.view" |
| GET | /fleet-lifecycle/overview | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "OPERATIONS_MANAGER", "VIEWER", "TECHNICIAN", "MECHANIC"; perm: "fleet.view" |
| GET | /fleet-lifecycle/vehicles/:id/gate-eligibility | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "SECURITY_OFFICER", "DRIVER", "VIEWER"; perm: "gate.check" |
| GET | /fleet/alerts | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER" |
| GET | /fleet/geofences | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER" |
| GET | /fuel/analytics | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "DRIVER", "VIEWER" |
| GET | /fuel/logs | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "DRIVER", "VIEWER" |
| GET | /go-live/cutover-checklist | no | perm: "go_live.view" |
| GET | /go-live/dashboard | no | perm: "go_live.view" |
| GET | /go-live/decision-board | no | perm: "go_live.view" |
| GET | /go-live/export | no | perm: "go_live.export" |
| GET | /go-live/final-report | no | perm: "go_live.view" |
| GET | /go-live/live-issues | no | perm: "go_live.view" |
| GET | /go-live/pilots | no | perm: "go_live.view" |
| GET | /go-live/rollback-plan | no | perm: "go_live.view" |
| GET | /go-live/signoff | no | perm: "go_live.view" |
| GET | /go-live/waves | no | perm: "go_live.view" |
| GET | /health | no | public |
| GET | /health/build-info | no | roles: "SUPER_ADMIN", "ADMIN" |
| GET | /health/deployment-readiness | no | public |
| GET | /health/live | no | public |
| GET | /health/readiness | no | roles: "SUPER_ADMIN", "ADMIN" |
| GET | /health/ready | no | public |
| GET | /insurance-claims | no | perm: "insurance_claims.view" |
| GET | /insurance-claims/:id | no | perm: "insurance_claims.view" |
| GET | /inventory/analytics/top-used | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC"; perm: "inventory.manage" |
| GET | /inventory/analytics/usage | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC"; perm: "inventory.manage" |
| GET | /inventory/daily | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.manage" |
| GET | /inventory/dashboard | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.manage" |
| GET | /inventory/erp-import/:id | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER"; perm: "inventory.erp_import.view" |
| GET | /inventory/erp-import/history | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER"; perm: "inventory.erp_import.history" |
| GET | /inventory/erp/readiness | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER", "ASSET_MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER"; perm: "inventory.manage" |
| GET | /inventory/imports | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.erp_dry_run" |
| GET | /inventory/imports/:id | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.erp_dry_run" |
| GET | /inventory/low-stock | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.manage" |
| GET | /inventory/movements | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.manage" |
| GET | /inventory/parts | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.manage" |
| GET | /inventory/parts/:id | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.manage" |
| GET | /inventory/parts/:id/movements | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.manage" |
| GET | /inventory/parts/:id/purchase-history | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC"; perm: "inventory.manage" |
| GET | /inventory/parts/:id/work-orders | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC"; perm: "inventory.manage" |
| GET | /inventory/purchase-orders | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER", "FINANCE"; perm: "purchase_orders.view" |
| GET | /inventory/purchase-orders/:id | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER", "FINANCE"; perm: "purchase_orders.view" |
| GET | /inventory/purchase-orders/:id/receipts | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER", "FINANCE"; perm: "purchase_orders.view" |
| GET | /inventory/stock-counts | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.manage" |
| GET | /inventory/stock-counts/:id | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.manage" |
| GET | /inventory/warehouses | no | roles: ...INVENTORY_READ_ROLES; perm: "inventory.manage" |
| GET | /job-codes | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "TECHNICIAN", "MECHANIC", "SUPERVISOR", "VIEWER" |
| GET | /job-codes/:id | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "TECHNICIAN", "MECHANIC", "SUPERVISOR", "VIEWER" |
| GET | /maintenance-requests | no | perm: "maintenance_requests.view_own" |
| GET | /maintenance-requests/:id | no | perm: "maintenance_requests.view_own" |
| GET | /maintenance-requests/:id/duplicate-candidates | no | roles: ...TRIAGE_ROLES; perm: "maintenance_requests.triage" |
| GET | /maintenance-requests/:id/history | no | perm: "maintenance_requests.view_own" |
| GET | /maintenance-requests/:id/repeat-history | no | roles: ...TRIAGE_ROLES; perm: "maintenance_requests.triage" |
| GET | /maintenance-requests/asset-lookup | no | perm: "maintenance_requests.create" |
| GET | /maintenance-requests/problem-categories | no | perm: "maintenance_requests.view_own" |
| GET | /maintenance-requests/summary | no | perm: "maintenance_requests.view_own" |
| GET | /maintenance-requests/vehicle-lookup | no | perm: "maintenance_requests.create" |
| GET | /maintenance-supply/outstanding-tools | no | roles: ...READ_ROLES; perm: "parts.view" |
| GET | /maintenance-supply/parts | no | roles: ...READ_ROLES; perm: "parts.view" |
| GET | /maintenance-supply/work-orders/:id/cost | no | roles: ...READ_ROLES; perm: "cost.view" |
| GET | /maintenance/calendar | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "SUPERVISOR" |
| GET | /maintenance/dashboard | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "FLEET_MANAGER", "FACILITY_MANAGER", "BUILDING_SUPERVISOR", "SUPERVISOR", "MAINTENANCE_SUPERVISOR", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "VIEWER" |
| GET | /maintenance/logs | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC" |
| GET | /maintenance/predictive-alerts | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC" |
| GET | /maintenance/schedules | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC" |
| GET | /maintenance/schedules/:id | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC" |
| GET | /notifications | no | self |
| GET | /notifications/ai-summary | no | self |
| GET | /notifications/analytics | no | self |
| GET | /notifications/channels | no | self |
| GET | /notifications/preferences | no | self |
| GET | /notifications/push/readiness | no | self |
| GET | /notifications/readiness | no | roles: "SUPER_ADMIN", "ADMIN" |
| GET | /notifications/rules | no | self |
| GET | /notifications/templates/samples | no | roles: "SUPER_ADMIN", "ADMIN" |
| GET | /operations/alerts | no | roles: "SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER" |
| GET | /operations/alerts/mock-notifications | no | roles: "SUPER_ADMIN", "ADMIN" |
| GET | /operations/metrics | no | roles: "SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER" |
| GET | /operations/queue-reconciliation | no | roles: "SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER" |
| GET | /organization/data-quality | no | roles: ...ORG_MANAGE_ROLES; perm: "organization.manage" |
| GET | /organization/locations | no | roles: ...ORG_READ_ROLES; perm: "locations.view" |
| GET | /organization/locations/:locationId | no | roles: ...ORG_READ_ROLES; perm: "locations.view" |
| GET | /organization/locations/:locationId/children | no | roles: ...ORG_READ_ROLES; perm: "locations.view" |
| GET | /organization/locations/tree | no | roles: ...ORG_READ_ROLES; perm: "locations.view" |
| GET | /organization/migrations/free-text-locations | no | roles: ...ORG_MANAGE_ROLES; perm: "organization.manage" |
| GET | /organization/sites | no | roles: ...ORG_READ_ROLES; perm: "organization.view" |
| GET | /organization/sites/:siteId | no | roles: ...ORG_READ_ROLES; perm: "organization.view" |
| GET | /organization/summary | no | roles: ...ORG_READ_ROLES; perm: "organization.view" |
| GET | /planning/checklist-templates | no | roles: ...READ_ROLES; perm: "planning.view" |
| GET | /planning/due-work | no | roles: ...READ_ROLES; perm: "planning.view" |
| GET | /planning/inspection-templates | no | roles: ...READ_ROLES; perm: "planning.view" |
| GET | /planning/inspections | no | roles: ...READ_ROLES; perm: "planning.view" |
| GET | /planning/inspections/:id | no | roles: ...READ_ROLES; perm: "planning.view" |
| GET | /planning/pm-plans | no | roles: ...READ_ROLES; perm: "planning.view" |
| GET | /planning/pm-plans/:id/revisions | no | roles: ...READ_ROLES; perm: "planning.view" |
| GET | /planning/work-orders/:workOrderId/checklist-executions | no | roles: ...READ_ROLES; perm: "planning.view" |
| GET | /post-go-live | no | perm: "operations.view" |
| GET | /post-go-live/:id | no | perm: "operations.view" |
| GET | /post-go-live/dashboard | no | perm: "operations.view" |
| GET | /post-go-live/handover | no | perm: "operations.view" |
| GET | /post-go-live/hypercare | no | perm: "operations.view" |
| GET | /post-go-live/monitoring/dashboard | no | perm: "operations.view" |
| GET | /post-go-live/report | no | perm: "operations.view" |
| GET | /post-go-live/training | no | perm: "operations.view" |
| GET | /qa/categories | no | perm: "qa.view" |
| GET | /qa/dashboard | no | perm: "qa.view" |
| GET | /qa/issues | no | perm: "qa.view" |
| GET | /qa/issues/:id | no | perm: "qa.view" |
| GET | /qa/reports/export | no | perm: "qa.export" |
| GET | /qa/reports/release-quality | no | perm: "qa.view" |
| GET | /reporting-kpis | no | roles: ...ALL_REPORT_ROLES; perm: "reports.view" |
| GET | /reporting-kpis/:code | no | roles: ...ALL_REPORT_ROLES; perm: "reports.view" |
| GET | /reporting-kpis/home | no | roles: ...HOME_ROLES |
| GET | /reporting-kpis/home/:role | no | roles: ...HOME_ROLES |
| GET | /reports/:module | no | roles: ...REPORT_READ_ROLES |
| GET | /reports/:module/export | no | roles: ...REPORT_READ_ROLES |
| GET | /reports/dashboard | no | roles: ...REPORT_READ_ROLES |
| GET | /reports/downtime | no | roles: ...REPORT_READ_ROLES |
| GET | /reports/erp-monitoring | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FINANCE", "PROCUREMENT_OFFICER" |
| GET | /reports/fleet-efficiency | no | roles: ...REPORT_READ_ROLES |
| GET | /reports/fraud-control/admin-overrides | no | roles: ...FRAUD_REPORT_ROLES |
| GET | /reports/fraud-control/admin-overrides/export | no | roles: ...FRAUD_REPORT_ROLES |
| GET | /reports/fraud-control/dashboard | no | roles: ...FRAUD_REPORT_ROLES, "SUPERVISOR", "SECURITY_OFFICER" |
| GET | /reports/fraud-control/parts-misuse | no | roles: ...FRAUD_REPORT_ROLES, "SUPERVISOR" |
| GET | /reports/inventory | no | roles: ...REPORT_READ_ROLES |
| GET | /reports/maintenance-cost | no | roles: ...REPORT_READ_ROLES |
| GET | /reports/maintenance-costs | no | roles: ...REPORT_READ_ROLES; perm: "reports.view" |
| GET | /reports/maintenance-costs/export | no | roles: ...REPORT_READ_ROLES; perm: "reports.view" |
| GET | /reports/maintenance/assets | no | roles: ...MAINTENANCE_REPORT_ROLES |
| GET | /reports/maintenance/costs | no | roles: ...COST_REPORT_ROLES |
| GET | /reports/maintenance/exceptions | no | roles: ...MAINTENANCE_REPORT_ROLES |
| GET | /reports/maintenance/exceptions/:type | no | roles: ...MAINTENANCE_REPORT_ROLES |
| GET | /reports/maintenance/exceptions/:type/export | no | roles: ...MAINTENANCE_REPORT_ROLES |
| GET | /reports/maintenance/kpis | no | roles: ...MAINTENANCE_REPORT_ROLES |
| GET | /reports/maintenance/parts | no | roles: ...MAINTENANCE_REPORT_ROLES |
| GET | /reports/maintenance/risk-score/:workOrderId | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR", "INVENTORY_KEEPER", "TECHNICIAN", "MECHANIC" |
| GET | /reports/maintenance/workforce | no | roles: ...MAINTENANCE_REPORT_ROLES |
| GET | /reports/management/:reportKey/export | no | roles: ...MANAGEMENT_ROLES, "SUPERVISOR", "INVENTORY_KEEPER" |
| GET | /reports/management/cost-by-asset | no | roles: ...MANAGEMENT_ROLES |
| GET | /reports/management/cost-by-branch | no | roles: ...MANAGEMENT_ROLES |
| GET | /reports/management/cost-by-category | no | roles: ...MANAGEMENT_ROLES |
| GET | /reports/management/cost-by-department | no | roles: ...SUPERVISOR_ROLES |
| GET | /reports/management/cost-by-vehicle | no | roles: ...MANAGEMENT_ROLES |
| GET | /reports/management/downtime-cost | no | roles: ...MANAGEMENT_ROLES |
| GET | /reports/management/monthly-cost-trend | no | roles: ...MANAGEMENT_ROLES |
| GET | /reports/management/parts-usage-by-technician | no | roles: ...PARTS_ROLES |
| GET | /reports/management/profitability/summary | no | roles: ...MANAGEMENT_ROLES |
| GET | /reports/management/repair-vs-replace | no | roles: ...MANAGEMENT_ROLES |
| GET | /reports/management/repeated-breakdowns | no | roles: ...SUPERVISOR_ROLES |
| GET | /reports/management/top-high-cost-assets | no | roles: ...MANAGEMENT_ROLES |
| GET | /reports/management/top-high-cost-vehicles | no | roles: ...MANAGEMENT_ROLES |
| GET | /reports/management/vendor-cost-comparison | no | roles: ...MANAGEMENT_ROLES |
| GET | /reports/options | no | roles: ...REPORT_READ_ROLES |
| GET | /reports/templates | no | roles: ...REPORT_READ_ROLES |
| GET | /reports/utilities | no | roles: ...REPORT_READ_ROLES |
| GET | /reports/work-orders | no | roles: ...REPORT_READ_ROLES |
| GET | /reports/work-orders/category-changes | no | roles: ...REPORT_ROLES |
| GET | /reports/work-orders/category-summary | no | roles: ...REPORT_ROLES |
| GET | /reports/work-orders/category-summary/export | no | roles: ...REPORT_ROLES |
| GET | /reports/work-orders/top-issues | no | roles: ...REPORT_ROLES |
| GET | /reports/work-orders/triage | no | roles: ...REPORT_ROLES |
| GET | /roles | no | perm: "roles.view" |
| GET | /roles/permissions | no | perm: "permissions.view" |
| GET | /settings/audit-logs | no | perm: "audit.view" |
| GET | /settings/automation-rules | no | perm: "settings.view" |
| GET | /settings/digest-schedules | no | perm: "settings.view" |
| GET | /settings/feature-toggles | no | perm: "settings.view" |
| GET | /settings/integrations | no | perm: "settings.view" |
| GET | /settings/organization | no | perm: "settings.view" |
| GET | /settings/profile | no | self |
| GET | /settings/system | no | perm: "settings.view" |
| GET | /suppliers | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER", "OPERATIONS_MANAGER", "SUPERVISOR", "INVENTORY_KEEPER" |
| GET | /suppliers/:id | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER", "OPERATIONS_MANAGER", "SUPERVISOR", "INVENTORY_KEEPER" |
| GET | /support | no | perm: "operations.view" |
| GET | /support/:id | no | perm: "operations.view" |
| GET | /support/escalation-matrix | no | perm: "operations.view" |
| GET | /support/sla/breaches | no | perm: "operations.view" |
| GET | /support/sla/dashboard | no | perm: "operations.view" |
| GET | /support/tickets | no | perm: "operations.view" |
| GET | /support/tickets/:id | no | perm: "operations.view" |
| GET | /support/tickets/mine | no | perm: "support.create" |
| GET | /tenants/:id/invitations | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER" |
| GET | /tenants/me | no | self |
| GET | /traffic-fines | no | perm: "traffic_fines.view" |
| GET | /traffic-fines/:id | no | perm: "traffic_fines.view" |
| GET | /trips | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "DRIVER", "SUPERVISOR" |
| GET | /users | no | perm: "users.view" |
| GET | /users/:id | no | perm: "users.view" |
| GET | /utilities/analytics | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR" |
| GET | /utilities/bills | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR" |
| GET | /utilities/bills/:id | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR" |
| GET | /utilities/bills/overdue | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| GET | /utilities/meters | no | roles: ...METER_READING_ROLES |
| GET | /utilities/meters/:id | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR" |
| GET | /utilities/meters/:id/consumption-chart | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR" |
| GET | /utilities/meters/:id/readings | no | roles: ...METER_READING_ROLES |
| GET | /utilities/readings | no | roles: ...METER_READING_ROLES |
| GET | /vehicles | no | perm: "vehicles.view" |
| GET | /vehicles/:id | no | perm: "vehicles.view" |
| GET | /vehicles/:id/fuel-analytics | no | perm: "vehicles.view" |
| GET | /vehicles/:id/fuel-logs | no | perm: "vehicles.view" |
| GET | /vehicles/:id/gate-block-reasons | no | perm: "vehicles.view" |
| GET | /vehicles/:id/gate-movements | no | perm: "vehicles.view" |
| GET | /vehicles/:id/history | no | perm: "vehicles.view" |
| GET | /vehicles/:id/meter-logs | no | perm: "vehicles.view" |
| GET | /vehicles/:id/service-rule | no | perm: "vehicles.view" |
| GET | /vehicles/:id/trips | no | perm: "vehicles.view" |
| GET | /vehicles/alerts | no | perm: "vehicles.view" |
| GET | /vehicles/gate-queue | no | perm: "vehicles.view" |
| GET | /vehicles/lookup | no | perm: "vehicles.view" |
| GET | /vehicles/summary | no | perm: "vehicles.view" |
| GET | /vendor-portal/jobs | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "VENDOR", "TECHNICIAN", "VIEWER"; perm: "vendor.portal" |
| GET | /vendor-portal/jobs/:id | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "VENDOR", "TECHNICIAN", "VIEWER"; perm: "vendor.portal" |
| GET | /warranties | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "SUPERVISOR", "MECHANIC", "VIEWER", "AUDITOR"; perm: "warranty.view" |
| GET | /warranties/claims | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "AUDITOR", "FINANCE"; perm: "warranty.view" |
| GET | /work-orders | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "SUPERVISOR", "INVENTORY_KEEPER" |
| GET | /work-orders/:id | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "SUPERVISOR" |
| GET | /work-orders/:id/activity | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "SUPERVISOR" |
| GET | /work-orders/:id/assignees | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN" |
| GET | /work-orders/:id/domain-context | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "FLEET_MANAGER", "FACILITY_MANAGER", "BUILDING_SUPERVISOR", "MECHANIC", "TECHNICIAN", "SUPERVISOR", "VIEWER" |
| GET | /work-orders/:id/evidence | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "SUPERVISOR" |
| GET | /work-orders/:id/evidence/:evidenceId/content | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "SUPERVISOR" |
| GET | /work-orders/:id/history | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "SUPERVISOR" |
| GET | /work-orders/:id/next-actions | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR", "MECHANIC", "TECHNICIAN" |
| GET | /work-orders/:id/part-requests | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "SUPERVISOR"; perm: "part_requests.view" |
| GET | /work-orders/:id/parts | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER" |
| GET | /work-orders/:id/parts/summary | no | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER" |
| GET | /work-orders/:id/readiness | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC", "PLANNER"; perm: "work_orders.manage" |
| GET | /work-orders/:id/vendor-repair | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC" |
| GET | /work-orders/action-required | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "SUPERVISOR", "INVENTORY_KEEPER" |
| GET | /work-orders/category-summary | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR", "INVENTORY_KEEPER" |
| GET | /work-orders/governance/exceptions | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| GET | /work-orders/governance/parts-exceptions | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "INVENTORY_KEEPER", "SUPERVISOR" |
| GET | /work-orders/history | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "SUPERVISOR", "INVENTORY_KEEPER", "FLEET_MANAGER", "FACILITY_MANAGER", "BUILDING_SUPERVISOR" |
| GET | /work-orders/job-categories | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"; perm: "work_orders.manage" |
| GET | /work-orders/my-jobs | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "SUPERVISOR" |
| GET | /work-orders/queues | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "FLEET_MANAGER", "COMPLIANCE_MANAGER", "FACILITY_MANAGER", "BUILDING_SUPERVISOR", "MECHANIC", "TECHNICIAN", "SUPERVISOR", "INVENTORY_KEEPER", "VIEWER", "FINANCE" |
| GET | /work-orders/queues/:queueKey | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "SUPERVISOR", "INVENTORY_KEEPER" |
| GET | /work-orders/queues/diagnostics | no | roles: "SUPER_ADMIN", "ADMIN" |
| GET | /work-orders/smart-views | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "SUPERVISOR", "INVENTORY_KEEPER" |
| GET | /work-orders/taxonomy | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| GET | /work-orders/taxonomy/:id/usage | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER" |
| GET | /work-orders/taxonomy/search | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "SUPERVISOR", "INVENTORY_KEEPER", "VIEWER", "DRIVER" |
| GET | /work-orders/taxonomy/suggest | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "SUPERVISOR", "INVENTORY_KEEPER", "VIEWER", "DRIVER" |
| GET | /workflows | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "AUDITOR"; perm: "admin.organization.manage" |
| GET | /workforce/assignment-preview | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER" |
| GET | /workforce/employees | no | roles: ...WORKFORCE_EMPLOYEE_READERS |
| GET | /workforce/employees/:id | no | roles: ...WORKFORCE_EMPLOYEE_READERS |
| GET | /workforce/workload-summary | no | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER" |
| PATCH | //admin/approvals/rules/:id/deactivate | yes | roles: ...MANAGE_ROLES; perm: "approvals.rule.manage" |
| PATCH | //assets/:id/criticality | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER"; perm: "reliability.manage" |
| PATCH | //condition-events/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR"; perm: "reliability.manage" |
| PATCH | //loto/:id/status | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN"; perm: "safety.permit.manage" |
| PATCH | //people/:id | yes | perm: "users.edit" |
| PATCH | //reliability/capa/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR"; perm: "reliability.manage" |
| PATCH | //reliability/policy | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "reliability.manage" |
| PATCH | //reliability/rca/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR"; perm: "reliability.manage" |
| PATCH | //technicians/:id | yes | perm: "users.edit" |
| PATCH | //vehicle-documents/:id | yes | perm: "vehicle_documents.manage" |
| PATCH | //work-permits/:id/status | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR"; perm: "safety.permit.manage" |
| PATCH | /accidents/:id | yes | perm: "accidents.manage" |
| PATCH | /admin/maintenance-config/job-categories/:id | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| PATCH | /admin/maintenance-config/tax-rate | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| PATCH | /admin/roles/:id/permissions | yes | roles: RoleName.SUPER_ADMIN |
| PATCH | /admin/users/:id | yes | roles: RoleName.SUPER_ADMIN |
| PATCH | /admin/users/:id/password | yes | roles: RoleName.SUPER_ADMIN |
| PATCH | /admin/users/:id/status | yes | roles: RoleName.SUPER_ADMIN, RoleName.ADMIN |
| PATCH | /asset-taxonomy/attributes/:id | yes | roles: ...WRITE_ROLES |
| PATCH | /asset-taxonomy/categories/:id | yes | roles: ...WRITE_ROLES |
| PATCH | /asset-taxonomy/domains/:id | yes | roles: ...WRITE_ROLES |
| PATCH | /asset-taxonomy/domains/:id/profile | yes | roles: ...WRITE_ROLES |
| PATCH | /asset-taxonomy/types/:id | yes | roles: ...WRITE_ROLES |
| PATCH | /assets/:id | yes | roles: ...ASSET_WRITE_ROLES |
| PATCH | /assets/:id/status | yes | roles: ...ASSET_WRITE_ROLES |
| PATCH | /cleaning/issues/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR" |
| PATCH | /cleaning/locations/:id | yes | roles: "SUPER_ADMIN", "ADMIN" |
| PATCH | /delivery-readiness/checklists/:id | yes | perm: "delivery.manage" |
| PATCH | /delivery-readiness/items/:id | yes | perm: "delivery.manage" |
| PATCH | /departments/:id | yes | roles: ...DEPARTMENT_MANAGE_ROLES |
| PATCH | /departments/:id/deactivate | yes | roles: ...DEPARTMENT_MANAGE_ROLES |
| PATCH | /driver-intelligence/drivers/:id/inputs | yes | perm: "driver_intelligence.manage" |
| PATCH | /erp/access-checklist/:id | yes | perm: "erp.manage" |
| PATCH | /erp/mappings/:id | yes | perm: "erp.manage" |
| PATCH | /facilities/buildings/:buildingId | yes | roles: ...FACILITY_MANAGE_ROLES; perm: "facilities.manage" |
| PATCH | /facilities/floors/:floorId | yes | roles: ...FACILITY_MANAGE_ROLES; perm: "facilities.manage" |
| PATCH | /facilities/properties/:propertyId | yes | roles: ...FACILITY_MANAGE_ROLES; perm: "facilities.manage" |
| PATCH | /facilities/rooms/:roomId | yes | roles: ...FACILITY_MANAGE_ROLES; perm: "facilities.manage" |
| PATCH | /go-live/cutover-checklist/items/:id | yes | perm: "go_live.manage" |
| PATCH | /go-live/pilots/:id | yes | perm: "go_live.manage" |
| PATCH | /go-live/rollback-plan/:id | yes | perm: "go_live.manage" |
| PATCH | /go-live/waves/:id | yes | perm: "go_live.manage" |
| PATCH | /insurance-claims/:id | yes | perm: "insurance_claims.manage" |
| PATCH | /inventory/imports/:id/rows/:rowId/map | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"; perm: "inventory.erp_apply" |
| PATCH | /inventory/parts/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC"; perm: "inventory.manage" |
| PATCH | /inventory/parts/bulk-category | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"; perm: "inventory.manage" |
| PATCH | /inventory/purchase-orders/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "PROCUREMENT_OFFICER"; perm: "purchase_orders.create" |
| PATCH | /inventory/purchase-orders/:id/approve-finance | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FINANCE"; perm: "purchase_orders.approve_finance" |
| PATCH | /inventory/purchase-orders/:id/approve-operational | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "OPERATIONS_MANAGER"; perm: "purchase_orders.approve_operational" |
| PATCH | /inventory/purchase-orders/:id/reject | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "OPERATIONS_MANAGER"; perm: "purchase_orders.reject" |
| PATCH | /job-codes/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| PATCH | /maintenance/schedules/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| PATCH | /notifications/:id/read | yes | self |
| PATCH | /notifications/mark-all-read | yes | self |
| PATCH | /notifications/preferences | yes | self |
| PATCH | /notifications/rules | yes | self |
| PATCH | /organization/locations/:locationId | yes | roles: ...ORG_MANAGE_ROLES; perm: "locations.manage" |
| PATCH | /organization/sites/:siteId | yes | roles: ...ORG_MANAGE_ROLES; perm: "organization.manage" |
| PATCH | /post-go-live/handover | yes | perm: "operations.manage" |
| PATCH | /post-go-live/hypercare/:id | yes | perm: "operations.manage" |
| PATCH | /post-go-live/training/:id | yes | perm: "operations.manage" |
| PATCH | /qa/issues/:id | yes | perm: "qa.manage" |
| PATCH | /roles/:id | yes | perm: "roles.manage" |
| PATCH | /settings/automation-rules | yes | perm: "settings.system.manage" |
| PATCH | /settings/digest-schedules | yes | perm: "settings.system.manage" |
| PATCH | /settings/feature-toggles | yes | perm: "settings.system.manage" |
| PATCH | /settings/integrations | yes | perm: "settings.system.manage" |
| PATCH | /settings/organization | yes | perm: "settings.organization.manage" |
| PATCH | /settings/profile | yes | self |
| PATCH | /settings/system | yes | perm: "settings.system.manage" |
| PATCH | /suppliers/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER", "OPERATIONS_MANAGER" |
| PATCH | /support/:id | yes | perm: "release.manage" |
| PATCH | /support/escalation-matrix/:id | yes | perm: "support.manage" |
| PATCH | /support/tickets/:id | yes | perm: "support.manage" |
| PATCH | /users/:id | yes | perm: "users.edit" |
| PATCH | /users/:id/status | yes | perm: "users.status.manage" |
| PATCH | /utilities/bills/:id/pay | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| PATCH | /utilities/bills/pay | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| PATCH | /utilities/meters/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| PATCH | /vehicles/:id | yes | perm: "vehicles.edit" |
| PATCH | /vehicles/:id/service-rule | yes | perm: "vehicles.edit" |
| PATCH | /vendor-portal/jobs/:id/progress | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "VENDOR"; perm: "vendor.portal" |
| PATCH | /warranties/claims/:id/status | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "warranty.manage" |
| PATCH | /work-orders/:id | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"; perm: "work_orders.manage" |
| PATCH | /work-orders/:id/approve | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "work_orders.manage" |
| PATCH | /work-orders/:id/classify-triage | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| PATCH | /work-orders/:id/evidence/:evidenceId | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER" |
| PATCH | /work-orders/:id/part-requests/:requestId/approve-finance | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "part_requests.approve_finance" |
| PATCH | /work-orders/:id/part-requests/:requestId/approve-operational | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER"; perm: "part_requests.approve_operational" |
| PATCH | /work-orders/:id/part-requests/:requestId/reject | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER"; perm: "part_requests.reject" |
| PATCH | /work-orders/:id/parts/:lineId/use | yes | roles: "SUPER_ADMIN", "ADMIN", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "ASSET_MANAGER" |
| PATCH | /work-orders/:id/reject | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "work_orders.manage" |
| PATCH | /work-orders/:id/status | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN"; perm: "work_orders.update_status" |
| PATCH | /work-orders/:id/taxonomy | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| PATCH | /work-orders/taxonomy/:id | yes | roles: "SUPER_ADMIN", "ADMIN" |
| PATCH | /work-orders/taxonomy/:id/deactivate | yes | roles: "SUPER_ADMIN", "ADMIN" |
| POST | //admin/approvals/rules | yes | roles: ...MANAGE_ROLES; perm: "approvals.rule.manage" |
| POST | //admin/approvals/rules/:id/version | yes | roles: ...MANAGE_ROLES; perm: "approvals.rule.manage" |
| POST | //admin/approvals/rules/preview | yes | roles: ...MANAGE_ROLES; perm: "approvals.rule.manage" |
| POST | //admin/approvals/rules/simulate | yes | roles: ...MANAGE_ROLES; perm: "approvals.rule.manage" |
| POST | //approval-delegations | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "approvals.rule.manage" |
| POST | //approvals/:id/decide | yes | roles: ...DECIDE_ROLES; perm: "approvals.decide" |
| POST | //approvals/:id/emergency-override | yes | roles: ...DECIDE_ROLES; perm: "approvals.override.emergency" |
| POST | //approvals/:id/escalate | yes | roles: ...MANAGE_ROLES; perm: "approvals.rule.manage" |
| POST | //condition-rules | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "reliability.manage" |
| POST | //custom-fields | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | //downtime/:segmentId/close | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC"; perm: "reliability.manage" |
| POST | //loto | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN"; perm: "safety.permit.manage" |
| POST | //meter-corrections | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN"; perm: "assets.manage" |
| POST | //meter-corrections/:id/decision | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "assets.manage" |
| POST | //outbound-webhooks | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | //outbound-webhooks/retry-failed | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | //people | yes | perm: "users.create" |
| POST | //people/:id/deactivate | yes | perm: "users.status.manage" |
| POST | //people/:id/disable-login | yes | perm: "users.status.manage" |
| POST | //people/:id/enable-login | yes | perm: "users.create" |
| POST | //people/:id/reactivate | yes | perm: "users.status.manage" |
| POST | //people/:id/technician-profile | yes | perm: "users.edit" |
| POST | //reliability/asset-criticality/bulk | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER"; perm: "reliability.manage" |
| POST | //reliability/rca | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN"; perm: "reliability.manage" |
| POST | //reliability/rca/:id/capa | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR"; perm: "reliability.manage" |
| POST | //reliability/rca/:id/effectiveness | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR"; perm: "reliability.manage" |
| POST | //service-api-keys | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | //service-api-keys/:id/revoke | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | //sod-policies | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | //sod-policies/evaluate | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "admin.organization.manage" |
| POST | //temporary-repairs | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN"; perm: "work_orders.manage" |
| POST | //users/:id/resend-invite | yes | perm: "users.create" |
| POST | //users/:id/reset-password | yes | perm: "users.edit" |
| POST | //users/:id/revoke-invite | yes | perm: "users.edit" |
| POST | //users/:id/send-invite | yes | perm: "users.create" |
| POST | //vehicle-documents/:id/reject | yes | perm: "vehicle_documents.verify" |
| POST | //vehicle-documents/:id/verify | yes | perm: "vehicle_documents.verify" |
| POST | //vehicles/:vehicleId/documents | yes | perm: "vehicle_documents.manage" |
| POST | //work-orders/:id/downtime | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC"; perm: "reliability.manage" |
| POST | //work-permits | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR"; perm: "safety.permit.manage" |
| POST | /[predictive-ai, ai]/actions/assign-technician | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER" |
| POST | /[predictive-ai, ai]/actions/create-work-order | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER" |
| POST | /[predictive-ai, ai]/actions/generate-report | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER" |
| POST | /[predictive-ai, ai]/actions/schedule-maintenance | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER" |
| POST | /[predictive-ai, ai]/conversations | yes | self |
| POST | /[predictive-ai, ai]/copilot | yes | self |
| POST | /accidents | yes | perm: "accidents.report" |
| POST | /accidents/:id/evidence | yes | perm: "accidents.report" |
| POST | /accidents/:id/work-order | yes | perm: "accidents.manage" |
| POST | /admin-governance/config-change/guard | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.system.view" |
| POST | /admin/asset-tags/apply | yes | roles: "SUPER_ADMIN", "ADMIN" |
| POST | /admin/asset-tags/preview | yes | roles: "SUPER_ADMIN", "ADMIN" |
| POST | /admin/invitations | yes | roles: RoleName.SUPER_ADMIN, RoleName.ADMIN |
| POST | /admin/maintenance-config/analysis-codes | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | /admin/maintenance-config/feature-flags | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.features.manage" |
| POST | /admin/maintenance-config/job-categories | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | /admin/maintenance-config/job-categories/seed-defaults | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | /admin/maintenance-config/maintenance-templates | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "maintenance.templates.manage" |
| POST | /admin/maintenance-config/maintenance-templates/:id/active | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "maintenance.templates.manage" |
| POST | /admin/maintenance-config/maintenance-templates/:id/revise | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "maintenance.templates.manage" |
| POST | /admin/maintenance-config/maintenance-templates/seed-defaults | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "maintenance.templates.manage" |
| POST | /admin/maintenance-config/priority-sla | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | /admin/maintenance-config/reason-codes | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | /admin/permissions/sync | yes | roles: RoleName.SUPER_ADMIN |
| POST | /admin/simulators/repair-replace-evidence | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER"; perm: "assets.view" |
| POST | /admin/simulators/workflow-transition | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "admin.organization.manage" |
| POST | /admin/users | yes | roles: RoleName.SUPER_ADMIN |
| POST | /asset-taxonomy/attributes | yes | roles: ...WRITE_ROLES |
| POST | /asset-taxonomy/categories | yes | roles: ...WRITE_ROLES |
| POST | /asset-taxonomy/domains | yes | roles: ...WRITE_ROLES |
| POST | /asset-taxonomy/domains/:id/deactivate | yes | roles: ...WRITE_ROLES |
| POST | /asset-taxonomy/seed-defaults | yes | roles: ...WRITE_ROLES |
| POST | /asset-taxonomy/types | yes | roles: ...WRITE_ROLES |
| POST | /assets | yes | roles: ...ASSET_CREATE_ROLES |
| POST | /assets/:id/dispose | yes | roles: ...ASSET_WRITE_ROLES |
| POST | /assets/:id/documents | yes | roles: ...ASSET_WRITE_ROLES |
| POST | /assets/:id/link-vehicle | yes | roles: ...ASSET_WRITE_ROLES |
| POST | /assets/:id/move | yes | roles: ...ASSET_WRITE_ROLES |
| POST | /assets/:id/parent | yes | roles: ...ASSET_WRITE_ROLES |
| POST | /assets/:id/qr-code/regenerate | yes | roles: ...ASSET_WRITE_ROLES |
| POST | /assets/:id/restore | yes | roles: ...ASSET_WRITE_ROLES |
| POST | /assets/:id/retire | yes | roles: ...ASSET_WRITE_ROLES |
| POST | /assets/bulk-action | yes | roles: ...ASSET_WRITE_ROLES |
| POST | /assets/bulk-import | yes | roles: ...ASSET_CREATE_ROLES |
| POST | /assets/migrations/legacy-categories | yes | roles: ...ASSET_WRITE_ROLES |
| POST | /auth/forgot-password | yes | public |
| POST | /auth/invite/accept | yes | self |
| POST | /auth/login | yes | public |
| POST | /auth/logout | yes | self |
| POST | /auth/logout-all | yes | public |
| POST | /auth/refresh | yes | public |
| POST | /auth/register | yes | public |
| POST | /auth/reset-password | yes | public |
| POST | /billing/checkout-session | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER" |
| POST | /billing/webhooks/stripe | yes | public |
| POST | /bulk-import/:entity/:importId/commit | yes | roles: "SUPER_ADMIN" |
| POST | /bulk-import/:entity/preview | yes | roles: "SUPER_ADMIN" |
| POST | /cleaning/enforcement/run | yes | roles: "SUPER_ADMIN", "ADMIN", "SUPERVISOR" |
| POST | /cleaning/issues | yes | roles: "CLEANER", "SUPERVISOR", "ADMIN", "SUPER_ADMIN", "ASSET_MANAGER" |
| POST | /cleaning/issues/:id/create-work-order | yes | roles: "SUPER_ADMIN", "ADMIN", "FACILITY_MANAGER", "BUILDING_SUPERVISOR", "MANAGER", "SUPERVISOR"; perm: "facility_issues.manage" |
| POST | /cleaning/issues/duplicate-check | yes | roles: "CLEANER", "SUPERVISOR", "ADMIN", "SUPER_ADMIN", "ASSET_MANAGER" |
| POST | /cleaning/locations | yes | roles: "SUPER_ADMIN", "ADMIN" |
| POST | /cleaning/locations/:id/regenerate-qr | yes | roles: "SUPER_ADMIN", "ADMIN" |
| POST | /cleaning/scan | yes | roles: "CLEANER", "SUPERVISOR", "ADMIN", "SUPER_ADMIN" |
| POST | /cleaning/visits/:id/sign-off | yes | roles: "SUPERVISOR", "ADMIN", "SUPER_ADMIN" |
| POST | /cleaning/visits/:id/submit | yes | roles: "CLEANER", "SUPERVISOR", "ADMIN", "SUPER_ADMIN" |
| POST | /cleaning/visits/scan | yes | roles: "CLEANER", "SUPERVISOR", "ADMIN", "SUPER_ADMIN" |
| POST | /delivery-readiness/checklists | yes | perm: "delivery.manage" |
| POST | /delivery-readiness/checklists/:id/items | yes | perm: "delivery.manage" |
| POST | /delivery-readiness/items/:id/accept-risk | yes | perm: "delivery.accept_risk" |
| POST | /delivery-readiness/items/:id/complete | yes | perm: "delivery.manage" |
| POST | /delivery-readiness/items/:id/fail | yes | perm: "delivery.manage" |
| POST | /delivery-readiness/sign-off | yes | perm: "delivery.sign_off" |
| POST | /departments | yes | roles: ...DEPARTMENT_MANAGE_ROLES |
| POST | /drivers | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| POST | /enterprise-ops/compatibilities | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER"; perm: "inventory.manage" |
| POST | /enterprise-ops/events/:id/acknowledge | yes | roles: "SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"; perm: "operations.manage" |
| POST | /enterprise-ops/exceptions/:id/resolve | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "operations.manage" |
| POST | /enterprise-ops/exceptions/scan | yes | roles: "SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"; perm: "operations.manage" |
| POST | /enterprise-ops/forecasts/refresh | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "operations.manage" |
| POST | /enterprise-ops/procurement/:id/create-po | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER"; perm: "purchase_orders.create" |
| POST | /enterprise-ops/procurement/:id/review | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER"; perm: "purchase_orders.view" |
| POST | /enterprise-ops/procurement/evaluate | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER"; perm: "purchase_orders.create" |
| POST | /erp/import/batch | yes | perm: "erp.import" |
| POST | /erp/import/batches/:id/apply | yes | perm: "erp.import" |
| POST | /erp/import/batches/:id/approve | yes | perm: "erp.import" |
| POST | /erp/import/batches/:id/cancel | yes | perm: "erp.import" |
| POST | /erp/import/batches/:id/dry-run | yes | perm: "erp.import" |
| POST | /erp/mappings | yes | perm: "erp.manage" |
| POST | /erp/mock/sync | yes | perm: "erp.manage" |
| POST | /erp/reconciliation/:id/accept | yes | perm: "erp.reconcile" |
| POST | /erp/reconciliation/:id/mark-corrected | yes | perm: "erp.reconcile" |
| POST | /erp/reconciliation/:id/review | yes | perm: "erp.reconcile" |
| POST | /erp/reconciliation/detect | yes | perm: "erp.reconcile" |
| POST | /facilities/buildings | yes | roles: ...FACILITY_MANAGE_ROLES; perm: "facilities.manage" |
| POST | /facilities/floors | yes | roles: ...FACILITY_MANAGE_ROLES; perm: "facilities.manage" |
| POST | /facilities/properties | yes | roles: ...FACILITY_MANAGE_ROLES; perm: "facilities.manage" |
| POST | /facilities/rooms | yes | roles: ...FACILITY_MANAGE_ROLES; perm: "facilities.manage" |
| POST | /fleet-lifecycle/accidents/:id/link-repair | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER"; perm: "fleet.accident.manage" |
| POST | /fleet-lifecycle/assignments/:id/return | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "OPERATIONS_MANAGER"; perm: "fleet.assignment.manage" |
| POST | /fleet-lifecycle/batteries/:id/replace | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "TECHNICIAN", "MECHANIC"; perm: "fleet.battery.manage" |
| POST | /fleet-lifecycle/batteries/install | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "TECHNICIAN", "MECHANIC"; perm: "fleet.battery.manage" |
| POST | /fleet-lifecycle/tyres/:id/move | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "TECHNICIAN", "MECHANIC"; perm: "fleet.tyre.manage" |
| POST | /fleet-lifecycle/tyres/:id/remove | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "TECHNICIAN", "MECHANIC"; perm: "fleet.tyre.manage" |
| POST | /fleet-lifecycle/tyres/install | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "TECHNICIAN", "MECHANIC"; perm: "fleet.tyre.manage" |
| POST | /fleet-lifecycle/vehicles/:id/assign-driver | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "OPERATIONS_MANAGER"; perm: "fleet.assignment.manage" |
| POST | /fleet-lifecycle/vehicles/:id/ensure-mileage-meter | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER"; perm: "fleet.vehicle.manage" |
| POST | /fleet-lifecycle/vehicles/backfill-assets | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "fleet.vehicle.manage" |
| POST | /fleet/geofences | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER" |
| POST | /go-live/cutover-checklist/items | yes | perm: "go_live.manage" |
| POST | /go-live/decision-board/decision | yes | perm: "go_live.manage" |
| POST | /go-live/pilots | yes | perm: "go_live.manage" |
| POST | /go-live/pilots/:id/complete | yes | perm: "go_live.manage" |
| POST | /go-live/pilots/:id/extend | yes | perm: "go_live.manage" |
| POST | /go-live/pilots/:id/start | yes | perm: "go_live.manage" |
| POST | /go-live/rollback-plan | yes | perm: "go_live.manage" |
| POST | /go-live/signoff | yes | perm: "go_live.sign_off" |
| POST | /go-live/signoff/:id/revoke | yes | perm: "go_live.sign_off" |
| POST | /go-live/waves | yes | perm: "go_live.manage" |
| POST | /go-live/waves/:id/complete | yes | perm: "go_live.manage" |
| POST | /go-live/waves/:id/pause | yes | perm: "go_live.manage" |
| POST | /go-live/waves/:id/start | yes | perm: "go_live.manage" |
| POST | /insurance-claims | yes | perm: "insurance_claims.manage" |
| POST | /insurance-claims/:id/status | yes | perm: "insurance_claims.approve" |
| POST | /inventory/adjustments | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"; perm: "inventory.manage" |
| POST | /inventory/erp-import/:id/apply | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER"; perm: "inventory.erp_import.apply" |
| POST | /inventory/erp-import/:id/validate | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER"; perm: "inventory.erp_import.upload" |
| POST | /inventory/erp-import/upload | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER"; perm: "inventory.erp_import.upload" |
| POST | /inventory/erp/stock-sync/apply | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"; perm: "inventory.erp_apply" |
| POST | /inventory/erp/stock-sync/dry-run | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER", "ASSET_MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER"; perm: "inventory.erp_dry_run" |
| POST | /inventory/imports/:id/apply | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"; perm: "inventory.erp_apply" |
| POST | /inventory/imports/preview | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER"; perm: "inventory.erp_dry_run" |
| POST | /inventory/parts | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC"; perm: "inventory.manage" |
| POST | /inventory/parts/:id/stock-in | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC"; perm: "inventory.manage" |
| POST | /inventory/parts/:id/stock-out | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER"; perm: "inventory.stock_issue" |
| POST | /inventory/parts/bulk-delete | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"; perm: "inventory.manage" |
| POST | /inventory/purchase-orders | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "PROCUREMENT_OFFICER"; perm: "purchase_orders.create" |
| POST | /inventory/purchase-orders/:id/erp-sync | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "purchase_orders.erp_sync" |
| POST | /inventory/purchase-orders/:id/erp-sync/retry | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"; perm: "purchase_orders.erp_sync_retry" |
| POST | /inventory/purchase-orders/:id/receipts | yes | roles: "SUPER_ADMIN", "ADMIN", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER"; perm: "purchase_orders.receive" |
| POST | /inventory/reversals | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"; perm: "inventory.manage" |
| POST | /inventory/stock-counts | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER"; perm: "inventory.manage" |
| POST | /inventory/stock-counts/:id/transition | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER"; perm: "inventory.manage" |
| POST | /inventory/transfers | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER"; perm: "inventory.manage" |
| POST | /job-codes | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| POST | /maintenance-requests | yes | perm: "maintenance_requests.create" |
| POST | /maintenance-requests/:id/approve | yes | roles: ...TRIAGE_ROLES; perm: "maintenance_requests.approve" |
| POST | /maintenance-requests/:id/cancel | yes | perm: "maintenance_requests.cancel_own" |
| POST | /maintenance-requests/:id/convert-to-work-order | yes | roles: ...TRIAGE_ROLES; perm: "maintenance_requests.convert" |
| POST | /maintenance-requests/:id/mark-duplicate | yes | roles: ...TRIAGE_ROLES; perm: "maintenance_requests.triage" |
| POST | /maintenance-requests/:id/needs-information | yes | roles: ...TRIAGE_ROLES; perm: "maintenance_requests.triage" |
| POST | /maintenance-requests/:id/reject | yes | roles: ...TRIAGE_ROLES; perm: "maintenance_requests.reject" |
| POST | /maintenance-requests/:id/respond | yes | perm: "maintenance_requests.create" |
| POST | /maintenance-requests/:id/resume-review | yes | roles: ...TRIAGE_ROLES; perm: "maintenance_requests.triage" |
| POST | /maintenance-requests/:id/start-review | yes | roles: ...TRIAGE_ROLES; perm: "maintenance_requests.triage" |
| POST | /maintenance-requests/:id/triage | yes | roles: ...TRIAGE_ROLES; perm: "maintenance_requests.triage" |
| POST | /maintenance-requests/problem-categories/seed | yes | roles: ...TRIAGE_ROLES |
| POST | /maintenance-supply/contracts | yes | roles: ...MANAGE_ROLES; perm: "contract.manage" |
| POST | /maintenance-supply/contracts/refresh-expiry | yes | roles: ...MANAGE_ROLES; perm: "contract.manage" |
| POST | /maintenance-supply/map-erp-item | yes | roles: ...MANAGE_ROLES; perm: "erp.mapping.manage" |
| POST | /maintenance-supply/map-warehouse | yes | roles: ...MANAGE_ROLES; perm: "erp.mapping.manage" |
| POST | /maintenance-supply/part-issues/:id/return | yes | roles: ...FIELD_ROLES; perm: "parts.return" |
| POST | /maintenance-supply/work-orders/:id/assign-vendor | yes | roles: ...MANAGE_ROLES; perm: "vendor.manage" |
| POST | /maintenance-supply/work-orders/:id/cost-snapshot | yes | roles: ...MANAGE_ROLES; perm: "cost.adjust" |
| POST | /maintenance-supply/work-orders/:id/cost-snapshot/auto | yes | roles: ...MANAGE_ROLES; perm: "cost.adjust" |
| POST | /maintenance/logs | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC" |
| POST | /maintenance/predictive-alerts/:id/acknowledge | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC" |
| POST | /maintenance/schedules | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| POST | /notifications/:id/actions | yes | self |
| POST | /notifications/:id/explain | yes | self |
| POST | /notifications/push/devices | yes | self |
| POST | /notifications/uat/email-test | yes | roles: "SUPER_ADMIN", "ADMIN" |
| POST | /notifications/uat/sms-test | yes | roles: "SUPER_ADMIN", "ADMIN" |
| POST | /operations/alerts/:id/acknowledge | yes | roles: "SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER" |
| POST | /operations/alerts/evaluate | yes | roles: "SUPER_ADMIN", "ADMIN" |
| POST | /operations/queue-reconciliation/run | yes | roles: "SUPER_ADMIN", "ADMIN" |
| POST | /operations/scan-lookup | yes | roles: "SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "FLEET_MANAGER", "COMPLIANCE_MANAGER", "MANAGER", "TECHNICIAN", "MECHANIC", "ASSET_MANAGER", "SUPERVISOR", "SECURITY_OFFICER", "DRIVER"; perm: "operations.scan_lookup" |
| POST | /organization/locations | yes | roles: ...ORG_MANAGE_ROLES; perm: "locations.manage" |
| POST | /organization/locations/:locationId/move | yes | roles: ...ORG_MANAGE_ROLES; perm: "locations.manage" |
| POST | /organization/migrations/facility-hierarchy | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "organization.manage" |
| POST | /organization/sites | yes | roles: ...ORG_MANAGE_ROLES; perm: "organization.manage" |
| POST | /planning/calibrations | yes | roles: ...FIELD_ROLES; perm: "planning.manage" |
| POST | /planning/checklist-executions | yes | roles: ...FIELD_ROLES; perm: "planning.manage" |
| POST | /planning/checklist-templates | yes | roles: ...MANAGE_ROLES; perm: "planning.manage" |
| POST | /planning/compliance | yes | roles: ...MANAGE_ROLES; perm: "planning.manage" |
| POST | /planning/inspections | yes | roles: ...FIELD_ROLES; perm: "planning.manage" |
| POST | /planning/inspections/:id/complete | yes | roles: ...FIELD_ROLES; perm: "planning.manage" |
| POST | /planning/inspections/:id/evidence | yes | roles: ...FIELD_ROLES; perm: "planning.manage" |
| POST | /planning/inspections/:id/reinspect | yes | roles: ...MANAGE_ROLES; perm: "planning.manage" |
| POST | /planning/inspections/:id/start | yes | roles: ...FIELD_ROLES; perm: "planning.manage" |
| POST | /planning/inspections/schedule | yes | roles: ...MANAGE_ROLES; perm: "planning.manage" |
| POST | /planning/meters | yes | roles: ...MANAGE_ROLES; perm: "planning.manage" |
| POST | /planning/meters/:id/readings | yes | roles: ...FIELD_ROLES; perm: "planning.manage" |
| POST | /planning/pm-plans | yes | roles: ...MANAGE_ROLES; perm: "planning.manage" |
| POST | /planning/pm-plans/:id/auto-wo | yes | roles: ...MANAGE_ROLES; perm: "planning.manage" |
| POST | /post-go-live | yes | perm: "change_request.create" |
| POST | /post-go-live/:id/approve | yes | perm: "change_request.approve" |
| POST | /post-go-live/:id/reject | yes | perm: "change_request.approve" |
| POST | /post-go-live/:id/status | yes | perm: "change_request.manage" |
| POST | /post-go-live/hypercare | yes | perm: "operations.manage" |
| POST | /post-go-live/hypercare/:id/complete | yes | perm: "operations.manage" |
| POST | /post-go-live/hypercare/:id/extend | yes | perm: "operations.manage" |
| POST | /post-go-live/training | yes | perm: "operations.manage" |
| POST | /post-go-live/training/:id/complete | yes | perm: "operations.manage" |
| POST | /post-go-live/training/:id/mark-retraining | yes | perm: "operations.manage" |
| POST | /qa/issues | yes | perm: "qa.create" |
| POST | /qa/issues/:id/accept-risk | yes | perm: "qa.accept_risk" |
| POST | /qa/issues/:id/assign | yes | perm: "qa.manage" |
| POST | /qa/issues/:id/close | yes | perm: "qa.manage" |
| POST | /qa/issues/:id/rca | yes | perm: "qa.manage" |
| POST | /qa/issues/:id/regression-test | yes | perm: "qa.manage" |
| POST | /qa/issues/:id/reopen | yes | perm: "qa.manage" |
| POST | /qa/issues/:id/status | yes | perm: "qa.manage" |
| POST | /qa/issues/:id/triage | yes | perm: "qa.manage" |
| POST | /qa/issues/from-health-check | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "qa.manage" |
| POST | /reporting-kpis/overview | yes | roles: ...ALL_REPORT_ROLES; perm: "reports.view" |
| POST | /reports/templates | yes | roles: "SUPER_ADMIN", "ADMIN" |
| POST | /roles | yes | perm: "roles.manage" |
| POST | /roles/permissions | yes | perm: "permissions.create" |
| POST | /suppliers | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER", "OPERATIONS_MANAGER" |
| POST | /suppliers/:id/blacklist | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER" |
| POST | /support | yes | perm: "release.manage" |
| POST | /support/:id/mark-deployed | yes | perm: "release.manage" |
| POST | /support/:id/rollback | yes | perm: "release.manage" |
| POST | /support/:id/schedule | yes | perm: "release.manage" |
| POST | /support/escalation-matrix | yes | perm: "support.manage" |
| POST | /support/sla/recalculate | yes | perm: "support.manage" |
| POST | /support/tickets | yes | perm: "support.create" |
| POST | /support/tickets/:id/acknowledge | yes | perm: "support.manage" |
| POST | /support/tickets/:id/assign | yes | perm: "support.manage" |
| POST | /support/tickets/:id/close | yes | perm: "support.manage" |
| POST | /support/tickets/:id/reopen | yes | perm: "support.manage" |
| POST | /support/tickets/:id/resolve | yes | perm: "support.manage" |
| POST | /support/tickets/:id/status | yes | perm: "support.manage" |
| POST | /tenants/:id/invitations | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER" |
| POST | /tenants/:id/switch | yes | self |
| POST | /traffic-fines | yes | perm: "traffic_fines.report" |
| POST | /traffic-fines/:id/payment | yes | perm: "traffic_fines.payment" |
| POST | /traffic-fines/:id/responsibility | yes | perm: "traffic_fines.manage" |
| POST | /traffic-fines/:id/work-order | yes | perm: "traffic_fines.manage" |
| POST | /users | yes | perm: "users.create" |
| POST | /users/invite | yes | perm: "users.create" |
| POST | /utilities/bills | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| POST | /utilities/meters | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER" |
| POST | /utilities/meters/:id/readings | yes | roles: ...METER_READING_ROLES |
| POST | /utilities/readings | yes | roles: ...METER_READING_ROLES |
| POST | /vehicles | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "vehicles.create" |
| POST | /vehicles/:id/assign-driver | yes | perm: "vehicles.edit" |
| POST | /vehicles/:id/fuel-log | yes | perm: "vehicles.operate" |
| POST | /vehicles/:id/gate-in | yes | perm: "gate.in.create" |
| POST | /vehicles/:id/gate-out | yes | perm: "gate.out.create" |
| POST | /vehicles/:id/gps-update | yes | perm: "vehicles.operate" |
| POST | /vehicles/:id/meter-reading | yes | perm: "vehicles.operate" |
| POST | /vehicles/:id/trip-end | yes | perm: "vehicles.operate" |
| POST | /vehicles/:id/trip-start | yes | perm: "vehicles.operate" |
| POST | /vendor-portal/access | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "vendor.manage" |
| POST | /vendor-portal/jobs/:id/quotations | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "VENDOR"; perm: "vendor.portal" |
| POST | /warranties | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER"; perm: "warranty.manage" |
| POST | /warranties/claims | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR"; perm: "warranty.manage" |
| POST | /work-orders | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"; perm: "work_orders.manage" |
| POST | /work-orders/:id/assign | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"; perm: "work_orders.assign" |
| POST | /work-orders/:id/assignees | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"; perm: "work_orders.manage" |
| POST | /work-orders/:id/attachments | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC" |
| POST | /work-orders/:id/close | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"; perm: "work_orders.close" |
| POST | /work-orders/:id/complete-technician | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN"; perm: "work_orders.complete" |
| POST | /work-orders/:id/evidence | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER" |
| POST | /work-orders/:id/evidence/:evidenceId/accept | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| POST | /work-orders/:id/evidence/:evidenceId/content | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER" |
| POST | /work-orders/:id/evidence/:evidenceId/reject | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| POST | /work-orders/:id/evidence/confirm | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER" |
| POST | /work-orders/:id/evidence/upload-request | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER" |
| POST | /work-orders/:id/hold | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN"; perm: "work_orders.hold" |
| POST | /work-orders/:id/labour/:entryId/correct | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR", "MECHANIC", "TECHNICIAN"; perm: "work_orders.correct" |
| POST | /work-orders/:id/notes | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN" |
| POST | /work-orders/:id/part-requests | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN"; perm: "part_requests.create" |
| POST | /work-orders/:id/part-requests/:requestId/issue | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER"; perm: "part_requests.issue", "inventory.stock_issue" |
| POST | /work-orders/:id/parts | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER"; perm: "inventory.stock_issue" |
| POST | /work-orders/:id/parts/:lineId/confirm-return | yes | roles: "SUPER_ADMIN", "ADMIN", "INVENTORY_KEEPER", "OPERATIONS_MANAGER", "ASSET_MANAGER"; perm: "inventory.stock_issue" |
| POST | /work-orders/:id/parts/:lineId/return | yes | roles: "SUPER_ADMIN", "ADMIN", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "ASSET_MANAGER" |
| POST | /work-orders/:id/plan | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR"; perm: "work_orders.plan" |
| POST | /work-orders/:id/reject-supervisor | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"; perm: "work_orders.manage" |
| POST | /work-orders/:id/reopen | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "work_orders.manage" |
| POST | /work-orders/:id/requester-confirmation | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| POST | /work-orders/:id/resume | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN"; perm: "work_orders.resume" |
| POST | /work-orders/:id/return-to-service | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR", "FLEET_MANAGER"; perm: "work_orders.verify" |
| POST | /work-orders/:id/start | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN"; perm: "work_orders.start" |
| POST | /work-orders/:id/submit-for-approval | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN"; perm: "work_orders.manage", "work_orders.update_status" |
| POST | /work-orders/:id/vendor-repair/authorize | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| POST | /work-orders/:id/vendor-repair/close | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER" |
| POST | /work-orders/:id/vendor-repair/invoices | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| POST | /work-orders/:id/vendor-repair/invoices/:invoiceId/approve | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER" |
| POST | /work-orders/:id/vendor-repair/invoices/:invoiceId/reject | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER" |
| POST | /work-orders/:id/vendor-repair/quotations | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| POST | /work-orders/:id/vendor-repair/quotations/:quotationId/approve | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| POST | /work-orders/:id/vendor-repair/quotations/:quotationId/reject | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| POST | /work-orders/:id/vendor-repair/request | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| POST | /work-orders/:id/vendor-repair/select-vendor | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR" |
| POST | /work-orders/:id/vendor-repair/vendor-completed | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC" |
| POST | /work-orders/:id/verify-qr | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "FACILITY_MANAGER", "MANAGER" |
| POST | /work-orders/:id/verify-supervisor | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR"; perm: "work_orders.verify" |
| POST | /work-orders/bulk/assign | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR"; perm: "work_orders.manage" |
| POST | /work-orders/bulk/status | yes | roles: "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR"; perm: "work_orders.manage" |
| POST | /work-orders/taxonomy | yes | roles: "SUPER_ADMIN", "ADMIN" |
| POST | /workflows/:definitionId/publish | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | /workflows/ensure-default | yes | roles: "SUPER_ADMIN", "ADMIN"; perm: "admin.organization.manage" |
| POST | /workforce/employees | yes | roles: ...WORKFORCE_EMPLOYEE_MANAGERS |
| PUT | /departments/:id | yes | roles: ...DEPARTMENT_MANAGE_ROLES |
| PUT | /inventory/stock-counts/:id/lines | yes | roles: "SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER"; perm: "inventory.manage" |
| PUT | /maintenance-supply/work-orders/:id/execution-mode | yes | roles: ...MANAGE_ROLES; perm: "vendor.manage" |
| PUT | /planning/checklist-executions/:id/complete | yes | roles: ...FIELD_ROLES; perm: "planning.manage" |
| PUT | /planning/checklist-templates/:id/revise | yes | roles: ...MANAGE_ROLES; perm: "planning.manage" |
| PUT | /planning/inspections/:id/answers | yes | roles: ...FIELD_ROLES; perm: "planning.manage" |
| PUT | /planning/pm-plans/:id/revise | yes | roles: ...MANAGE_ROLES; perm: "planning.manage" |
| PUT | /workforce/employees/:id | yes | roles: ...WORKFORCE_EMPLOYEE_MANAGERS |

## Mismatches

Resolved 2026-10-19. SECURITY_OFFICER was removed from the eight work-order read decorators (queues, smart-views, action-required, queue items, taxonomy suggest, taxonomy search, list, history). `roleCanAccessQueue` still denies that role. `tier1-defects` covers the service denial.
