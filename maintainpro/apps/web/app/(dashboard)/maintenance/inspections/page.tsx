"use client";

import Link from "next/link";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

export default function MaintenanceInspectionsPage() {
  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Home", href: "/action-center" },
          { label: "Maintenance", href: "/maintenance" },
          { label: "Inspections" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Inspections</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configurable machinery and vehicle inspections. Use Planning APIs to record results;
          failed critical findings can create maintenance requests.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-700">
          Inspection templates and findings are managed through the planning engine. Create
          corrective work from failed inspections via{" "}
          <Link href="/requests/new" className="font-medium text-brand-700 underline">
            New Request
          </Link>{" "}
          or open related{" "}
          <Link href="/maintenance/jobs" className="font-medium text-brand-700 underline">
            Jobs
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/maintenance/plans"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            Preventive Plans
          </Link>
          <Link
            href="/fleet"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Fleet / Vehicles
          </Link>
        </div>
      </div>
    </div>
  );
}
