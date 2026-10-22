/**
 * GENERATED — do not edit by hand. The API decorators (@Roles / @Permissions) on the request
 * that opens each page, so the web never shows a menu item or admin page the API will refuse.
 * Source: the decorator route inventory on feat/access-studio (971 routes). Regenerate when a
 * page's main request or its decorators change; apps/api/test/nav-api-gates.spec.ts checks drift.
 */
export type NavApiGate = { route: string; roles: readonly string[]; permissions: readonly string[] };

export const NAV_ITEM_API_GATES: Readonly<Record<string, NavApiGate>> = {
  "maintenance-dashboard": {
    route: "GET /work-orders/queues",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "BUILDING_SUPERVISOR",
      "COMPLIANCE_MANAGER",
      "FACILITY_MANAGER",
      "FINANCE",
      "FLEET_MANAGER",
      "INVENTORY_KEEPER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN",
      "VIEWER"
    ],
    permissions: []
  },
  requests: {
    route: "GET /maintenance-requests",
    roles: [],
    permissions: [
      "maintenance_requests.view_own"
    ]
  },
  "my-requests": {
    route: "GET /maintenance-requests",
    roles: [],
    permissions: [
      "maintenance_requests.view_own"
    ]
  },
  "all-jobs": {
    route: "GET /work-orders",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "INVENTORY_KEEPER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN"
    ],
    permissions: []
  },
  "machinery-jobs": {
    route: "GET /work-orders",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "INVENTORY_KEEPER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN"
    ],
    permissions: []
  },
  "service-jobs": {
    route: "GET /work-orders",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "INVENTORY_KEEPER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN"
    ],
    permissions: []
  },
  "vehicle-jobs": {
    route: "GET /work-orders",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "INVENTORY_KEEPER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN"
    ],
    permissions: []
  },
  inspections: {
    route: "GET /planning/inspections",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "FACILITY_MANAGER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN",
      "VIEWER"
    ],
    permissions: [
      "planning.view"
    ]
  },
  "meter-readings": {
    route: "GET /utilities/readings",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "MECHANIC",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN"
    ],
    permissions: []
  },
  reliability: {
    route: "GET /reliability/summary",
    roles: [
      "ADMIN",
      "AUDITOR",
      "MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN"
    ],
    permissions: [
      "reliability.view"
    ]
  },
  approvals: {
    route: "GET /approvals/inbox",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "FACILITY_MANAGER",
      "FINANCE",
      "MANAGER",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "VIEWER"
    ],
    permissions: [
      "approvals.view"
    ]
  },
  "preventive-maintenance": {
    route: "GET /planning/pm-plans",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "FACILITY_MANAGER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN",
      "VIEWER"
    ],
    permissions: [
      "planning.view"
    ]
  },
  "my-jobs": {
    route: "GET /work-orders/my-jobs",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN"
    ],
    permissions: []
  },
  "vendors-external": {
    route: "GET /suppliers",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "INVENTORY_KEEPER",
      "MANAGER",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN"
    ],
    permissions: []
  },
  "maintenance-history": {
    route: "GET /work-orders/history",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "BUILDING_SUPERVISOR",
      "FACILITY_MANAGER",
      "FLEET_MANAGER",
      "INVENTORY_KEEPER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN"
    ],
    permissions: []
  },
  reports: {
    route: "GET /reports/dashboard",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "DRIVER",
      "FINANCE",
      "FLEET_MANAGER",
      "INVENTORY_KEEPER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "PROCUREMENT_OFFICER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN",
      "VIEWER"
    ],
    permissions: []
  },
  assets: {
    route: "GET /assets",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "MANAGER",
      "MECHANIC",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN",
      "VIEWER"
    ],
    permissions: []
  },
  facilities: {
    route: "GET /organization/summary",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "BUILDING_SUPERVISOR",
      "FACILITY_MANAGER",
      "MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "VIEWER"
    ],
    permissions: [
      "organization.view"
    ]
  },
  fleet: {
    route: "GET /fleet-lifecycle/overview",
    roles: [
      "ADMIN",
      "FLEET_MANAGER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPER_ADMIN",
      "TECHNICIAN",
      "VIEWER"
    ],
    permissions: [
      "fleet.view"
    ]
  },
  "fleet-gate": {
    route: "GET /vehicles/gate-queue",
    roles: [],
    permissions: [
      "vehicles.view"
    ]
  },
  "spare-parts": {
    route: "GET /inventory/parts",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "INVENTORY_KEEPER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPER_ADMIN"
    ],
    permissions: [
      "inventory.manage"
    ]
  },
  "erp-integration": {
    route: "GET /erp/status",
    roles: [],
    permissions: [
      "erp.view"
    ]
  },
  "maintenance-supply": {
    route: "GET /maintenance-supply/parts",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "INVENTORY_KEEPER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "STOREKEEPER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN",
      "VIEWER"
    ],
    permissions: [
      "parts.view"
    ]
  },
  admin: {
    route: "GET /admin-governance/overview",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: [
      "admin.overview.view"
    ]
  },
  "admin-asset-register": {
    route: "POST /assets",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: []
  },
  "admin-vehicle-register": {
    route: "POST /vehicles",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: [
      "vehicles.create"
    ]
  },
  "admin-asset-tags": {
    route: "GET /admin/asset-tags/template.csv",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: []
  }
};

export const ADMIN_PAGE_API_GATES: Readonly<Record<string, NavApiGate>> = {
  "/admin/users": {
    route: "GET /admin/users",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: []
  },
  "/admin/roles": {
    route: "GET /admin/roles-permissions",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: []
  },
  "/admin/tenants": {
    route: "GET /admin/tenants",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: []
  },
  "/admin/people": {
    route: "GET /people",
    roles: [],
    permissions: [
      "users.view"
    ]
  },
  "/admin/people/new": {
    route: "POST /people",
    roles: [],
    permissions: [
      "users.create"
    ]
  },
  "/admin/invitations": {
    route: "GET /admin/invitations",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: []
  },
  "/admin/organization": {
    route: "GET /organization/summary",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "BUILDING_SUPERVISOR",
      "FACILITY_MANAGER",
      "MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "VIEWER"
    ],
    permissions: [
      "organization.view"
    ]
  },
  "/admin/asset-masters": {
    route: "GET /asset-taxonomy/categories",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "MANAGER",
      "MECHANIC",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "VIEWER"
    ],
    permissions: []
  },
  "/admin/data-quality": {
    route: "GET /admin-governance/data-quality",
    roles: [
      "ADMIN",
      "MANAGER",
      "SUPER_ADMIN"
    ],
    permissions: [
      "admin.dataquality.view"
    ]
  },
  "/admin/audit": {
    route: "GET /audit-logs",
    roles: [],
    permissions: [
      "audit.view"
    ]
  },
  "/admin/security": {
    route: "GET /admin-governance/system",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: [
      "admin.system.view"
    ]
  },
  "/admin/maintenance-config": {
    route: "GET /admin/maintenance-config/overview",
    roles: [
      "ADMIN",
      "MANAGER",
      "OPERATIONS_MANAGER",
      "SUPER_ADMIN"
    ],
    permissions: [
      "admin.overview.view"
    ]
  },
  "/admin/job-categories": {
    route: "GET /admin/maintenance-config/job-categories",
    roles: [
      "ADMIN",
      "MANAGER",
      "SUPER_ADMIN"
    ],
    permissions: [
      "admin.organization.manage"
    ]
  },
  "/admin/priority-sla": {
    route: "GET /admin/maintenance-config/priority-sla",
    roles: [
      "ADMIN",
      "MANAGER",
      "SUPER_ADMIN"
    ],
    permissions: [
      "admin.organization.manage"
    ]
  },
  "/admin/fault-codes": {
    route: "GET /admin/maintenance-config/analysis-codes",
    roles: [
      "ADMIN",
      "MAINTENANCE_SUPERVISOR",
      "MANAGER",
      "MECHANIC",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN"
    ],
    permissions: [
      "work_orders.complete"
    ]
  },
  "/admin/reason-codes": {
    route: "GET /admin/maintenance-config/reason-codes",
    roles: [
      "ADMIN",
      "MAINTENANCE_SUPERVISOR",
      "MANAGER",
      "MECHANIC",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN"
    ],
    permissions: [
      "work_orders.hold"
    ]
  },
  "/admin/config-history": {
    route: "GET /admin/maintenance-config/config-history",
    roles: [
      "ADMIN",
      "AUDITOR",
      "MANAGER",
      "SUPER_ADMIN"
    ],
    permissions: [
      "admin.audit.view"
    ]
  },
  "/admin/checklist-templates": {
    route: "GET /planning/checklist-templates",
    roles: [
      "ADMIN",
      "ASSET_MANAGER",
      "FACILITY_MANAGER",
      "MANAGER",
      "MECHANIC",
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN",
      "VIEWER"
    ],
    permissions: [
      "planning.view"
    ]
  },
  "/admin/maintenance-templates": {
    route: "GET /admin/maintenance-config/maintenance-templates",
    roles: [
      "ADMIN",
      "MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN"
    ],
    permissions: [
      "planning.view"
    ]
  },
  "/admin/feature-flags": {
    route: "GET /admin/maintenance-config/feature-flags",
    roles: [
      "ADMIN",
      "MANAGER",
      "OPERATIONS_MANAGER",
      "SUPER_ADMIN"
    ],
    permissions: [
      "admin.overview.view"
    ]
  },
  "/admin/warranties": {
    route: "GET /warranties",
    roles: [
      "ADMIN",
      "AUDITOR",
      "MANAGER",
      "MECHANIC",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN",
      "VIEWER"
    ],
    permissions: [
      "warranty.view"
    ]
  },
  "/admin/reliability": {
    route: "GET /reliability/policy",
    roles: [
      "ADMIN",
      "AUDITOR",
      "MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN"
    ],
    permissions: [
      "reliability.view"
    ]
  },
  "/admin/work-permits": {
    route: "GET /work-permits",
    roles: [
      "ADMIN",
      "AUDITOR",
      "MANAGER",
      "MECHANIC",
      "SUPERVISOR",
      "SUPER_ADMIN",
      "TECHNICIAN"
    ],
    permissions: [
      "safety.permit.view"
    ]
  },
  "/admin/condition-monitoring": {
    route: "GET /condition-rules",
    roles: [
      "ADMIN",
      "AUDITOR",
      "MANAGER",
      "SUPERVISOR",
      "SUPER_ADMIN"
    ],
    permissions: [
      "reliability.view"
    ]
  },
  "/admin/integrations": {
    route: "GET /admin/maintenance-config/integrations-status",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: [
      "admin.system.view"
    ]
  },
  "/admin/approvals": {
    route: "GET /admin/approvals/rules",
    roles: [
      "ADMIN",
      "MANAGER",
      "OPERATIONS_MANAGER",
      "SUPER_ADMIN"
    ],
    permissions: [
      "approvals.rule.manage"
    ]
  },
  "/admin/approval-rules": {
    route: "GET /admin/approvals/rules",
    roles: [
      "ADMIN",
      "MANAGER",
      "OPERATIONS_MANAGER",
      "SUPER_ADMIN"
    ],
    permissions: [
      "approvals.rule.manage"
    ]
  },
  "/admin/bulk-imports": {
    route: "GET /bulk-import",
    roles: [
      "SUPER_ADMIN"
    ],
    permissions: []
  },
  "/admin/assets/new": {
    route: "POST /assets",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: []
  },
  "/admin/vehicles/new": {
    route: "POST /vehicles",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: [
      "vehicles.create"
    ]
  },
  "/admin/asset-tags": {
    route: "GET /admin/asset-tags/template.csv",
    roles: [
      "ADMIN",
      "SUPER_ADMIN"
    ],
    permissions: []
  }
};
