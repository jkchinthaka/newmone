"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ErrorState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

type Job = {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  asset: string | null;
  period: { parts: number; labour: number; services: number; actual: number; complete: boolean };
  lifetime: { actual: number; complete: boolean; variance: { amount: number | null; percent: number | null; label: string; explanation: string } };
};

function money(value: number | null) {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(value);
}

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function MaintenanceCostsPage() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const startDate = params.get("startDate") || monthStart();
  const endDate = params.get("endDate") || today();
  const search = params.get("search") || "";
  const status = params.get("status") || "";
  const [searchInput, setSearchInput] = useState(search);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [summary, setSummary] = useState<{ actual: number; parts: number; labour: number; services: number; incompleteJobs: number; currency: string; dateBasis: string } | null>(null);
  const [total, setTotal] = useState(0);
  const [evaluatedAt, setEvaluatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Job | null>(null);

  const writeQuery = (next: Record<string, string | null>) => {
    const query = new URLSearchParams(params.toString());
    query.set("startDate", startDate);
    query.set("endDate", endDate);
    for (const [key, value] of Object.entries(next)) {
      if (!value) query.delete(key);
      else query.set(key, value);
    }
    router.replace(`${pathname}?${query.toString()}` as Route);
  };

  const refresh = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("You are offline. Cost totals were not refreshed.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/reports/maintenance-costs", {
        params: { startDate, endDate, search: search || undefined, status: status || undefined, page: 1, pageSize: 25 }
      });
      const payload = response.data as { data?: { items?: Job[]; summary?: typeof summary; evaluatedAt?: string }; meta?: { total?: number } };
      setJobs(payload.data?.items ?? []);
      setSummary(payload.data?.summary ?? null);
      setEvaluatedAt(payload.data?.evaluatedAt ?? null);
      setTotal(payload.meta?.total ?? 0);
    } catch (err) {
      setJobs([]);
      setSummary(null);
      setError(getApiErrorMessage(err, "We couldn't load maintenance costs."));
    } finally {
      setLoading(false);
    }
  }, [endDate, search, startDate, status]);

  const exportCsv = async () => {
    try {
      const response = await apiClient.get("/reports/maintenance-costs/export", {
        params: { startDate, endDate, search: search || undefined, status: status || undefined },
        responseType: "blob"
      });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "maintenance-costs.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, "The export could not be downloaded."));
    }
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Maintenance Costs</h1>
        <p className="mt-1 text-sm text-slate-600">Track maintenance spending and compare job estimates with recorded costs.</p>
        <p className="mt-1 text-xs text-slate-500">Operational costs; ERP remains the accounting source of truth.</p>
      </header>
      <form className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); writeQuery({ search: searchInput || null, startDate, endDate, status: status || null }); }}>
        <label className="text-sm">From<input type="date" className="mt-1 w-full rounded border px-3 py-2" value={startDate} onChange={(event) => writeQuery({ startDate: event.target.value })} /></label>
        <label className="text-sm">To<input type="date" className="mt-1 w-full rounded border px-3 py-2" value={endDate} onChange={(event) => writeQuery({ endDate: event.target.value })} /></label>
        <label className="text-sm">Search<input className="mt-1 w-full rounded border px-3 py-2" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="WO number, title, or asset" /></label>
        <label className="text-sm">WO status<input className="mt-1 w-full rounded border px-3 py-2" value={status} onChange={(event) => writeQuery({ status: event.target.value || null })} placeholder="Optional status" /></label>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>{loading ? "Loading results" : `${total} jobs`} · LKR · period spend · {summary?.dateBasis}</span>
        <div className="flex gap-2">
          <button type="button" className="min-h-11 rounded border px-3" onClick={() => void refresh()}>Refresh</button>
          <button type="button" className="min-h-11 rounded border px-3" onClick={() => void exportCsv()}>Export</button>
          {(search || status) ? <button type="button" className="min-h-11 rounded border px-3" onClick={() => { setSearchInput(""); writeQuery({ search: null, status: null }); }}>Clear filters</button> : null}
        </div>
      </div>
      {evaluatedAt ? <p className="text-xs text-slate-500">Updated {new Date(evaluatedAt).toLocaleString()}</p> : null}
      {error ? <ErrorState title="We couldn't load maintenance costs." description={error} onRetry={() => void refresh()} /> : null}
      {summary && !error ? (
        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Recorded actual", money(summary.actual)],
            ["Parts", money(summary.parts)],
            ["Labour", money(summary.labour)],
            ["External services", money(summary.services)],
            ["Incomplete jobs", String(summary.incompleteJobs)]
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs uppercase text-slate-500">{label}</p>
              <p className="text-lg font-semibold">{value}</p>
            </div>
          ))}
        </section>
      ) : null}
      {summary && summary.incompleteJobs > 0 ? <p className="text-sm text-amber-900">Some jobs have missing rates or foreign-currency invoices. Those amounts are omitted, not treated as zero. The total is recorded/partial.</p> : null}
      {!loading && !error && jobs.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm">No recorded costs for this period.</p> : null}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Work order</th><th className="px-3 py-2">Asset</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Parts</th><th className="px-3 py-2 text-right">Labour</th><th className="px-3 py-2 text-right">Services</th><th className="px-3 py-2 text-right">Period total</th><th className="px-3 py-2">Completeness</th></tr></thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b">
                <td className="px-3 py-2"><button type="button" className="font-medium text-brand-700 underline" onClick={() => setSelected(job)}>{job.woNumber}</button><div>{job.title}</div></td>
                <td className="px-3 py-2">{job.asset || "—"}</td>
                <td className="px-3 py-2">{job.status}</td>
                <td className="px-3 py-2 text-right">{money(job.period.parts)}</td>
                <td className="px-3 py-2 text-right">{money(job.period.labour)}</td>
                <td className="px-3 py-2 text-right">{money(job.period.services)}</td>
                <td className="px-3 py-2 text-right">{money(job.period.actual)}</td>
                <td className="px-3 py-2">{job.period.complete ? "Complete" : "Partial"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {jobs.map((job) => (
          <li key={job.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setSelected(job)}>{job.woNumber}</button>
            <p className="text-sm">{job.title}</p>
            <p className="mt-1 text-sm">Period total {money(job.period.actual)} · {job.period.complete ? "Complete" : "Partial"}</p>
          </li>
        ))}
      </ul>
      {selected ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Lifetime comparison · {selected.woNumber}</h2>
          <p className="mt-1 text-sm">This compares the job’s lifetime recognized cost with its stored estimate. It is not the period total above.</p>
          <p className="mt-2 text-sm">Lifetime actual {money(selected.lifetime.actual)}. Variance {selected.lifetime.variance.percent == null ? "N/A" : `${selected.lifetime.variance.percent}%`} ({selected.lifetime.variance.label}).</p>
          <p className="text-sm text-slate-600">{selected.lifetime.variance.explanation}</p>
          <Link className="mt-2 inline-flex min-h-11 items-center text-sm text-brand-700 underline" href={`/work-orders?wo=${selected.id}` as Route}>Open work order</Link>
        </section>
      ) : null}
      <nav className="grid gap-2 text-sm sm:grid-cols-2" aria-label="Related cost reports">
        <Link className="rounded border border-slate-200 bg-white px-3 py-2" href={"/vehicles/costs" as Route}>Vehicle Cost History</Link>
        <Link className="rounded border border-slate-200 bg-white px-3 py-2" href={"/reports" as Route}>Reports & Analytics</Link>
        <Link className="rounded border border-slate-200 bg-white px-3 py-2" href={"/maintenance/jobs" as Route}>Job Cost Snapshots</Link>
        <Link className="rounded border border-slate-200 bg-white px-3 py-2" href={"/procurement/vendors" as Route}>Vendor Spend</Link>
      </nav>
    </div>
  );
}
