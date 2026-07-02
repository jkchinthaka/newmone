"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  fetchFraudDashboard,
  severityClass,
  type FraudDashboardAlert,
  type FraudDashboardResponse
} from "@/lib/fraud-control-api";

export function FraudControlDashboardPage() {
  const [data, setData] = useState<FraudDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchFraudDashboard());
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load fraud control dashboard."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-brand-700" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900">Fraud & Control Dashboard</h1>
        </div>
        <p className="text-sm text-slate-600">
          Rule-based operational control indicators — backend-enforced, not frontend-only.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href={"/reports/fraud-control/admin-overrides" as Route} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
          Admin overrides
        </Link>
        <Link href={"/reports/fraud-control/parts-misuse" as Route} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
          Parts misuse
        </Link>
        <Link href="/reports/maintenance-exceptions" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
          Maintenance exceptions
        </Link>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Total alerts" value={data.summary.totalAlerts} />
            <SummaryCard label="Blocked attempts (30d)" value={data.summary.blockedAttempts} />
            <SummaryCard label="High / critical" value={data.summary.highSeverity} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Active control alerts</h2>
            {data.alerts.length === 0 ? (
              <p className="text-sm text-slate-600">No active fraud or control alerts in the current window.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.alerts.map((alert) => (
                  <AlertCard key={alert.key} alert={alert} />
                ))}
              </div>
            )}
          </section>

          <p className="text-xs text-slate-500">{data.disclaimer}</p>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function AlertCard({ alert }: { alert: FraudDashboardAlert }) {
  const content = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
          <p className="text-sm font-medium text-slate-900">{alert.label}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${severityClass(alert.severity)}`}>
          {alert.severity}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{alert.count}</p>
      <p className="mt-1 text-xs text-slate-500">
        {alert.module} · owner {alert.actionOwner ?? "—"}
      </p>
    </div>
  );

  if (alert.href) {
    return <Link href={alert.href as Route}>{content}</Link>;
  }

  return content;
}
