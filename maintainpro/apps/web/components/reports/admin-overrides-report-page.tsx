"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { getApiErrorMessage } from "@/lib/api-client";
import { fetchAdminOverrides, severityClass, type AdminOverrideRow } from "@/lib/fraud-control-api";

function toCsv(rows: AdminOverrideRow[]) {
  const header = ["date", "actorRole", "module", "action", "entity", "entityId", "reason", "event", "riskSeverity", "workOrderId"];
  const lines = rows.map((row) =>
    [
      row.createdAt,
      row.actorRole ?? "",
      row.module ?? "",
      row.action,
      row.entity,
      row.entityId,
      row.reason ?? "",
      row.event ?? "",
      row.riskSeverity,
      row.workOrderId ?? ""
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

export function AdminOverridesReportPage() {
  const [rows, setRows] = useState<AdminOverrideRow[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminOverrides({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 200
      });
      setRows(data.rows);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load admin override report."));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `admin-overrides-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-brand-700" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900">Admin Overrides</h1>
        </div>
        <p className="text-sm text-slate-600">All sensitive overrides with reason and audit metadata.</p>
        <Link href={"/reports/fraud-control" as Route} className="text-xs font-medium text-brand-700 hover:underline">
          Back to fraud dashboard
        </Link>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-medium text-slate-600">
          From
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          To
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </label>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white">
          <RefreshCw size={14} /> Apply
        </button>
        <button type="button" onClick={exportCsv} disabled={rows.length === 0} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
          <Download size={14} /> Export CSV
        </button>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Module</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Work order</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{row.actorRole ?? "—"}</td>
                <td className="px-3 py-2">{row.module ?? "—"}</td>
                <td className="px-3 py-2">{row.event ?? row.action}</td>
                <td className="px-3 py-2 max-w-xs truncate" title={row.reason ?? ""}>{row.reason ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityClass(row.riskSeverity)}`}>
                    {row.riskSeverity}
                  </span>
                </td>
                <td className="px-3 py-2">{row.workOrderId ? <Link href={`/work-orders/${row.workOrderId}` as Route} className="text-brand-700 hover:underline">View</Link> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? <p className="p-4 text-sm text-slate-600">No override records for the selected filters.</p> : null}
      </div>
    </div>
  );
}
