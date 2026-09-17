"use client";

import Link from "next/link";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

export default function MaintenanceCostsPage() {
  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Home", href: "/action-center" },
          { label: "Maintenance", href: "/maintenance" },
          { label: "Costs" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Maintenance Costs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Job-wise cost rollups (parts, labour, vendor). MaintainPro does not post ERP
          accounting entries — Bileeta remains authoritative for stock valuation.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href="/vehicles/costs"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold text-slate-900">Vehicle Cost History</h2>
          <p className="mt-1 text-sm text-slate-600">Fleet maintenance spend and cost per km where data exists.</p>
        </Link>
        <Link
          href="/reports"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold text-slate-900">Reports & Analytics</h2>
          <p className="mt-1 text-sm text-slate-600">Cost by department, asset, vendor, and month.</p>
        </Link>
        <Link
          href="/maintenance/jobs"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold text-slate-900">Job Cost Snapshots</h2>
          <p className="mt-1 text-sm text-slate-600">Open a work order to view estimated vs actual cost.</p>
        </Link>
        <Link
          href="/procurement/vendors"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold text-slate-900">Vendor Spend</h2>
          <p className="mt-1 text-sm text-slate-600">External repair cases and supplier cost context.</p>
        </Link>
      </div>
    </div>
  );
}
