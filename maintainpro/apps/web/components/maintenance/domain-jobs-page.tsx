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
  const heading = title ?? (jobDomain ? `${JOB_DOMAIN_LABELS[jobDomain]} Jobs` : "Work Orders");
  const sub =
    description ??
    (jobDomain === "MACHINERY"
      ? "Machinery jobs. Scan the machine, status, and next action."
      : jobDomain === "SERVICE"
        ? "Service jobs by location and service type."
        : jobDomain === "VEHICLE"
          ? "Vehicle jobs with registration and odometer."
          : "All executable maintenance jobs across machinery, service, and vehicle domains.");

  return (
    <WorkOrdersPage jobDomain={jobDomain} heading={heading} description={sub} />
  );
}

export default DomainJobsPage;
