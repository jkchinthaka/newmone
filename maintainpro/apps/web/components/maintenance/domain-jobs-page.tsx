"use client";

import WorkOrdersPage from "@/components/work-orders/work-orders-page";
import { JOB_DOMAIN_LABELS, type JobDomain } from "@/lib/job-domain";

type DomainJobsPageProps = {
  jobDomain?: JobDomain;
  title?: string;
  description?: string;
};

/**
 * Thin domain lane over the unified Work Orders engine.
 * Does not duplicate lifecycle, costing, or assignment logic.
 */
export function DomainJobsPage({ jobDomain, title, description }: DomainJobsPageProps) {
  const heading =
    title ?? (jobDomain ? `${JOB_DOMAIN_LABELS[jobDomain]} Jobs` : "All Jobs");
  const sub =
    description ??
    (jobDomain
      ? `Unified work orders filtered to the ${JOB_DOMAIN_LABELS[jobDomain]} domain.`
      : "All executable maintenance jobs across machinery, service, and vehicle domains.");

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Maintenance
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{heading}</h1>
        <p className="mt-1 text-sm text-slate-600">{sub}</p>
      </div>
      <WorkOrdersPage jobDomain={jobDomain} />
    </div>
  );
}

export default DomainJobsPage;
