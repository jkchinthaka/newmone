"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { EmptyState, ErrorState, LoadingCardSkeleton, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type DashboardQueueLink = {
  key: string;
  label: string;
  href: string;
  count: number;
  tone: "default" | "warn" | "critical";
};

type MaintenanceDashboard = {
  openJobs: number;
  machineryJobs: number;
  serviceJobs: number;
  vehicleJobs: number;
  criticalJobs: number;
  overdueJobs: number;
  waitingParts: number;
  externalJobs: number;
  pendingApprovals: number | null;
  pmDueSoon: number;
  lowStock: number | null;
  requestsOpen: number;
  unplannedJobs: number;
  unassignedJobs: number;
  inProgressJobs: number;
  onHoldJobs: number;
  verificationRequired: number;
  reworkRequired: number;
  attentionQueues: DashboardQueueLink[];
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

function KpiCard({
  label,
  value,
  href,
  tone = "default",
  unavailable
}: {
  label: string;
  value: number | null | undefined;
  href?: string;
  tone?: "default" | "warn" | "critical";
  unavailable?: string;
}) {
  const tones = {
    default: "border-slate-200 bg-white",
    warn: "border-amber-200 bg-amber-50",
    critical: "border-red-200 bg-red-50"
  };
  const display =
    unavailable != null
      ? unavailable
      : value == null
        ? "Not Available"
        : String(value);
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-2 font-bold text-slate-900 ${unavailable || value == null ? "text-lg" : "text-3xl"}`}
      >
        {display}
      </p>
    </>
  );
  if (!href || unavailable != null || value == null) {
    return (
      <div className={`rounded-xl border p-4 shadow-sm ${tones[tone]}`} aria-label={label}>
        {body}
      </div>
    );
  }
  return (
    <Link
      href={href as any}
      className={`rounded-xl border p-4 shadow-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${tones[tone]}`}
      aria-label={`${label}: ${display}`}
    >
      {body}
    </Link>
  );
}

async function fetchDashboard(): Promise<MaintenanceDashboard> {
  const res = await apiClient.get<{ data: MaintenanceDashboard }>("/maintenance/dashboard");
  return res.data.data;
}

function Section({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3" aria-labelledby={title.replace(/\s+/g, "-").toLowerCase()}>
      <div>
        <h2
          id={title.replace(/\s+/g, "-").toLowerCase()}
          className="text-lg font-semibold text-slate-900"
        >
          {title}
        </h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function MaintenanceDashboardPage() {
  const query = useQuery({
    queryKey: withTenantScope(["maintenance", "dashboard", "d6"]),
    queryFn: fetchDashboard,
    staleTime: 30_000,
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
  const attention = (d.attentionQueues ?? []).filter((q) => q.count > 0);

  return (
    <div className="space-y-8">
      <PageBreadcrumbs
        items={[
          { label: "Home", href: "/action-center" },
          { label: "Maintenance" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Maintenance Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          What needs attention now across Machinery, Service, and Vehicle work — decision support
          only. Day-to-day priorities stay on Action Center.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Updated {new Date(d.generatedAt).toLocaleString()}
        </p>
      </div>

      <Section
        title="Needs attention now"
        description="Overdue, critical, verification, and blocked queues with drill-down links."
      >
        {attention.length === 0 ? (
          <EmptyState
            title="Nothing urgent"
            description="No overdue, critical, verification, or rework items right now."
          />
        ) : (
          <div className="grid gap-3 grid-cols-1 min-[390px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {attention.map((q) => (
              <KpiCard key={q.key} label={q.label} value={q.count} href={q.href} tone={q.tone} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Workload" description="Open load by lifecycle stage.">
        <div className="grid gap-3 grid-cols-1 min-[390px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          <KpiCard label="Open maintenance" value={d.openJobs} href="/maintenance/jobs" />
          <KpiCard label="Unplanned" value={d.unplannedJobs} href="/work-orders?status=OPEN" />
          <KpiCard
            label="Unassigned"
            value={d.unassignedJobs}
            href="/work-orders?smartView=action-required"
            tone={d.unassignedJobs > 0 ? "warn" : "default"}
          />
          <KpiCard
            label="In progress"
            value={d.inProgressJobs}
            href="/work-orders?status=IN_PROGRESS"
          />
          <KpiCard
            label="On hold"
            value={d.onHoldJobs}
            href="/work-orders?status=ON_HOLD"
            tone={d.onHoldJobs > 0 ? "warn" : "default"}
          />
          <KpiCard
            label="Verification required"
            value={d.verificationRequired}
            href="/work-orders?smartView=supervisor-verification"
            tone={d.verificationRequired > 0 ? "warn" : "default"}
          />
          <KpiCard
            label="Rework required"
            value={d.reworkRequired}
            href="/work-orders?status=REWORK_REQUIRED"
            tone={d.reworkRequired > 0 ? "critical" : "default"}
          />
          <KpiCard
            label="Waiting for parts"
            value={d.waitingParts}
            href="/work-orders?smartView=waiting-parts"
            tone={d.waitingParts > 0 ? "warn" : "default"}
          />
        </div>
      </Section>

      <Section
        title="Domain breakdown"
        description="Open jobs by Machinery, Service, and Vehicle domains."
      >
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <KpiCard
            label="Machinery"
            value={d.machineryJobs}
            href="/maintenance/jobs/machinery"
          />
          <KpiCard label="Service" value={d.serviceJobs} href="/maintenance/jobs/service" />
          <KpiCard label="Vehicle" value={d.vehicleJobs} href="/maintenance/jobs/vehicle" />
        </div>
      </Section>

      <Section title="Pipeline & signals" description="Requests, planning, and stock where permitted.">
        <div className="grid gap-3 grid-cols-1 min-[390px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          <KpiCard
            label="Requests awaiting action"
            value={d.requestsOpen}
            href="/requests"
            tone={d.requestsOpen > 0 ? "warn" : "default"}
          />
          <KpiCard
            label="PM due soon (7d)"
            value={d.pmDueSoon}
            href="/maintenance/plans"
            tone={d.pmDueSoon > 0 ? "warn" : "default"}
          />
          <KpiCard
            label="Approvals pending"
            value={d.pendingApprovals}
            href={d.availability.approvals ? "/approvals" : undefined}
            unavailable={d.availability.approvals ? undefined : "Not Available"}
            tone={
              d.pendingApprovals != null && d.pendingApprovals > 0 ? "warn" : "default"
            }
          />
          <KpiCard
            label="Low stock"
            value={d.lowStock}
            href={d.availability.inventory ? "/inventory" : undefined}
            unavailable={d.availability.inventory ? undefined : "Not Available"}
            tone={d.lowStock != null && d.lowStock > 0 ? "warn" : "default"}
          />
          <KpiCard
            label="MTTR"
            value={null}
            unavailable={d.notAvailable?.mttr ?? "Not Configured"}
          />
          <KpiCard
            label="MTBF"
            value={null}
            unavailable={d.notAvailable?.mtbf ?? "Not Configured"}
          />
          <KpiCard
            label="ERP exceptions"
            value={null}
            unavailable={d.notAvailable?.erpExceptions ?? "Not Available"}
          />
          <KpiCard
            label="Gate / availability blocks"
            value={null}
            unavailable={d.notAvailable?.gateBlocks ?? "Not Available"}
          />
        </div>
      </Section>

      <p className="text-xs text-slate-500">
        For role-aware daily priorities, use{" "}
        <Link href={"/action-center" as any} className="underline">
          Action Center
        </Link>
        .
      </p>
    </div>
  );
}
