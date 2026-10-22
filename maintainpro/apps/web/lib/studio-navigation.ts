export type StudioNavigation = { accessStudioEnabled?: boolean; accessRoutes?: readonly string[] };

export const STUDIO_ADMIN_PAGE_ROUTES: Readonly<Record<string, string>> = {
  "/admin/users": "GET /admin/users",
  "/admin/roles": "GET /admin/roles-permissions",
  "/admin/tenants": "GET /admin/tenants",
  "/admin/people": "GET /people",
  "/admin/people/new": "POST /people",
  "/admin/invitations": "GET /admin/invitations",
  "/admin/organization": "GET /organization/summary",
  "/admin/asset-masters": "GET /asset-taxonomy/categories",
  "/admin/data-quality": "GET /admin-governance/data-quality",
  "/admin/audit": "GET /audit-logs",
  "/admin/security": "GET /admin-governance/system",
  "/admin/maintenance-config": "GET /admin/maintenance-config/overview",
  "/admin/job-categories": "GET /admin/maintenance-config/job-categories",
  "/admin/priority-sla": "GET /admin/maintenance-config/priority-sla",
  "/admin/fault-codes": "GET /admin/maintenance-config/analysis-codes",
  "/admin/reason-codes": "GET /admin/maintenance-config/reason-codes",
  "/admin/config-history": "GET /admin/maintenance-config/config-history",
  "/admin/checklist-templates": "GET /planning/checklist-templates",
  "/admin/maintenance-templates": "GET /admin/maintenance-config/maintenance-templates",
  "/admin/feature-flags": "GET /admin/maintenance-config/feature-flags",
  "/admin/warranties": "GET /warranties",
  "/admin/reliability": "GET /reliability/policy",
  "/admin/work-permits": "GET /work-permits",
  "/admin/condition-monitoring": "GET /condition-rules",
  "/admin/integrations": "GET /admin/maintenance-config/integrations-status",
  "/admin/approvals": "GET /admin/approvals/rules",
  "/admin/approval-rules": "GET /admin/approvals/rules",
  "/admin/bulk-imports": "GET /bulk-import",
  "/admin/assets/new": "POST /assets",
  "/admin/vehicles/new": "POST /vehicles",
  "/admin/asset-tags": "GET /admin/asset-tags/template.csv"
};

// Each entry names the production request which opens the page. The server derives
// accessRoutes from effective permissions, DENYs and the route inventory.
export const STUDIO_NAV_ROUTES: Readonly<Record<string, string>> = {
  "maintenance-dashboard": "GET /work-orders/queues",
  requests: "GET /maintenance-requests",
  "my-requests": "GET /maintenance-requests",
  "all-jobs": "GET /work-orders",
  "machinery-jobs": "GET /work-orders",
  "service-jobs": "GET /work-orders",
  "vehicle-jobs": "GET /work-orders",
  inspections: "GET /planning/inspections",
  "meter-readings": "GET /utilities/readings",
  reliability: "GET /reliability/summary",
  approvals: "GET /approvals/inbox",
  "preventive-maintenance": "GET /planning/pm-plans",
  "my-jobs": "GET /work-orders/my-jobs",
  "vendors-external": "GET /suppliers",
  "maintenance-history": "GET /work-orders/history",
  reports: "GET /reports/dashboard",
  assets: "GET /assets",
  facilities: "GET /organization/summary",
  fleet: "GET /fleet-lifecycle/overview",
  "fleet-gate": "GET /vehicles/gate-queue",
  "spare-parts": "GET /inventory/parts",
  "erp-integration": "GET /erp/status",
  "maintenance-supply": "GET /maintenance-supply/parts",
  admin: "GET /admin-governance/overview",
  "admin-asset-register": "POST /assets",
  "admin-vehicle-register": "POST /vehicles",
  "admin-asset-tags": "GET /admin/asset-tags/template.csv"
};

export function studioNavigationAllowed(id: string, context: StudioNavigation): boolean {
  if (id === "notifications" || id === "settings") return true;
  const route = STUDIO_NAV_ROUTES[id];
  return Boolean(route && context.accessRoutes?.includes(route));
}
