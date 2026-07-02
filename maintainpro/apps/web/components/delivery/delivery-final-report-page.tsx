"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { exportDeliveryReport, fetchDeliveryFinalReport } from "@/lib/delivery-api";

export function DeliveryFinalReportPage() {
  const query = useQuery({
    queryKey: ["delivery", "final-report"],
    queryFn: fetchDeliveryFinalReport
  });

  const data = query.data as Record<string, unknown> | undefined;
  const summary = data?.summary as Record<string, number> | undefined;
  const verdict = String(data?.verdict ?? "NOT_READY").replace(/_/g, " ");
  const blockers = (data?.openBlockers as Array<Record<string, string>>) ?? [];
  const categorySummary = (data?.categorySummary as Array<Record<string, unknown>>) ?? [];
  const finalQa = (data?.finalQaChecklist as string[]) ?? [];

  const handleExport = async () => {
    try {
      await exportDeliveryReport();
      toast.success("Report exported (audit recorded)");
    } catch {
      toast.error("Export failed or not permitted");
    }
  };

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Final Handover Report</h2>
          <p className="mt-1 text-sm text-slate-500">Delivery readiness summary for client handover.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <Link href={"/delivery-readiness" as Route} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">
            Dashboard
          </Link>
        </div>
      </header>

      {query.isLoading ? (
        <InlineLoadingState label="Generating final report…" />
      ) : (
        <>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Readiness verdict</p>
            <p className="mt-2 text-2xl font-semibold">{verdict}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
              <div>
                <p className="text-slate-500">Total</p>
                <p className="font-semibold">{summary?.total ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Passed</p>
                <p className="font-semibold text-emerald-700">{summary?.passed ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Failed</p>
                <p className="font-semibold text-rose-700">{summary?.failed ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Blocked</p>
                <p className="font-semibold text-red-700">{summary?.blocked ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Accepted risks</p>
                <p className="font-semibold">{summary?.acceptedRisks ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Open QA critical</p>
                <p className="font-semibold">{summary?.openQaCritical ?? 0}</p>
              </div>
            </div>
          </div>

          {blockers.length > 0 ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                Open blockers ({blockers.length})
              </div>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {blockers.map((b) => (
                  <li key={b.id}>
                    {b.title} — {b.category}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Category summary</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Pass</th>
                    <th className="py-2 pr-4">Fail</th>
                    <th className="py-2 pr-4">Blocked</th>
                    <th className="py-2">Complete</th>
                  </tr>
                </thead>
                <tbody>
                  {categorySummary.map((row) => (
                    <tr key={String(row.category)} className="border-t">
                      <td className="py-2 pr-4">{String(row.label)}</td>
                      <td className="py-2 pr-4">{String(row.passed)}</td>
                      <td className="py-2 pr-4">{String(row.failed)}</td>
                      <td className="py-2 pr-4">{String(row.blocked)}</td>
                      <td className="py-2">{row.complete ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Final QA checklist</h3>
            <ul className="mt-3 grid gap-1 sm:grid-cols-2 text-sm text-slate-700">
              {finalQa.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
