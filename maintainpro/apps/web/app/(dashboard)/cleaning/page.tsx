import { Suspense } from "react";

import { CleaningOverview } from "./cleaning-overview";

export const dynamic = "force-dynamic";

export default function CleaningPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
          Cleaning Management
        </p>
        <h1 className="mt-2 text-2xl font-bold text-emerald-900">
          Washroom &amp; Toilet Hygiene Operations
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-emerald-800">
          Manage QR-code visit logs, scheduled checklists, supervisor sign-off and facility
          issue reporting across all your cleaning locations.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-slate-500">Loading metrics…</p>}>
        <CleaningOverview />
      </Suspense>
    </div>
  );
}
