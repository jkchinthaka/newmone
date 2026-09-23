/**
 * Server-authoritative cost derivation for work order completion.
 * Components that are not yet modeled contribute 0 — never invent fake values.
 */
export function deriveActualCost(components: {
  partsCost?: number | null;
  labourCost?: number | null;
  vendorCost?: number | null;
  miscellaneousCost?: number | null;
}): number {
  const parts = Number(components.partsCost ?? 0) || 0;
  const labour = Number(components.labourCost ?? 0) || 0;
  const vendor = Number(components.vendorCost ?? 0) || 0;
  const misc = Number(components.miscellaneousCost ?? 0) || 0;
  const total = parts + labour + vendor + misc;
  return Math.round(total * 100) / 100;
}

export function labourCostFromHours(hours: number, ratePerHour?: number | null): number {
  const rate = ratePerHour != null && Number.isFinite(ratePerHour) ? Number(ratePerHour) : 0;
  return Math.round(hours * rate * 100) / 100;
}
