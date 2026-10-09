"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { refreshMaintenanceForecasts } from "@/lib/enterprise-ops-api";
import { MAINTENANCE_FORECAST_EMPTY_MESSAGE } from "@/lib/maintenance-forecast-copy";
import { apiClient } from "@/lib/api-client";

type ForecastItem = {
  id: string;
  scheduleId: string;
  assetName: string;
  assetCode: string;
  criticality: string | null;
  taskName: string;
  intervalLabel: string | null;
  currentUsage: number | null;
  usageUnit: string;
  estimatedDueDate: string | null;
  remainingDays: number | null;
  remainingUsage: number | null;
  avgPerDay: number | null;
  confidence: string;
  dataQuality: string;
  status: string;
  reason: string | null;
  lastCompletedAt: string | null;
  lastCompletedUsage: number | null;
  nextThreshold: number | null;
  estimatedDowntimeHours: number | null;
  updatedAt: string;
  workOrder: { id: string; woNumber: string; status: string } | null;
};

type PlannerPayload = {
  items: ForecastItem[];
  summary: { dueIn7: number; dueIn30: number; overdue: number; insufficient: number; lastCalculated: string | null };
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

const REFRESH_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"]);

function labelStatus(status: string) {
  if (status === "DUE_SOON") return "Due Soon";
  if (status === "INSUFFICIENT_DATA") return "Insufficient Data";
  if (status === "ON_TRACK") return "On Track";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function MaintenanceForecastPage() {
  const user = useCurrentUser();
  const canRefresh = REFRESH_ROLES.has(user.role ?? "") || user.permissions.includes("operations.manage");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const horizon = params.get("horizon") ?? "30";
  const dueWindow = params.get("dueWindow") ?? "";
  const confidence = params.get("confidence") ?? "";
  const status = params.get("status") ?? "";
  const queryText = params.get("q") ?? "";
  const sort = params.get("sort") ?? "soonest";
  const page = Math.max(Number(params.get("page") ?? "1") || 1, 1);
  const [draft, setDraft] = useState(queryText);
  const [payload, setPayload] = useState<PlannerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ForecastItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const write = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    const qs = next.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft.trim() === queryText.trim()) return;
      write({ q: draft.trim() || null });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void apiClient
      .get<{ data: PlannerPayload }>("/enterprise-ops/forecasts", {
        params: {
          horizon,
          dueWindow: dueWindow || undefined,
          confidence: confidence || undefined,
          status: status || undefined,
          search: queryText || undefined,
          sort,
          page,
          pageSize: 25
        }
      })
      .then((response) => {
        if (!cancelled) setPayload(response.data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "We couldn't load maintenance forecasts."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [horizon, dueWindow, confidence, status, queryText, sort, page, params]);

  const items = payload?.items ?? [];
  const summary = payload?.summary;
  const total = payload?.meta.total ?? 0;
  const filtered = Boolean(queryText || dueWindow || confidence || status || horizon !== "30");

  async function refresh() {
    setRefreshing(true);
    try {
      await refreshMaintenanceForecasts();
      toast.success("Forecasts recalculated");
      write({ refresh: String(Date.now()) });
    } catch (err) {
      toast.error(
        payload
          ? "Forecast refresh failed. Existing forecast data is still shown."
          : getApiErrorMessage(err, "Forecast refresh failed.")
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="ops-page">
      <PageBreadcrumbs />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Maintenance Forecast</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Estimate upcoming maintenance due dates using meter trends, usage history and preventive-maintenance rules.
          </p>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            When reliable data is unavailable, MaintainPro shows the reason instead of generating an estimate.
          </p>
          {summary?.lastCalculated ? (
            <p className="mt-2 text-xs text-slate-500">
              Last calculated: {new Date(summary.lastCalculated).toLocaleString()}
            </p>
          ) : null}
        </div>
        {canRefresh ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            {refreshing ? <Loader2 className="animate-spin" size={16} /> : null}
            Refresh Forecasts
          </button>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Forecast horizon">
        {[
          ["7", "7 Days"],
          ["30", "30 Days"],
          ["90", "90 Days"],
          ["180", "6 Months"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={horizon === value}
            className={`min-h-11 rounded-lg px-3 text-sm ${horizon === value ? "bg-brand-600 text-white" : "border border-slate-200 bg-white"}`}
            onClick={() => write({ horizon: value === "30" ? null : value })}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Due in 7 Days", summary?.dueIn7 ?? 0, "7"],
          ["Due in 30 Days", summary?.dueIn30 ?? 0, "30"],
          ["Overdue / At Risk", summary?.overdue ?? 0, "overdue"],
          ["Insufficient Data", summary?.insufficient ?? 0, "insufficient"]
        ].map(([label, value, key]) => (
          <button
            key={String(label)}
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left"
            onClick={() =>
              key === "insufficient"
                ? write({ status: "INSUFFICIENT_DATA", dueWindow: null })
                : write({ dueWindow: String(key), status: null })
            }
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 page-title">{value}</p>
          </button>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search asset, code, maintenance plan or task..."
          aria-label="Search forecasts"
          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
        />
        <div className="grid gap-2 md:grid-cols-4">
          <select aria-label="Due window" className="min-h-11 rounded-lg border px-2 text-sm" value={dueWindow} onChange={(e) => write({ dueWindow: e.target.value || null })}>
            <option value="">Due window</option>
            <option value="overdue">Overdue</option>
            <option value="7">Next 7 Days</option>
            <option value="30">Next 30 Days</option>
            <option value="90">Next 90 Days</option>
            <option value="beyond">Beyond 90 Days</option>
          </select>
          <select aria-label="Confidence" className="min-h-11 rounded-lg border px-2 text-sm" value={confidence} onChange={(e) => write({ confidence: e.target.value || null })}>
            <option value="">Confidence</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INSUFFICIENT">Insufficient Data</option>
          </select>
          <select aria-label="Forecast status" className="min-h-11 rounded-lg border px-2 text-sm" value={status} onChange={(e) => write({ status: e.target.value || null })}>
            <option value="">Forecast status</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DUE_SOON">Due Soon</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="ON_TRACK">On Track</option>
            <option value="INSUFFICIENT_DATA">Insufficient Data</option>
          </select>
          <select aria-label="Sort" className="min-h-11 rounded-lg border px-2 text-sm" value={sort} onChange={(e) => write({ sort: e.target.value === "soonest" ? null : e.target.value })}>
            <option value="soonest">Soonest due</option>
            <option value="overdue">Most overdue</option>
            <option value="confidence">Lowest confidence</option>
            <option value="asset">Asset name</option>
          </select>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <p>{total} forecast{total === 1 ? "" : "s"}</p>
          {filtered ? (
            <button type="button" className="min-h-11 rounded-lg border px-3" onClick={() => { setDraft(""); router.replace(pathname as Route); }}>
              Clear Filters
            </button>
          ) : null}
        </div>
      </section>

      {error ? <ErrorState title="We couldn't load maintenance forecasts." description={error} onRetry={() => write({ retry: String(Date.now()) })} retryLabel="Retry" /> : null}
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
          <p className="font-medium text-slate-900">{filtered ? "No forecasts match your filters." : "No forecasts available yet."}</p>
          <p className="mt-1 text-sm text-slate-600">
            {filtered
              ? "Try a different search or clear the current filters."
              : MAINTENANCE_FORECAST_EMPTY_MESSAGE}
          </p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <div className="space-y-2 md:hidden">
            {items.map((item) => (
              <button key={item.id} type="button" className="w-full rounded-xl border bg-white p-3 text-left" onClick={() => setSelected(item)}>
                <p className="font-semibold">{item.assetName}</p>
                <p className="text-xs text-slate-500">{item.assetCode}</p>
                <p className="mt-1 text-sm">{item.taskName}</p>
                <p className="mt-2 text-sm">{labelStatus(item.status)} · {item.confidence}</p>
                {item.reason ? <p className="mt-1 text-sm text-amber-900">{item.reason}</p> : null}
              </button>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Maintenance task</th>
                  <th className="px-3 py-2">Current usage</th>
                  <th className="px-3 py-2">Estimated due</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="cursor-pointer border-t hover:bg-slate-50" onClick={() => setSelected(item)}>
                    <td className="px-3 py-3">
                      <div className="font-medium">{item.assetName}</div>
                      <div className="text-xs text-slate-500">{item.assetCode}</div>
                      {item.criticality ? <div className="text-xs text-slate-500">{item.criticality}</div> : null}
                    </td>
                    <td className="px-3 py-3">
                      <div>{item.taskName}</div>
                      <div className="text-xs text-slate-500">{item.intervalLabel ?? "PM schedule"}</div>
                    </td>
                    <td className="px-3 py-3">{item.currentUsage == null ? "—" : `${item.currentUsage.toLocaleString()} ${item.usageUnit}`}</td>
                    <td className="px-3 py-3">{item.estimatedDueDate ? new Date(item.estimatedDueDate).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-3">
                      {item.remainingDays == null ? "—" : `${Math.round(item.remainingDays)} days`}
                      {item.remainingUsage != null ? <div className="text-xs text-slate-500">~{Math.round(item.remainingUsage)} {item.usageUnit}</div> : null}
                    </td>
                    <td className="px-3 py-3">{item.confidence === "INSUFFICIENT" ? "Insufficient Data" : item.confidence.charAt(0) + item.confidence.slice(1).toLowerCase()}</td>
                    <td className="px-3 py-3">
                      {labelStatus(item.status)}
                      {item.reason ? <div className="text-xs text-amber-900">{item.reason}</div> : null}
                    </td>
                    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                      {item.workOrder ? (
                        <Link className="text-brand-700" href={`/work-orders?wo=${item.workOrder.id}` as Route}>
                          {item.workOrder.woNumber}
                        </Link>
                      ) : item.status === "INSUFFICIENT_DATA" ? (
                        <span className="text-slate-500">Review data</span>
                      ) : (
                        <Link className="text-brand-700" href={"/maintenance/plans" as Route}>
                          Review plan
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-600">
            <p>
              Showing {(page - 1) * 25 + (total ? 1 : 0)}–{Math.min(page * 25, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button type="button" className="min-h-11 rounded-lg border px-3" disabled={page <= 1} onClick={() => write({ page: page <= 2 ? null : String(page - 1) }, false)}>Previous</button>
              <button type="button" className="min-h-11 rounded-lg border px-3" disabled={page >= (payload?.meta.totalPages ?? 1)} onClick={() => write({ page: String(page + 1) }, false)}>Next</button>
            </div>
          </div>
        </>
      ) : null}

      {selected ? (
        <aside className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">Why this date?</h2>
            <button type="button" className="min-h-11 px-2" onClick={() => setSelected(null)}>Close</button>
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div><dt className="text-slate-500">Asset</dt><dd>{selected.assetName} ({selected.assetCode})</dd></div>
            <div><dt className="text-slate-500">Maintenance task</dt><dd>{selected.taskName}</dd></div>
            <div><dt className="text-slate-500">Interval</dt><dd>{selected.intervalLabel ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Current meter</dt><dd>{selected.currentUsage == null ? "—" : `${selected.currentUsage} ${selected.usageUnit}`}</dd></div>
            <div><dt className="text-slate-500">Next threshold</dt><dd>{selected.nextThreshold ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Recent average</dt><dd>{selected.avgPerDay == null ? "—" : `${selected.avgPerDay.toFixed(1)} ${selected.usageUnit}/day`}</dd></div>
            <div><dt className="text-slate-500">Estimated due</dt><dd>{selected.estimatedDueDate ? new Date(selected.estimatedDueDate).toLocaleDateString() : "Not estimated"}</dd></div>
            <div><dt className="text-slate-500">Confidence</dt><dd>{selected.confidence}</dd></div>
            <div><dt className="text-slate-500">Data quality</dt><dd>{selected.dataQuality}</dd></div>
            <div><dt className="text-slate-500">Estimated downtime</dt><dd>{selected.estimatedDowntimeHours == null ? "Not recorded" : `${selected.estimatedDowntimeHours} hours`}</dd></div>
          </dl>
          {selected.reason ? <p className="mt-3 text-amber-900">{selected.reason}</p> : null}
          <p className="mt-3 text-slate-600">
            Remaining usage is the gap to the next PM threshold. Days are remaining usage divided by recent average usage when that trend is valid.
          </p>
        </aside>
      ) : null}
    </div>
  );
}
