"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  defaultMaintenanceFilters,
  exportMaintenanceException,
  fetchMaintenanceExceptionDetail,
  fetchMaintenanceExceptions,
  fetchMaintenanceKpis,
  type MaintenanceExceptionCard,
  type MaintenanceExceptionRow,
  type MaintenanceExceptionType,
  type MaintenanceReportFilters,
  severityClass
} from "./maintenance-reports-api";

export function MaintenanceExceptionsPage() {
  const [filters, setFilters] = useState<MaintenanceReportFilters>(defaultMaintenanceFilters);
  const [cards, setCards] = useState<MaintenanceExceptionCard[]>([]);
  const [kpis, setKpis] = useState<Record<string, unknown> | null>(null);
  const [selectedType, setSelectedType] = useState<MaintenanceExceptionType | null>(null);
  const [rows, setRows] = useState<MaintenanceExceptionRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summary, kpiData] = await Promise.all([
        fetchMaintenanceExceptions(filters),
        fetchMaintenanceKpis(filters)
      ]);
      setCards(summary.cards ?? []);
      setGeneratedAt(summary.generatedAt ?? new Date().toISOString());
      setKpis(kpiData as Record<string, unknown>);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load maintenance reports. Please check backend connection."));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadDetail = useCallback(
    async (type: MaintenanceExceptionType) => {
      setSelectedType(type);
      setDetailLoading(true);
      try {
        const detail = await fetchMaintenanceExceptionDetail(type, filters);
        setRows(detail.rows ?? []);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Could not load exception details."));
        setRows([]);
      } finally {
        setDetailLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const woKpis = useMemo(() => {
    const workOrders = (kpis?.workOrders ?? {}) as Record<string, number>;
    return [
      { label: "Total work orders", value: workOrders.total ?? 0 },
      { label: "Open", value: workOrders.open ?? 0 },
      { label: "In progress", value: workOrders.inProgress ?? 0 },
      { label: "Overdue", value: workOrders.overdue ?? 0 },
      { label: "Completed", value: workOrders.completed ?? 0 }
    ];
  }, [kpis]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-brand-700" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900">Maintenance Exceptions & Fraud Monitoring</h1>
        </div>
        <p className="text-sm text-slate-600">
          Rule-based operational risk indicators for supervisors and managers — not AI fraud detection.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            From
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            To
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500"
          >
            <RefreshCw size={14} /> Apply
          </button>
          {generatedAt ? (
            <p className="text-xs text-slate-500">Last updated {new Date(generatedAt).toLocaleString()}</p>
          ) : null}
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {woKpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className="text-2xl font-semibold text-slate-900">{loading ? "…" : kpi.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Exception severity summary</h2>
        {loading ? (
          <div className="mt-3 flex items-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading exceptions…
          </div>
        ) : cards.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No exceptions found for the selected period.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <button
                key={card.type}
                type="button"
                onClick={() => void loadDetail(card.type)}
                className={`rounded-lg border px-3 py-2 text-left transition hover:shadow-sm ${severityClass(card.severity)} ${selectedType === card.type ? "ring-2 ring-brand-500" : ""}`}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">{card.severity}</p>
                <p className="mt-1 text-xs">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold">{card.count}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Exception detail</h2>
          {selectedType ? (
            <button
              type="button"
              onClick={() => void exportMaintenanceException(selectedType, filters).catch((err) => toast.error(getApiErrorMessage(err, "Export failed.")))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download size={14} /> Export CSV
            </button>
          ) : null}
        </div>

        {!selectedType ? (
          <p className="mt-3 text-sm text-slate-500">Select an exception card to view work order details.</p>
        ) : detailLoading ? (
          <div className="mt-3 flex items-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading details…
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No exceptions found for the selected period.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">WO</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Asset</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Risk</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.workOrderId}-${row.exceptionType}`} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium">{row.woNumber}</td>
                    <td className="py-2 pr-3">{row.title}</td>
                    <td className="py-2 pr-3">{row.assetName ?? "—"}</td>
                    <td className="py-2 pr-3">{row.status}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityClass(row.riskSeverity)}`}>
                        {row.riskScore} · {row.riskSeverity}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{row.exceptionReason}</td>
                    <td className="py-2">
                      <Link href={`/work-orders?open=${row.workOrderId}`} className="font-semibold text-brand-700 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Counts are aligned with Work Order governance (UAT-009) and Parts controls (UAT-010). PDF export, vendor
            invoice gaps, and full BI dashboards remain on the roadmap.
          </p>
        </div>
      </section>
    </div>
  );
}
