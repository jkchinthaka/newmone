"use client";

import Link from "next/link";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

const SECTIONS = [
  {
    href: "/admin/job-categories",
    title: "Job Domains & Categories",
    description: "MACHINERY, SERVICE, VEHICLE main/sub categories."
  },
  {
    href: "/admin/priority-sla",
    title: "Priority / SLA Rules",
    description: "Response and completion targets — drives live work-order deadlines."
  },
  {
    href: "/admin/fault-codes",
    title: "Fault / Cause / Remedy",
    description: "Failure library used on diagnosis and RCA."
  },
  {
    href: "/admin/reason-codes",
    title: "Hold / Delay Reasons",
    description: "Structured pause reasons with optional note enforcement."
  },
  {
    href: "/admin/config-history",
    title: "Configuration History",
    description: "Who changed what, when, with before/after versions."
  },
  {
    href: "/admin/checklist-templates",
    title: "Checklist Templates",
    description: "Versioned checklists with frozen snapshots on work orders."
  },
  {
    href: "/admin/maintenance-templates",
    title: "Maintenance Templates",
    description: "Reusable job templates with immutable WO snapshots."
  },
  {
    href: "/admin/feature-flags",
    title: "Feature Flags",
    description: "Tenant module switches for Machinery, Fleet, Safety, and more."
  },
  {
    href: "/admin/warranties",
    title: "Warranties & Claims",
    description: "Coverage records and recovery claim workflow."
  },
  {
    href: "/admin/approvals",
    title: "Approval Rules",
    description: "Request, high-cost, external repair, and overrides."
  },
  {
    href: "/maintenance/job-codes",
    title: "Job Codes",
    description: "Reusable job code catalog and required parts."
  },
  {
    href: "/admin/asset-masters",
    title: "Asset Domains",
    description: "Taxonomy domains that feed job-domain inference."
  },
  {
    href: "/admin/integrations",
    title: "Integrations",
    description: "ERP, email, SMS, storage, Redis readiness."
  }
] as const;

export default function AdminMaintenanceConfigPage() {
  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Maintenance Configuration" }]} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Maintenance Configuration</h1>
        <p className="mt-1 text-sm text-slate-600">
          Control center for job domains, categories, priorities, fault codes, and policy history.
          Operational changes here apply without code deployments.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300"
          >
            <h2 className="font-semibold">{section.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
