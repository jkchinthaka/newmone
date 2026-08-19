"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";

import { FgStatusBadge } from "@/components/fg/fg-status-badge";
import { FgSubnav } from "@/components/fg/fg-subnav";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-state";
import { fetchFgHistory } from "@/lib/fg-api";
import { djangoPrintHref } from "@/lib/fg-mappers";
import type { FgFormCard, FgRecordSummary } from "@/lib/fg-types";

export default function FgHistoryPage() {
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", formCode: "", status: "", vehicle: "", recorder: "" });
  const [records, setRecords] = useState<FgRecordSummary[]>([]);
  const [forms, setForms] = useState<FgFormCard[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void fetchFgHistory(filters)
      .then((result) => {
        if (result.error) {
          setError(result.error.message);
          return;
        }
        setRecords(result.data?.records ?? []);
        setForms(result.data?.forms ?? []);
      })
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">FG record history</h1>
        <p className="text-sm text-slate-600">Search completed and in-progress controlled records.</p>
      </header>
      <FgSubnav />
      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          load();
        }}
      >
        <label className="text-sm">
          From
          <input
            type="date"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
            value={filters.dateFrom}
            onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
          />
        </label>
        <label className="text-sm">
          To
          <input
            type="date"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
            value={filters.dateTo}
            onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
          />
        </label>
        <label className="text-sm">
          Form
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
            value={filters.formCode}
            onChange={(event) => setFilters((current) => ({ ...current, formCode: event.target.value }))}
          >
            <option value="">All forms</option>
            {forms.map((form) => (
              <option key={form.code} value={form.code}>
                {form.code} — {form.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Status
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
          </select>
        </label>
        <label className="text-sm">
          Vehicle
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
            value={filters.vehicle}
            onChange={(event) => setFilters((current) => ({ ...current, vehicle: event.target.value }))}
          />
        </label>
        <label className="text-sm">
          Recorder
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
            value={filters.recorder}
            onChange={(event) => setFilters((current) => ({ ...current, recorder: event.target.value }))}
          />
        </label>
        <div className="md:col-span-3">
          <button type="submit" className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">
            Apply filters
          </button>
        </div>
      </form>
      {loading ? <LoadingState title="Loading history" /> : null}
      {!loading && error ? <ErrorState description={error} onRetry={load} /> : null}
      {!loading && !error && records.length === 0 ? (
        <EmptyState title="No controlled records match these filters" />
      ) : null}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Record</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Vehicle</th>
              <th className="px-3 py-2">Recorder</th>
              <th className="px-3 py-2">Supervisor</th>
              <th className="px-3 py-2">QA</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{record.formCode}</td>
                <td className="px-3 py-2">{record.batchReference}</td>
                <td className="px-3 py-2">—</td>
                <td className="px-3 py-2">{record.recorder?.employeeCode || "—"}</td>
                <td className="px-3 py-2">{record.supervisor?.reviewedBy?.employeeCode || "—"}</td>
                <td className="px-3 py-2">{record.qa?.reviewedBy?.employeeCode || "—"}</td>
                <td className="px-3 py-2">
                  <FgStatusBadge label={record.statusLabel} />
                </td>
                <td className="px-3 py-2">{record.updatedAt ? record.updatedAt.slice(0, 16).replace("T", " ") : "—"}</td>
                <td className="px-3 py-2">
                  <Link href={`/fg/records/${record.id}` as Route} className="font-semibold text-brand-700">
                    View
                  </Link>
                  {" · "}
                  <a href={djangoPrintHref(record.printPath)} target="_blank" rel="noreferrer" className="font-semibold text-brand-700">
                    Print
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {records.map((record) => (
          <article key={record.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">{record.formCode}</p>
            <h2 className="font-semibold text-slate-900">{record.formTitle}</h2>
            <p className="text-sm text-slate-600">{record.batchReference}</p>
            <div className="mt-2">
              <FgStatusBadge label={record.statusLabel} />
            </div>
            <div className="mt-3 flex gap-3">
              <Link href={`/fg/records/${record.id}` as Route} className="min-h-11 font-semibold text-brand-700">
                View
              </Link>
              <a href={djangoPrintHref(record.printPath)} className="min-h-11 font-semibold text-brand-700">
                Print
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
