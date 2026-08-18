"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { FgStatusBadge } from "@/components/fg/fg-status-badge";
import { FgSubnav } from "@/components/fg/fg-subnav";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-state";
import { fetchFgDashboard, openFgRecord } from "@/lib/fg-api";
import { FG_KPI_CARDS, controlledFormOpenAction, mapDashboardKpis } from "@/lib/fg-mappers";
import type { FgDashboard, FgFormCard } from "@/lib/fg-types";

export default function FgDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<FgDashboard | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string>("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void fetchFgDashboard()
      .then((result) => {
        if (result.error || !result.data) {
          setError(result.error?.message || "Unable to load FG dashboard.");
          setData(null);
          return;
        }
        setData({ ...result.data, kpis: mapDashboardKpis(result.data.kpis) });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openForm(form: FgFormCard) {
    if (opening) return;
    setOpening(form.code);
    const result = await openFgRecord(form.code, data?.date || new Date().toISOString().slice(0, 10));
    setOpening("");
    if (result.error || !result.data?.record.id) {
      setError(result.error?.message || "Unable to open today's record.");
      return;
    }
    router.push(`/fg/records/${result.data.record.id}` as Route);
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumbs />
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">FG Digital Records</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Controlled production records</h1>
        <p className="mt-1 text-sm text-slate-600">Controlled production records, review workflow and QA verification</p>
      </header>
      <FgSubnav />
      {loading ? <LoadingState title="Loading FG dashboard" /> : null}
      {!loading && error ? <ErrorState description={error} onRetry={load} /> : null}
      {!loading && !error && data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {FG_KPI_CARDS.map((card) => (
              <article key={card.key} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{data.kpis[card.key]}</p>
              </article>
            ))}
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            {data.forms.map((form) => {
              const action = controlledFormOpenAction(form);
              return (
                <article key={form.code} className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{form.code}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{form.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{action.secondaryLabel}</p>
                  <div className="mt-3">
                    <FgStatusBadge label={form.statusLabel} />
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={Boolean(opening)}
                      onClick={() => void openForm(form)}
                    >
                      {opening === form.code ? "Opening…" : action.label}
                    </button>
                    {form.todayRecord ? (
                      <Link
                        href={`/fg/records/${form.todayRecord.id}` as Route}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700"
                      >
                        View today's record
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
          {data.todayRecords.length === 0 ? (
            <EmptyState title="No controlled records for today" description="Open a controlled form to start today's record." />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
