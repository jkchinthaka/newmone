/**
 * Permission aliases accepted by the API PermissionsGuard
 * (apps/api/src/common/guards/permissions.guard.ts). The web keeps its own copy (no
 * runtime dependency on a built package) so a menu item or page is shown exactly when
 * the API would allow its request.
 * apps/api/test/permission-aliases-parity.spec.ts fails if the two copies drift.
 */
export const COMPATIBLE_PERMISSION_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "gate.out.create": ["vehicles.operate"],
  "gate.in.create": ["vehicles.operate"],
  // Phase 3 organization/locations reuse established facilities permissions.
  "organization.view": ["facilities.view"],
  "organization.manage": ["facilities.manage", "settings.organization.manage"],
  "locations.view": ["facilities.view", "organization.view"],
  "locations.manage": ["facilities.manage", "organization.manage"],
  // Phase 5 — MaintenanceRequest permissions accept FacilityIssue equivalents during transition.
  // Roles that can *manage* facility issues must also be able to *create* requests (MANAGER seed
  // historically had manage without report, which produced a Roles-pass / Permissions-403 gap).
  "maintenance_requests.create": [
    "facility_issues.report",
    "facility_issues.manage",
    "cleaning.report_issue",
    "cleaning.manage"
  ],
  "maintenance_requests.view_own": ["facility_issues.view", "facility_issues.report"],
  "maintenance_requests.view_all": ["facility_issues.view", "facility_issues.manage"],
  "maintenance_requests.triage": ["facility_issues.manage"],
  "maintenance_requests.approve": ["facility_issues.manage"],
  "maintenance_requests.reject": ["facility_issues.manage"],
  "maintenance_requests.convert": ["facility_issues.manage"],
  "maintenance_requests.cancel_own": [
    "facility_issues.report",
    "facility_issues.manage",
    "maintenance_requests.create"
  ],
  "maintenance_requests.cancel_any": ["facility_issues.manage"],
  // Phase 6 — granular WO actions accept existing manage / update_status during rollout
  "work_orders.plan": ["work_orders.manage"],
  "work_orders.assign": ["work_orders.manage"],
  "work_orders.start": ["work_orders.manage", "work_orders.update_status"],
  "work_orders.hold": ["work_orders.manage", "work_orders.update_status"],
  "work_orders.resume": ["work_orders.manage", "work_orders.update_status"],
  "work_orders.complete": ["work_orders.manage", "work_orders.update_status"],
  "work_orders.verify": ["work_orders.manage"],
  "work_orders.close": ["work_orders.manage"],
  "work_orders.cancel": ["work_orders.manage", "work_orders.update_status"],
  "work_orders.reopen": ["work_orders.manage"],
  "work_orders.correct": ["work_orders.manage"],
  "warranty.view": ["work_orders.manage", "assets.view", "vehicles.view", "admin.audit.view"],
  "warranty.manage": ["work_orders.manage", "admin.organization.manage"],
  "reliability.view": ["work_orders.manage", "assets.view", "admin.audit.view"],
  "reliability.manage": ["work_orders.manage", "admin.organization.manage"],
  "safety.permit.view": ["work_orders.manage", "assets.view", "admin.audit.view"],
  "safety.permit.manage": ["work_orders.manage", "admin.organization.manage"],
  "maintenance.templates.manage": ["admin.organization.manage", "planning.manage"],
  "admin.features.manage": ["admin.organization.manage", "settings.organization.manage"],
  // Phase 7 — approval engine; manage aliases for admin rollout
  "approvals.view": ["approvals.decide", "approvals.rule.manage", "work_orders.manage"],
  "approvals.view_all": ["approvals.rule.manage"],
  "approvals.decide": ["approvals.rule.manage", "work_orders.manage"],
  "approvals.rule.manage": ["settings.organization.manage"],
  "approvals.override.emergency": ["approvals.rule.manage", "work_orders.manage"],
  // Phase 8 — planning / PM engine; accept work_orders.manage during rollout
  "planning.view": ["planning.manage", "work_orders.manage", "work_orders.plan"],
  "planning.manage": ["work_orders.manage", "work_orders.plan"],
  // Phase 9 — parts / ERP / vendor / cost; accept inventory & WO manage during rollout
  "parts.view": ["inventory.manage", "parts.issue", "parts.return"],
  "parts.issue": ["inventory.manage", "inventory.stock_issue", "part_requests.issue"],
  "parts.return": ["inventory.manage", "inventory.stock_issue", "parts.issue"],
  "erp.mapping.manage": ["inventory.manage", "erp.manage"],
  "vendor.manage": ["inventory.manage", "work_orders.manage"],
  "vendor.portal": ["vendor.manage", "work_orders.view"],
  "contract.manage": ["inventory.manage", "work_orders.manage", "vendor.manage"],
  "cost.view": ["work_orders.manage", "inventory.manage", "cost.adjust"],
  "cost.adjust": ["work_orders.manage", "inventory.manage"],
  // Phase 10 — fleet lifecycle; accept legacy fleet.manage / vehicles.operate during rollout
  "fleet.view": ["fleet.manage", "vehicles.view", "vehicles.operate"],
  "fleet.vehicle.manage": ["fleet.manage", "vehicles.edit", "vehicles.create"],
  "fleet.service.manage": ["fleet.manage", "work_orders.manage"],
  "fleet.inspection.perform": ["fleet.manage", "work_orders.manage"],
  "fleet.tyre.manage": ["fleet.manage", "fleet.vehicle.manage"],
  "fleet.battery.manage": ["fleet.manage", "fleet.vehicle.manage"],
  "fleet.fuel.record": ["fleet.manage", "fleet.log_fuel_trip"],
  "fleet.driver.manage": ["fleet.manage", "vehicles.operate"],
  "fleet.assignment.manage": ["fleet.manage", "fleet.driver.manage"],
  "fleet.document.manage": ["fleet.manage", "vehicle_documents.manage"],
  "fleet.accident.manage": ["fleet.manage", "accidents.manage"],
  "fleet.claim.manage": ["fleet.manage", "insurance_claims.manage"],
  "fleet.fine.manage": ["fleet.manage", "traffic_fines.manage"],
  "gate.check": ["gate.out.create", "gate.in.create", "fleet.manage", "vehicles.operate"],
  "gate.record": ["gate.out.create", "gate.in.create", "fleet.manage"],
  "gate.override": ["gate.override.approve", "fleet.manage"],
  // Phase 11 — domain profiles; accept assets.manage / organization.manage during rollout
  "domains.view": ["assets.manage", "organization.view", "settings.organization.manage"],
  "domains.manage": ["assets.manage", "organization.manage", "settings.organization.manage"],
  // Phase 12 — admin governance; accept existing settings/audit/users permissions during rollout
  "admin.overview.view": ["settings.view", "settings.manage", "settings.organization.manage"],
  "admin.dataquality.view": ["settings.view", "settings.manage", "assets.manage"],
  "admin.audit.view": ["audit.view", "settings.view"],
  "admin.system.view": ["settings.system.manage", "settings.manage"],
  "admin.users.manage": ["users.manage", "users.status.manage"],
  "admin.organization.manage": ["organization.manage", "settings.organization.manage"],
  // Phase 13 — granular report-domain permissions alias to reports.view during rollout
  "reports.view.maintenance": ["reports.view", "reports.performance.view", "reports.operations.view"],
  "reports.view.cost": ["reports.view", "reports.financials.view", "cost.view"],
  "reports.view.fleet": ["reports.view", "reports.vehicle_cost.view", "reports.fuel.view"],
  "reports.view.compliance": ["reports.view", "reports.assets.view", "compliance.view"]
};
/**
 * Same rule as the API guard's hasCompatiblePermission: a direct key, or any alias
 * of it. SUPERVISOR verification is an explicit grant; work_orders.manage does not satisfy it.
 */
export function hasCompatiblePermission(
  granted: ReadonlySet<string>,
  required: string,
  role?: string | null
): boolean {
  if (granted.has(required)) {
    return true;
  }
  if (role === "SUPERVISOR" && required === "work_orders.verify") {
    return false;
  }
  return (COMPATIBLE_PERMISSION_ALIASES[required] ?? []).some((permission) => granted.has(permission));
}
