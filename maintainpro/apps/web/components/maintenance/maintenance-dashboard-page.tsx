"use client";

import { RefreshErrorBanner } from "@/components/ui/refresh-error-banner";
import { formatDate as lkDate, formatDateTime as lkDateTime } from "@/lib/localization";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardCheck, Package, UserX, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import {
  BarList,
  DataTable,
  EmptyState,
  ErrorState,
  KpiCard,
  PageShell,
  QueueChip,
  SectionCard,
  SkeletonCard,
  StatusBadge,
  type DataTableColumn
} from "@/components/ui/dashboard";
import type { StatusTone } from "@/lib/dashboard-status";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { jobDomainLabel } from "@/lib/job-domain";
import { PM_DUE_SOON_HREF, PM_OVERDUE_HREF } from "@/lib/operational-deep-link";
import {
  actionCardTone,
  dashboardCardsForRole,
  isTechnicianMaintenanceDashboard,
  MANAGER_ACTION_CARDS,
  TECHNICIAN_ACTION_CARDS,
  WORKLOAD_CARDS
} from "@/lib/maintenance-dashboard-view";
import { maintenanceRefetchInterval, shouldRetryMaintenanceQuery } from "@/lib/maintenance-dashboard-query";
import { withTenantScope } from "@/lib/tenant-query";
import { fetchApprovalInbox } from "@/lib/approvals-api";
import { approvalsSummary, type ApprovalsSummary } from "@/lib/approvals-summary";
import { canFetchApprovalBadge } from "@/lib/use-nav-badges";
import { useCurrentUser } from "@/lib/use-current-user";

type PriorityWorkOrder = {
  id: string;
  woNumber: string;
  title: string;
  jobDomain: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assetName?: string | null;
  assigneeName?: string | null;
};

type MaintenanceDashboard = {
  openJobs: number;
  machineryJobs: number;
  serviceJobs: number;
  vehicleJobs: number;
  overdueJobs: number;
  waitingParts: number;
  pendingApprovals: number | null;
  pmDueSoon: number;
  pmOverdue?: number;
  lowStock: number | null;
  requestsOpen: number;
  unassignedJobs: number;
  inProgressJobs: number;
  onHoldJobs: number;
  verificationRequired: number;
  priorityWorkList: PriorityWorkOrder[];
  availability: {
    inventory: boolean;
    approvals: boolean;
    mttr: boolean;
    mtbf: boolean;
    erpExceptions: boolean;
    gateBlocks: boolean;
  };
  notAvailable: Record<string, string>;
  generatedAt: string;
};

type MyJobCounts = {
  active: number;
  overdue: number;
  dueToday: number;
  waitingParts: number;
};

const ATTENTION_ICONS: Record<string, LucideIcon> = {
  overdue: AlertTriangle,
  unassigned: UserX,
  "verification-required": ClipboardCheck,
  "waiting-parts": Package,
  "my-jobs": ClipboardCheck,
  "due-today": ClipboardCheck
};

function attentionTone(id: string, value: number): StatusTone {
  if (value <= 0) return "neutral";
  if (id === "overdue") return "red";
  return actionCardTone(value) === "warn" ? "amber" : "neutral";
}

function LinkedKpi({
  id,
  label,
  value,
  href,
  compact = false
}: {
  id: string;
  label: string;
  value: number;
  href: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href as never}
      aria-label={value === 0 ? `${label}: none right now` : `${label}: ${value}`}
      className="block rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <KpiCard compact={compact} icon={ATTENTION_ICONS[id]} label={label} tone={attentionTone(id, value)} value={String(value)} />
    </Link>
  );
}

async function fetchDashboard(): Promise<MaintenanceDashboard> {
  const res = await apiClient.get<{ data: MaintenanceDashboard }>("/maintenance/dashboard");
  return res.data.data;
}

async function fetchMyJobCounts(): Promise<MyJobCounts> {
  const res = await apiClient.get<{ data?: { counts?: MyJobCounts } }>("/work-orders/my-jobs", {
    params: { page: 1, pageSize: 1 }
  });
  return res.data.data?.counts ?? { active: 0, overdue: 0, dueToday: 0, waitingParts: 0 };
}

function formatDue(value: string | null) {
  if (!value) return "No due date";
  return lkDate(value);
}

const priorityColumns: Array<DataTableColumn<PriorityWorkOrder>> = [
  {
    id: "work-order",
    header: "Job",
    mobileLabel: "Job",
    cell: (wo) => (
      <>
        <Link
          href={`/maintenance/jobs?wo=${wo.id}` as never}
          className="font-medium text-brand-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {wo.woNumber}
        </Link>
        <div className="text-slate-700">{wo.title}</div>
      </>
    )
  },
  {
    id: "asset",
    header: "Asset",
    mobileLabel: "Asset",
    cell: (wo) => wo.assetName || jobDomainLabel(wo.jobDomain)
  },
  { id: "priority", header: "Priority", mobileLabel: "Priority", cell: (wo) => wo.priority },
  {
    id: "status",
    header: "Status",
    mobileLabel: "Status",
    cell: (wo) => <StatusBadge status={wo.status} />
  },
  { id: "due", header: "Due", mobileLabel: "Due", cell: (wo) => formatDue(wo.dueDate) },
  {
    id: "assignee",
    header: "Assignee",
    mobileLabel: "Assignee",
    cell: (wo) => wo.assigneeName || "Unassigned"
  }
];

export function MaintenanceDashboardPage() {
  const user = useCurrentUser();
  const technicianView = isTechnicianMaintenanceDashboard(user.role);
  const dashboardQuery = useQuery({
    queryKey: withTenantScope(["maintenance", "dashboard", "d6"]),
    queryFn: fetchDashboard,
    enabled: !technicianView,
    staleTime: 30_000,
    retry: shouldRetryMaintenanceQuery,
    refetchInterval: maintenanceRefetchInterval
  });
  const myJobsQuery = useQuery({
    queryKey: withTenantScope(["maintenance", "dashboard", "my-jobs", user.id]),
    queryFn: fetchMyJobCounts,
    enabled: technicianView,
    staleTime: 30_000,
    retry: shouldRetryMaintenanceQuery,
    refetchInterval: maintenanceRefetchInterval
  });

  // Same source and filters as the Approvals page, so the card and the page always agree.
  const approvalsQuery = useQuery({
    queryKey: withTenantScope(["approvals", "dashboard-summary"]),
    queryFn: ({ signal }) => fetchApprovalInbox({ page: 1, pageSize: 1 }, { signal }),
    select: (data) => approvalsSummary(data.meta?.counts, data.meta?.total),
    enabled: !technicianView && canFetchApprovalBadge(user.role, user.permissions),
    retry: false
  });

  const query = technicianView ? myJobsQuery : dashboardQuery;

  if (query.isLoading) {
    return (
      <div className="ops-page space-y-4" aria-busy="true">
        <p className="text-sm font-medium text-slate-700">Loading maintenance dashboard</p>
        <p className="text-sm text-slate-600">Fetching the work that needs attention.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  // A failed background refresh keeps the dashboard on screen (banner below); full error only with no data.
  if (!query.data) {
    const description = getApiErrorMessage(query.error, "Unable to load maintenance dashboard");
    const message = description.includes("Unable to load maintenance dashboard")
      ? description
      : `Unable to load maintenance dashboard. ${description}`;
    return <ErrorState message={message} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="ops-page">
      <PageBreadcrumbs items={[{ label: "Maintenance" }]} />
      <PageShell
        subtitle={technicianView ? "Your jobs that need attention now." : "What needs attention now."}
        title="Maintenance Dashboard"
      >
        {query.isError ? (
          <RefreshErrorBanner
            message="Could not refresh the dashboard. Showing the last loaded numbers."
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : null}
        {!technicianView && dashboardQuery.data ? (
          <p className="text-xs text-slate-500">Updated {lkDateTime(dashboardQuery.data.generatedAt)}</p>
        ) : null}
        {technicianView && myJobsQuery.data ? <TechnicianDashboard counts={myJobsQuery.data} /> : null}
        {!technicianView && dashboardQuery.data ? (
          <ManagerDashboard data={dashboardQuery.data} role={user.role} approvals={approvalsQuery.data ?? null} />
        ) : null}
      </PageShell>
    </div>
  );
}

function TechnicianDashboard({ counts }: { counts: MyJobCounts }) {
  return (
    <SectionCard description="Assigned jobs only. Manager queues stay on the manager dashboard." title="My work">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TECHNICIAN_ACTION_CARDS.map((card) => {
          const value = counts[card.countKey] ?? 0;
          return <LinkedKpi key={card.id} href={card.href} id={card.id} label={card.label} value={value} />;
        })}
      </div>
    </SectionCard>
  );
}

function ApprovalsCard({ summary }: { summary: ApprovalsSummary }) {
  return (
    <Link
      href={"/approvals" as never}
      aria-label={`Approvals: ${summary.total} pending. Open Approvals`}
      className="block rounded-card border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ClipboardCheck size={20} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Approvals</p>
            <p className="text-xs text-slate-500">Waiting for a decision</p>
          </div>
        </div>
        <p className="text-3xl font-semibold tabular-nums text-slate-900">
          {summary.total}
          <span className="ml-1 text-sm font-medium text-slate-500">pending</span>
        </p>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Pending approvals by category">
        {summary.categories.map((category) => (
          <li
            key={category.id}
            className={`rounded-lg border px-3 py-2 text-sm ${category.count > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-100 bg-slate-50 text-slate-500"}`}
          >
            <span className="block truncate text-xs">{category.label}</span>
            <span className="text-lg font-semibold tabular-nums">{category.count}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

function ManagerDashboard({
  data,
  role,
  approvals
}: {
  data: MaintenanceDashboard;
  role: string | null;
  approvals: ApprovalsSummary | null;
}) {
  const counts: Record<string, number> = {
    overdueJobs: data.overdueJobs,
    unassignedJobs: data.unassignedJobs,
    verificationRequired: data.verificationRequired,
    waitingParts: data.waitingParts,
    openJobs: data.openJobs,
    inProgressJobs: data.inProgressJobs,
    onHoldJobs: data.onHoldJobs
  };
  const priority = data.priorityWorkList ?? [];

  return (
    <div className="space-y-4">
      {approvals ? <ApprovalsCard summary={approvals} /> : null}
      <SectionCard description="The four queues to clear first." title="Needs attention">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardCardsForRole(role, MANAGER_ACTION_CARDS).map((card) => {
            const value = counts[card.countKey] ?? 0;
            return <LinkedKpi key={card.id} href={card.href} id={card.id} label={card.label} value={value} />;
          })}
        </div>
      </SectionCard>

      <SectionCard
        action={
          <Link
            href={"/work-orders?filter=open" as never}
            className="btn-quiet"
          >
            View all
          </Link>
        }
        description="The five most urgent open jobs."
        title="Priority jobs"
      >
        {priority.length === 0 ? (
          <EmptyState description="No overdue or high-priority jobs right now." title="Nothing urgent" />
        ) : (
          <DataTable ariaLabel="Priority jobs" columns={priorityColumns} getRowId={(wo) => wo.id} minWidth="720px" rows={priority} />
        )}
      </SectionCard>

      <SectionCard description="Open load by stage. Each chip opens that stage." title="Workload">
        <div className="flex flex-wrap gap-2">
          {dashboardCardsForRole(role, WORKLOAD_CARDS).map((card) => {
            const value = counts[card.countKey] ?? 0;
            return (
              <Link
                key={card.id}
                href={card.href as never}
                aria-label={`${card.label}: ${value}`}
                className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <QueueChip>
                  <span>{card.label}</span>
                  <span className="font-semibold tabular-nums">{value}</span>
                </QueueChip>
              </Link>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard description="Open jobs by domain." title="Domain breakdown">
        <BarList
          items={[
            ["Machinery", data.machineryJobs, "/maintenance/jobs/machinery?queue=open-load"],
            ["Vehicle", data.vehicleJobs, "/maintenance/jobs/vehicle?queue=open-load"],
            ["Service", data.serviceJobs, "/maintenance/jobs/service?queue=open-load"]
          ].map(([label, value, href]) => ({
            name: String(label),
            value: Number(value),
            href: String(href),
            ariaLabel: `${label}: ${value} open jobs`
          }))}
        />
      </SectionCard>

      <SectionCard description="Requests and preventive work that can unblock jobs." title="Pipeline">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LinkedKpi compact href="/requests?stage=open" id="requests" label="Requests awaiting action" value={data.requestsOpen} />
          <LinkedKpi compact href={PM_DUE_SOON_HREF} id="pm-due" label="Scheduled service due soon" value={data.pmDueSoon} />
          <LinkedKpi compact href={PM_OVERDUE_HREF} id="pm-overdue" label="Scheduled service overdue" value={data.pmOverdue ?? 0} />
        </div>
      </SectionCard>
    </div>
  );
}
