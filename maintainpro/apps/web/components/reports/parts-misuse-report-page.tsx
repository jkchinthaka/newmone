"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { getApiErrorMessage } from "@/lib/api-client";
import { fetchPartsMisuseReport, severityClass } from "@/lib/fraud-control-api";

export function PartsMisuseReportPage() {
  const [metrics, setMetrics] = useState<Record<string, number | string | string[]> | null>(null);
  const [cards, setCards] = useState<Array<{ type: string; label: string; count: number; severity: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPartsMisuseReport();
      setMetrics(data.metrics);
      setCards(data.cards ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load parts misuse report."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metricEntries = metrics
    ? Object.entries(metrics).filter(([key]) => key !== "notes" && key !== "generatedAt")
    : [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-brand-700" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900">Parts Misuse</h1>
        </div>
        <p className="text-sm text-slate-600">Unaccounted parts, duplicate requests, and off-system issue attempts.</p>
        <Link href={"/reports/fraud-control" as Route} className="text-xs font-medium text-brand-700 hover:underline">
          Back to fraud dashboard
        </Link>
      </header>

      <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white">
        <RefreshCw size={14} /> Refresh
      </button>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      {cards.length > 0 ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.type} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{card.label}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityClass(card.severity as "LOW")}`}>
                  {card.severity}
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{card.count}</p>
            </div>
          ))}
        </section>
      ) : null}

      {metricEntries.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Parts governance metrics</h2>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {metricEntries.map(([key, value]) => (
              <div key={key} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">{key.replace(/([A-Z])/g, " $1")}</dt>
                <dd className="text-lg font-semibold text-slate-900">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
