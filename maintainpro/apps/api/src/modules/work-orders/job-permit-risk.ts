/**
 * Job-level safety flags that need a work permit before start, for any job category
 * (machinery, vehicle or service). Machine criticality is checked separately by the
 * reliability policy.
 */
const NO_PERMIT_VALUES = new Set(["NONE", "NO", "N/A", "NA", "NOT REQUIRED", "NOT_REQUIRED", "-"]);

export function jobPermitRiskReasons(job: {
  hotWorkRequired?: boolean | null;
  confinedSpace?: boolean | null;
  workingAtHeight?: boolean | null;
  electricalIsolation?: boolean | null;
  permitReference?: string | null;
}): string[] {
  const reasons: string[] = [];
  if (job.hotWorkRequired) reasons.push("Hot work");
  if (job.confinedSpace) reasons.push("Confined space work");
  if (job.workingAtHeight) reasons.push("Work at height");
  if (job.electricalIsolation) reasons.push("Electrical isolation");
  const permit = job.permitReference?.trim() ?? "";
  if (reasons.length === 0 && permit && !NO_PERMIT_VALUES.has(permit.toUpperCase())) {
    reasons.push(`Permit requirement "${permit}"`);
  }
  return reasons;
}
