"use client";

import Link from "next/link";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

export default function MaintenanceHistoryPage() {
  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Home", href: "/action-center" },
          { label: "Maintenance", href: "/maintenance" },
          { label: "History" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Maintenance History</h1>
        <p className="mt-1 text-sm text-slate-600">
          Timeline of completed and closed jobs by asset, vehicle, or location. Open any
          register record for its linked work-order history.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/assets" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Assets / Machinery</h2>
          <p className="mt-1 text-sm text-slate-600">Open an asset to view maintenance history.</p>
        </Link>
        <Link href="/vehicles" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Vehicles</h2>
          <p className="mt-1 text-sm text-slate-600">Service history, costs, and compliance.</p>
        </Link>
        <Link
          href="/maintenance/jobs"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 className="font-semibold">All Jobs</h2>
          <p className="mt-1 text-sm text-slate-600">Filter closed / completed work orders.</p>
        </Link>
      </div>
    </div>
  );
}
