"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, FileText, ShieldCheck, Signature } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { fetchDeliveryDashboard } from "@/lib/delivery-api";

export function DeliveryDashboardPage() {
  const query = useQuery({
    queryKey: ["delivery", "dashboard"],
    queryFn: fetchDeliveryDashboard
  });

  const data = query.data as Record<string, number | string | unknown> | undefined;
  const verdict = String(data?.currentVerdict ?? "NOT_READY").replace(/_/g, " ");

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Delivery Readiness</h2>
        <p className="mt-1 text-sm text-slate-500">
          Client handover checklist — requirements, QA, security, deployment, backup, and sign-off.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href={"/delivery-readiness/checklists" as Route} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
          Checklists
        </Link>
        <Link href={"/delivery-readiness/final-report" as Route} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
          Final Handover Report
        </Link>
        <Link href={"/delivery-readiness/sign-off" as Route} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
          Sign-off
        </Link>
        <Link href={"/qa" as Route} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
          QA & Incidents
        </Link>
      </nav>

      {query.isLoading ? (
        <InlineLoadingState label="Loading delivery readiness…" />
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current verdict</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{verdict}</p>
            <p className="mt-1 text-sm text-slate-600">
              {String(data?.completionPercentage ?? 0)}% complete · {String(data?.passed ?? 0)} passed of{" "}
              {String(data?.total ?? 0)} items
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Passed", value: data?.passed, icon: CheckCircle2, tone: "text-emerald-700" },
              { label: "Failed", value: data?.failed, icon: ClipboardCheck, tone: "text-rose-700" },
              { label: "Blocked", value: data?.blocked, icon: ShieldCheck, tone: "text-red-700" },
              { label: "Accepted Risks", value: data?.acceptedRisks, icon: FileText, tone: "text-amber-700" }
            ].map((card) => (
              <div key={card.label} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className={`flex items-center gap-2 ${card.tone}`}>
                  <card.icon className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{card.label}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{String(card.value ?? 0)}</p>
              </div>
            ))}
          </div>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Category progress</h3>
            <div className="mt-4 space-y-2">
              {((data?.byCategory as Array<Record<string, unknown>>) ?? []).map((row) => (
                <div key={String(row.category)} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-700">{String(row.label)}</span>
                  <span className="text-slate-500">
                    {String(row.passed)}/{String(row.total)} pass
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <div className="flex items-center gap-2 font-medium">
              <Signature className="h-4 w-4" />
              Final sign-off requires all critical blockers resolved or formally accepted.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
