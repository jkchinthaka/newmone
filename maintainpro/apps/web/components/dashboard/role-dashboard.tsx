"use client";

import { EmptyState } from "@/components/ui/page-state";
import { extractRoleName } from "@/lib/role-redirect";
import {
  dashboardIsReadOnly,
  dashboardShowsDriverIntelligence,
  dashboardShowsInventorySummary,
  dashboardShowsReportsSummary,
  dashboardShowsSystemHealthSummary,
  dashboardShowsWorkOrdersSummary,
  getDashboardDescription,
  getDashboardTitle,
  resolveDashboardVariant
} from "@/lib/dashboard-roles";
import { useCurrentUser } from "@/lib/use-current-user";

import { DashboardQuickLinks } from "./dashboard-quick-links";
import { DriverIntelligenceDashboard } from "./driver-intelligence-dashboard";
import { InventorySummary } from "./inventory-summary";
import { ReportsSummary } from "./reports-summary";
import { SystemHealthSummary } from "./system-health-summary";
import { WorkOrdersSummary } from "./work-orders-summary";

export function RoleDashboard() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const variant = resolveDashboardVariant(roleName);
  const title = getDashboardTitle(variant);
  const description = getDashboardDescription(variant);
  const readOnly = dashboardIsReadOnly(variant);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
      </header>

      {dashboardShowsSystemHealthSummary(variant) ? <SystemHealthSummary /> : null}

      {dashboardShowsWorkOrdersSummary(variant) ? (
        <WorkOrdersSummary
          assignedUserId={variant === "technician" ? user.id : null}
          title={variant === "technician" ? "My assigned work" : "Work orders"}
          description={
            variant === "technician"
              ? "Work orders assigned to you from the live maintenance queue."
              : "Live work order counts and priority items from the maintenance queue."
          }
        />
      ) : null}

      {dashboardShowsInventorySummary(variant) ? <InventorySummary /> : null}

      {dashboardShowsReportsSummary(variant) ? <ReportsSummary readOnly={readOnly} /> : null}

      {dashboardShowsDriverIntelligence(variant) ? <DriverIntelligenceDashboard /> : null}

      {variant === "cleaner" || variant === "driver" || variant === "minimal" ? (
        <DashboardQuickLinks
          roleName={roleName}
          title={variant === "minimal" ? "Available modules" : "Quick links"}
          description={
            variant === "cleaner"
              ? "Open cleaning tasks, issues, visits, and related workflows."
              : variant === "driver"
                ? "Open vehicles, fleet, and trip-related modules available to drivers."
                : "Open modules available to your account."
          }
        />
      ) : null}

      {variant === "cleaner" || variant === "driver" ? (
        <EmptyState
          title="No aggregate dashboard metrics yet"
          description="MaintainPro does not expose a dedicated cleaning or driver summary API on the main dashboard. Use the quick links above to open live module views."
        />
      ) : null}

      {variant === "minimal" ? (
        <EmptyState
          title="Limited dashboard view"
          description="Your role could not be matched to a specialized dashboard layout. Use the quick links above or the sidebar to open available modules."
        />
      ) : null}

      {variant === "admin" || variant === "management" || variant === "inventory" || variant === "viewer" ? (
        <DashboardQuickLinks roleName={roleName} />
      ) : null}
    </div>
  );
}
