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
  const heading = title ?? (jobDomain ? `${JOB_DOMAIN_LABELS[jobDomain]} Jobs` : "Jobs");
  const sub =
    description ??
    (jobDomain === "MACHINERY"
      ? "Only jobs created with the Machinery category (machines and equipment)."
      : jobDomain === "SERVICE"
        ? "Only jobs created with the Service category (buildings, facilities and places)."
        : jobDomain === "VEHICLE"
          ? "Only jobs created with the Vehicle category."
          : "All maintenance jobs across machinery, vehicles and services.");

  return (
    <WorkOrdersPage jobDomain={jobDomain} heading={heading} description={sub} />
  );
}

export default DomainJobsPage;
