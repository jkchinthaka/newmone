/**
 * First-class maintenance job domains (mirrors API job-domain.util).
 */
export const JOB_DOMAINS = ["MACHINERY", "SERVICE", "VEHICLE"] as const;
export type JobDomain = (typeof JOB_DOMAINS)[number];

export const JOB_DOMAIN_LABELS: Record<JobDomain, string> = {
  MACHINERY: "Machinery",
  SERVICE: "Service",
  VEHICLE: "Vehicle"
};

export function parseJobDomain(value: unknown): JobDomain | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  return (JOB_DOMAINS as readonly string[]).includes(normalized)
    ? (normalized as JobDomain)
    : undefined;
}

export function jobDomainLabel(value: string | null | undefined): string {
  const parsed = parseJobDomain(value);
  return parsed ? JOB_DOMAIN_LABELS[parsed] : value?.trim() || "—";
}
