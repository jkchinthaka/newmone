import { Suspense } from "react";

import { CleaningOverview } from "./cleaning-overview";

export const dynamic = "force-dynamic";

export default function CleaningPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-lime-50 p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-emerald-100/70 blur-2xl" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
          Smart Hygiene Operations
        </p>
        <h1 className="relative mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
          Enterprise Cleaning Command Center
        </h1>
        <p className="relative mt-2 max-w-3xl text-sm text-slate-600">
          Real-time schedule enforcement, proof-based visit validation, proactive alerts,
          and compliance analytics for every cleaning location.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-slate-500">Loading metrics…</p>}>
        <CleaningOverview />
      </Suspense>
    </div>
  );
}
