"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingCardSkeleton, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type OpsOverview = {
  openJobs: number;
  machineryJobs: number;
  serviceJobs: number;
  vehicleJobs: number;
  criticalJobs: number;
  overdueJobs: number;
  waitingParts: number;
  externalJobs: number;
  pendingApprovals: number;
  pmDueSoon: number;
  lowStock: number;
  requestsOpen: number;
  generatedAt: string;
};

function KpiCard({
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
  const tones = {
    default: "border-slate-200 bg-white",
    warn: "border-amber-200 bg-amber-50",
    critical: "border-red-200 bg-red-50"
  };
  return (
    <Link
      href={href as any}
      className={`rounded-xl border p-4 shadow-sm transition hover:opacity-90 ${tones[tone]}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </Link>
  );
}

async function fetchOpsOverview(): Promise<OpsOverview> {
  const res = await apiClient.get<{ data: OpsOverview }>("/admin/maintenance-config/overview");
  return res.data.data;
}

export default function MaintenanceDashboardPage() {
  const query = useQuery({
    queryKey: withTenantScope(["maintenance", "ops-overview"]),
    queryFn: fetchOpsOverview,
    refetchInterval: 60_000
  });

  if (query.isLoading) {
    return (
      <LoadingState title="Loading maintenance dashboard" description="Fetching operational KPIs.">
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

  const d = query.data;

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Home", href: "/action-center" },
          { label: "Maintenance" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Maintenance Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Unified operations view across Machinery, Service, and Vehicle jobs.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open Jobs" value={d.openJobs} href="/maintenance/jobs" />
        <KpiCard label="Machinery Jobs" value={d.machineryJobs} href="/maintenance/jobs/machinery" />
        <KpiCard label="Service Jobs" value={d.serviceJobs} href="/maintenance/jobs/service" />
        <KpiCard label="Vehicle Jobs" value={d.vehicleJobs} href="/maintenance/jobs/vehicle" />
        <KpiCard
          label="Critical Jobs"
          value={d.criticalJobs}
          href="/work-orders?priority=CRITICAL"
          tone={d.criticalJobs > 0 ? "critical" : "default"}
        />
        <KpiCard
          label="Overdue Jobs"
          value={d.overdueJobs}
          href="/work-orders?smartView=overdue"
          tone={d.overdueJobs > 0 ? "critical" : "default"}
        />
        <KpiCard
          label="Waiting for Parts"
          value={d.waitingParts}
          href="/work-orders?smartView=waiting-parts"
          tone={d.waitingParts > 0 ? "warn" : "default"}
        />
        <KpiCard label="External Vendor Jobs" value={d.externalJobs} href="/maintenance/jobs" />
        <KpiCard label="Open Requests" value={d.requestsOpen} href="/requests" />
        <KpiCard
          label="Approvals Pending"
          value={d.pendingApprovals}
          href="/approvals"
          tone={d.pendingApprovals > 0 ? "warn" : "default"}
        />
        <KpiCard
          label="PM Due Soon"
          value={d.pmDueSoon}
          href="/maintenance/plans"
          tone={d.pmDueSoon > 0 ? "warn" : "default"}
        />
        <KpiCard
          label="Low Stock"
          value={d.lowStock}
          href="/inventory"
          tone={d.lowStock > 0 ? "warn" : "default"}
        />
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <Link
          href={"/maintenance/jobs/machinery" as any}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold text-slate-900">Machinery Jobs</h2>
          <p className="mt-1 text-sm text-slate-600">Production and utility equipment work orders.</p>
        </Link>
        <Link
          href={"/maintenance/jobs/service" as any}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold text-slate-900">Service Jobs</h2>
          <p className="mt-1 text-sm text-slate-600">Facility and building service work.</p>
        </Link>
        <Link
          href={"/maintenance/jobs/vehicle" as any}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold text-slate-900">Vehicle Jobs</h2>
          <p className="mt-1 text-sm text-slate-600">Fleet repair, service, and inspection defects.</p>
        </Link>
      </section>
    </div>
  );
}
