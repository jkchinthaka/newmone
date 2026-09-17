"use client";

import Link from "next/link";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

export default function AdminMaintenanceConfigPage() {
  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Maintenance Configuration" }]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Maintenance Configuration</h1>
        <p className="mt-1 text-sm text-slate-600">
          Control center for job domains, categories, priorities, and approvals.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href="/admin/job-categories"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold">Job Domains & Categories</h2>
          <p className="mt-1 text-sm text-slate-600">
            MACHINERY, SERVICE, VEHICLE main/sub categories.
          </p>
        </Link>
        <Link
          href="/admin/priority-sla"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold">Priority / SLA Rules</h2>
          <p className="mt-1 text-sm text-slate-600">Response and completion targets by priority.</p>
        </Link>
        <Link
          href="/admin/approvals"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold">Approval Rules</h2>
          <p className="mt-1 text-sm text-slate-600">Request, high-cost, external repair, and overrides.</p>
        </Link>
        <Link
          href="/maintenance/job-codes"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold">Job Codes</h2>
          <p className="mt-1 text-sm text-slate-600">Reusable job code catalog and required parts.</p>
        </Link>
        <Link
          href="/admin/asset-masters"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold">Asset Domains</h2>
          <p className="mt-1 text-sm text-slate-600">Taxonomy domains that feed job-domain inference.</p>
        </Link>
        <Link
          href="/admin/integrations"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
        >
          <h2 className="font-semibold">Integrations</h2>
          <p className="mt-1 text-sm text-slate-600">ERP, email, SMS, storage, Redis readiness.</p>
        </Link>
      </div>
    </div>
  );
}
