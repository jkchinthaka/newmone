"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Route } from "next";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { taxRateInputIsValid } from "@/lib/vendor-tax";

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
    href: "/admin/reliability",
    title: "Reliability & Safety Policy",
    description: "Repeat failure, asset criticality, RCA/CAPA, permit start gates."
  },
  {
    href: "/admin/work-permits",
    title: "Permit-to-Work",
    description: "Issue and approve permits required before critical work starts."
  },
  {
    href: "/admin/condition-monitoring",
    title: "Condition Monitoring",
    description: "CBM threshold rules and open breach events."
  },
  {
    href: "/admin/approval-rules",
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
        <h1 className="page-title">Maintenance Configuration</h1>
        <p className="mt-1 text-sm text-slate-600">
          Control center for job domains, categories, priorities, fault codes, and policy history.
          Operational changes here apply without code deployments.
        </p>
      </div>
      <DefaultTaxRateSetting />
      <div className="grid gap-3 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href as Route}
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

function DefaultTaxRateSetting() {
  const [rate, setRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiClient
      .get<{ data: { defaultTaxRatePercent: number | null; name: string } }>("/admin/maintenance-config/tax-rate")
      .then((response) => {
        const stored = response.data.data.defaultTaxRatePercent;
        setRate(stored == null ? "" : String(stored));
      })
      .catch((error) => {
        toast.error(getApiErrorMessage(error, "Unable to load the default tax rate."));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!taxRateInputIsValid(rate)) {
          toast.error("Default tax rate must be from 0 to 100 with at most 2 decimals.");
          return;
        }
        setSaving(true);
        void apiClient
          .patch("/admin/maintenance-config/tax-rate", { defaultTaxRatePercent: Number(rate) })
          .then(() => toast.success("Default tax rate saved."))
          .catch((error) => toast.error(getApiErrorMessage(error, "Unable to save the default tax rate.")))
          .finally(() => setSaving(false));
      }}
    >
      <h2 className="font-semibold">Default tax rate %</h2>
      <p className="mt-1 text-sm text-slate-600">
        Used as the suggested VAT rate on vendor quotations and invoices. Each document can still use a different rate.
      </p>
      <label className="mt-3 flex max-w-xs items-center gap-2 text-sm">
        <input
          inputMode="decimal"
          value={loading ? "" : rate}
          onChange={(event) => setRate(event.target.value)}
          aria-label="Default tax rate %"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          disabled={loading || saving}
        />
        <span>%</span>
      </label>
      <button
        type="submit"
        disabled={loading || saving}
        className="mt-3 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Save default tax rate
      </button>
    </form>
  );
}
