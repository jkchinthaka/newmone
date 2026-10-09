"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { humanWorkOrderStatusLabel } from "@/components/work-orders/helpers";
import { EmptyState, ErrorState, LoadingCardSkeleton, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { jobDomainLabel } from "@/lib/job-domain";
import { PM_DUE_SOON_HREF } from "@/lib/operational-deep-link";
import {
  actionCardTone,
  dashboardCardsForRole,
  isTechnicianMaintenanceDashboard,
  MANAGER_ACTION_CARDS,
  TECHNICIAN_ACTION_CARDS,
  WORKLOAD_CARDS
} from "@/lib/maintenance-dashboard-view";
import { withTenantScope } from "@/lib/tenant-query";
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

const cardTones = {
  default: "border-slate-200 bg-white",
  warn: "border-amber-300 bg-amber-50",
  critical: "border-red-200 bg-red-50"
};

function ActionCard({
  label,
  value,
  href,
  tone = "default"
}: {
  label: string;
  value: number;
  href: string;
  tone?: "default" | "warn" | "critical";
}) {
  const empty = value === 0;
  return (
    <Link
      href={href as never}
      className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm text-ink transition hover:border-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${cardTones[tone]}`}
      aria-label={empty ? `${label}: none right now` : `${label}: ${value}`}
    >
      <span className="font-semibold tabular-nums">{value}</span>
      <span>{label}</span>
    </Link>
  );
}

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  const id = title.replace(/\s+/g, "-").toLowerCase();
  return (
    <section className="space-y-3" aria-labelledby={id}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={id} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {description ? <p className="text-sm text-slate-600">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
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
  return new Date(value).toLocaleDateString();
}

export function MaintenanceDashboardPage() {
  const user = useCurrentUser();
  const technicianView = isTechnicianMaintenanceDashboard(user.role);
  const dashboardQuery = useQuery({
    queryKey: withTenantScope(["maintenance", "dashboard", "d6"]),
    queryFn: fetchDashboard,
    enabled: !technicianView,
    staleTime: 30_000,
    refetchInterval: 60_000
  });
  const myJobsQuery = useQuery({
    queryKey: withTenantScope(["maintenance", "dashboard", "my-jobs", user.id]),
    queryFn: fetchMyJobCounts,
    enabled: technicianView,
    staleTime: 30_000,
    refetchInterval: 60_000
  });

  const query = technicianView ? myJobsQuery : dashboardQuery;

  if (query.isLoading) {
    return (
      <LoadingState title="Loading maintenance dashboard" description="Fetching the work that needs attention.">
        <LoadingCardSkeleton rows={4} />
      </LoadingState>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Unable to load maintenance dashboard"
        description={getApiErrorMessage(query.error, "Unable to load maintenance dashboard")}
        onRetry={() => query.refetch()}
      />
    );
  }

  return (
    <div className="ops-page">
      <PageBreadcrumbs items={[{ label: "Home", href: "/action-center" }, { label: "Maintenance" }]} />
      <div>
        <h1 className="page-title">Maintenance Dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          {technicianView ? "Your jobs that need attention now." : "What needs attention now."}
        </p>
        {!technicianView && dashboardQuery.data ? (
          <p className="mt-1 text-xs text-slate-500">Updated {new Date(dashboardQuery.data.generatedAt).toLocaleString()}</p>
        ) : null}
      </div>

      {technicianView && myJobsQuery.data ? <TechnicianDashboard counts={myJobsQuery.data} /> : null}
      {!technicianView && dashboardQuery.data ? (
        <ManagerDashboard data={dashboardQuery.data} role={user.role} />
      ) : null}
    </div>
  );
}

function TechnicianDashboard({ counts }: { counts: MyJobCounts }) {
  return (
    <Section title="My work" description="Assigned jobs only. Manager queues stay on the manager dashboard.">
      <div className="summary-strip">
        {TECHNICIAN_ACTION_CARDS.map((card) => {
          const value = counts[card.countKey] ?? 0;
          return <ActionCard key={card.id} label={card.label} value={value} href={card.href} tone={actionCardTone(value)} />;
        })}
      </div>
    </Section>
  );
}

function ManagerDashboard({ data, role }: { data: MaintenanceDashboard; role: string | null }) {
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
  const diagnostics = [
    ["MTTR", data.notAvailable?.mttr ?? "Not Configured"],
    ["MTBF", data.notAvailable?.mtbf ?? "Not Configured"],
    ["ERP exceptions", data.notAvailable?.erpExceptions ?? "Not Available"],
    ["Gate / availability blocks", data.notAvailable?.gateBlocks ?? "Not Available"]
  ];

  return (
    <>
      <Section title="Needs attention" description="The four queues to clear first.">
        <div className="summary-strip">
          {dashboardCardsForRole(role, MANAGER_ACTION_CARDS).map((card) => {
            const value = counts[card.countKey] ?? 0;
            const tone = card.id === "overdue" && value > 0 ? "critical" : actionCardTone(value);
            return <ActionCard key={card.id} label={card.label} value={value} href={card.href} tone={tone} />;
          })}
        </div>
      </Section>

      <Section
        title="Priority work orders"
        description="The five most urgent open jobs."
        action={
          <Link
            href={"/work-orders?filter=open" as never}
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            View all
          </Link>
        }
      >
        {priority.length === 0 ? (
          <EmptyState title="Nothing urgent" description="No overdue or high-priority work orders right now." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Work order</th>
                  <th className="px-3 py-2 font-medium">Asset</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Due</th>
                  <th className="px-3 py-2 font-medium">Assignee</th>
                </tr>
              </thead>
              <tbody>
                {priority.map((wo) => (
                  <tr key={wo.id} className="border-b last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        href={`/maintenance/jobs?wo=${wo.id}` as never}
                        className="font-medium text-brand-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      >
                        {wo.woNumber}
                      </Link>
                      <div className="text-slate-700">{wo.title}</div>
                    </td>
                    <td className="px-3 py-3">{wo.assetName || jobDomainLabel(wo.jobDomain)}</td>
                    <td className="px-3 py-3">{wo.priority}</td>
                    <td className="px-3 py-3">{humanWorkOrderStatusLabel(wo.status)}</td>
                    <td className="px-3 py-3">{formatDue(wo.dueDate)}</td>
                    <td className="px-3 py-3">{wo.assigneeName || "Unassigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Workload" description="Open load by stage. Each chip opens that stage.">
        <div className="flex flex-wrap gap-2">
          {dashboardCardsForRole(role, WORKLOAD_CARDS).map((card) => {
            const value = counts[card.countKey] ?? 0;
            return (
              <Link
                key={card.id}
                href={card.href as never}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                aria-label={`${card.label}: ${value}`}
              >
                <span>{card.label}</span>
                <span className="font-semibold tabular-nums">{value}</span>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section title="Domain breakdown" description="Open jobs by domain.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ["Machinery", data.machineryJobs, "/maintenance/jobs/machinery?queue=open-load"],
            ["Vehicle", data.vehicleJobs, "/maintenance/jobs/vehicle?queue=open-load"],
            ["Service", data.serviceJobs, "/maintenance/jobs/service?queue=open-load"]
          ].map(([label, value, href]) => (
            <Link
              key={label}
              href={href as never}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              aria-label={`${label}: ${value} open jobs`}
            >
              <span className="font-medium text-slate-800">{label}</span>
              <span className="text-lg font-semibold tabular-nums text-slate-900">{value}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Pipeline" description="Requests, preventive work, and approvals that can unblock jobs.">
        <div className="summary-strip">
          <ActionCard label="Requests awaiting action" value={data.requestsOpen} href="/requests?stage=open" tone={actionCardTone(data.requestsOpen)} />
          <ActionCard label="PM due soon" value={data.pmDueSoon} href={PM_DUE_SOON_HREF} tone={actionCardTone(data.pmDueSoon)} />
          {data.availability.approvals && data.pendingApprovals != null ? (
            <ActionCard
              label="Approvals pending"
              value={data.pendingApprovals}
              href="/approvals"
              tone={actionCardTone(data.pendingApprovals)}
            />
          ) : null}
        </div>
      </Section>

      <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <summary className="cursor-pointer font-medium text-slate-900">Setup and diagnostics</summary>
        <ul className="mt-3 space-y-1">
          {diagnostics.map(([label, value]) => (
            <li key={label}>
              {label}: {value}
            </li>
          ))}
          <li>
            Low stock is not shown here. Bileeta owns stock; the local spare-part quantity is not the operational
            balance.
          </li>
        </ul>
      </details>
    </>
  );
}
