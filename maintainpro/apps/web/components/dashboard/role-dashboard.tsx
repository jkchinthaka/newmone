"use client";

import Link from "next/link";
import type { Route } from "next";

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
import { DashboardSection } from "./dashboard-section";
import { EnterpriseKpiBoard } from "./enterprise-kpi-board";
import { MorningBriefing } from "./morning-briefing";
import { DriverIntelligenceDashboard } from "./driver-intelligence-dashboard";
import { InventorySummary } from "./inventory-summary";
import { ReportsSummary } from "./reports-summary";
import { SystemHealthSummary } from "./system-health-summary";
import { WorkOrdersSummary } from "./work-orders-summary";
import { WorkforcePendingPanel } from "./workforce-pending-panel";

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

      <MorningBriefing />
      <FgRoleActions permissions={user.permissions} />
      <EnterpriseKpiBoard />

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

      {variant === "management" || variant === "admin" ? <WorkforcePendingPanel /> : null}

      {dashboardShowsInventorySummary(variant) ? <InventorySummary /> : null}

      {dashboardShowsReportsSummary(variant) ? <ReportsSummary readOnly={readOnly} /> : null}

      {dashboardShowsDriverIntelligence(variant) ? <DriverIntelligenceDashboard /> : null}

      {variant === "cleaner" || variant === "driver" || variant === "minimal" ? (
        <DashboardQuickLinks
          roleName={roleName}
          permissions={user.permissions}
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

      {variant === "admin" || variant === "management" || variant === "finance" || variant === "procurement" || variant === "inventory" || variant === "viewer" ? (
        <DashboardQuickLinks roleName={roleName} permissions={user.permissions} />
      ) : null}
    </div>
  );
}

function FgRoleActions({ permissions }: { permissions?: readonly string[] }) {
  if (!permissions?.includes("fg.access")) {
    return null;
  }

  const links: Array<{ href: Route; title: string; description: string }> = [
    { href: "/fg", title: "Today's records", description: "Start or continue controlled production records." },
    { href: "/fg/review", title: "Supervisor review", description: "Open the live FG supervisor queue." },
    { href: "/fg/qa", title: "QA verification", description: "Open the live FG QA queue." }
  ];

  return (
    <DashboardSection
      title="FG Digital Records"
      description="MaintainPro production records. Open the live FG queues; this board does not invent counts."
    >
      <div className="grid gap-2 sm:grid-cols-3">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
          >
            <span className="font-semibold text-slate-900">{item.title}</span>
            <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
          </Link>
        ))}
      </div>
    </DashboardSection>
  );
}
