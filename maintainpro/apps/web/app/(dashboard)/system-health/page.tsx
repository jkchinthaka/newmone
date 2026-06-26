"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  RefreshCw,
  ServerCog,
  Settings2
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { ErrorState, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { NotificationUatPanel } from "@/components/admin/notification-uat-panel";
import { ProviderReadinessPanel } from "@/components/admin/provider-readiness-panel";
import { InventoryErpSyncPanel } from "@/components/admin/inventory-erp-sync-panel";

type CheckStatus =
  | "operational"
  | "degraded"
  | "failed"
  | "mock"
  | "misconfigured"
  | "unconfigured"
  | "disabled";

type SystemCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  required: boolean;
  latencyMs?: number;
  message: string;
  action?: string;
  details?: Record<string, unknown>;
};

type ReplicationDetails = {
  mode?: string;
  primaryDatabaseName?: string;
  backupDatabaseName?: string;
  strictModeActive?: boolean;
  pendingEvents?: number;
  processingEvents?: number;
  failedEvents?: number;
  deadLetterEvents?: number;
  lastSuccessfulSync?: string | null;
  replicationLagMs?: number;
};

type SystemHealth = {
  status: "operational" | "degraded";
  service: string;
  environment: string;
  timestamp: string;
  summary: {
    operational: number;
    degraded: number;
    failed: number;
    mock: number;
    misconfigured: number;
    unconfigured: number;
    disabled: number;
    required: number;
  };
  dependencies: SystemCheck[];
  configuration: SystemCheck[];
};

type ApiEnvelope<T> = {
  data: T;
  message: string;
  success: boolean;
};

const statusStyles: Record<CheckStatus, string> = {
  operational: "border-emerald-200 bg-emerald-50 text-emerald-700",
  degraded: "border-amber-200 bg-amber-50 text-amber-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  mock: "border-amber-200 bg-amber-50 text-amber-700",
  misconfigured: "border-rose-200 bg-rose-50 text-rose-700",
  unconfigured: "border-slate-200 bg-slate-50 text-slate-600",
  disabled: "border-slate-200 bg-slate-50 text-slate-600"
};

const statusLabels: Record<CheckStatus, string> = {
  operational: "Operational",
  degraded: "Needs attention",
  failed: "Failed",
  mock: "Mock",
  misconfigured: "Misconfigured",
  unconfigured: "Not configured",
  disabled: "Disabled"
};

function formatTime(value?: string) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDuration(ms?: number) {
  if (!ms || ms < 1) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function asReplicationDetails(check?: SystemCheck): ReplicationDetails | null {
  return (check?.details ?? null) as ReplicationDetails | null;
}

function statusIcon(status: CheckStatus) {
  if (status === "operational") return <CheckCircle2 size={18} />;
  if (status === "failed" || status === "misconfigured") return <AlertTriangle size={18} />;
  if (status === "degraded" || status === "mock") return <AlertTriangle size={18} />;
  return <Settings2 size={18} />;
}

function CheckCard({ check }: { check: SystemCheck }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">{statusIcon(check.status)}</span>
            <h3 className="text-sm font-semibold text-slate-900">{check.label}</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{check.message}</p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[check.status]}`}>
          {statusLabels[check.status]}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>{check.required ? "Required" : "Optional"}</span>
        {typeof check.latencyMs === "number" ? <span>{check.latencyMs} ms</span> : null}
      </div>
      {check.action ? (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          {check.action}
        </p>
      ) : null}
    </article>
  );
}

function ReplicationStatusCard({ check }: { check: SystemCheck }) {
  const details = asReplicationDetails(check) ?? {};
  const modeLabel =
    details.mode === "strict_dual_write"
      ? "Strict dual write"
      : details.mode === "disabled"
        ? "Disabled"
        : "Async outbox";
  const pending = Number(details.pendingEvents ?? 0);
  const processing = Number(details.processingEvents ?? 0);
  const failed = Number(details.failedEvents ?? 0);
  const deadLetter = Number(details.deadLetterEvents ?? 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
            <DatabaseZap size={18} />
            <span>Backup Replication</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {details.primaryDatabaseName ?? "Primary"} to {details.backupDatabaseName ?? "Backup"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{check.message}</p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[check.status]}`}>
          {statusLabels[check.status]}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mode</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{modeLabel}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Open Events</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{pending + processing}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Failures</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{failed + deadLetter}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Lag</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {formatDuration(Number(details.replicationLagMs ?? 0))}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>{check.required ? "Readiness required" : "Readiness optional"}</span>
        <span>{details.strictModeActive ? "Strict mode active" : "Strict mode inactive"}</span>
        <span>Last sync {formatTime(details.lastSuccessfulSync ?? undefined)}</span>
      </div>

      {check.action ? (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          {check.action}
        </p>
      ) : null}
    </section>
  );
}

export default function SystemHealthPage() {
  const healthQuery = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<SystemHealth>>("/health/readiness");
      return response.data.data;
    },
    refetchInterval: 30_000,
    staleTime: 10_000
  });

  const checks = useMemo(() => {
    const health = healthQuery.data;
    return [...(health?.dependencies ?? []), ...(health?.configuration ?? [])];
  }, [healthQuery.data]);
  const replicationCheck = healthQuery.data?.dependencies.find(
    (check) => check.key === "backupDatabaseReplication"
  );
  const dependencies = (healthQuery.data?.dependencies ?? []).filter(
    (check) => check.key !== "backupDatabaseReplication"
  );

  const criticalIssues = checks.filter((check) => check.required && check.status !== "operational");

  return (
    <div className="space-y-6">
      <PageBreadcrumbs />
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
              <ServerCog size={18} />
              <span>System Health</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Production Readiness</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Live dependency status for authentication, database-backed workflows, queues, files, and premium integrations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => healthQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
            disabled={healthQuery.isFetching}
          >
            <RefreshCw size={16} className={healthQuery.isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {healthQuery.isLoading && !healthQuery.data ? (
          <div className="mt-5">
            <LoadingState
              description="Checking databases, queues, integrations, and readiness dependencies."
              title="Loading system health"
            />
          </div>
        ) : null}

        {healthQuery.error ? (
          <div className="mt-5">
            <ErrorState
              error={healthQuery.error}
              onRetry={() => healthQuery.refetch()}
              title="Could not load system health"
              description={toSafeApiErrorMessage(healthQuery.error, "Unable to load system health.")}
            />
          </div>
        ) : null}

        {healthQuery.data ? (
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Overall</p>
              <p className={`mt-2 text-lg font-semibold ${healthQuery.data.status === "operational" ? "text-emerald-700" : "text-amber-700"}`}>
                {healthQuery.data.status === "operational" ? "Operational" : "Degraded"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ready</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{healthQuery.data.summary.operational}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attention</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {healthQuery.data.summary.degraded +
                  healthQuery.data.summary.failed +
                  healthQuery.data.summary.misconfigured +
                  healthQuery.data.summary.mock +
                  healthQuery.data.summary.unconfigured}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Clock3 size={14} /> Last check
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatTime(healthQuery.data.timestamp)}</p>
            </div>
          </div>
        ) : null}
      </section>

      {criticalIssues.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{criticalIssues.length} required dependency check needs attention.</p>
          <p className="mt-1 leading-6">Resolve required checks before relying on production login, sync, file upload, or notification workflows.</p>
        </section>
      ) : null}

      {replicationCheck ? <ReplicationStatusCard check={replicationCheck} /> : null}

      <ProviderReadinessPanel />

      <NotificationUatPanel />

      <InventoryErpSyncPanel />

      <section className="grid gap-4 xl:grid-cols-3">
        {dependencies.map((check) => (
          <CheckCard key={check.key} check={check} />
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Configuration</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {(healthQuery.data?.configuration ?? []).map((check) => (
            <CheckCard key={check.key} check={check} />
          ))}
        </div>
      </section>
    </div>
  );
}