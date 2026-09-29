/**
 * Operational maintenance cost rollup.
 * Amounts are integer cents. Display currency is LKR unless a line carries another currency,
 * in which case that currency is kept separate and not converted.
 * Parts actual = issued quantity minus returned quantity, times the stored unit cost.
 * Labour uses the historical labourRateSnapshot. A missing rate is unvalued, not zero.
 * External actual is a finance-approved or paid vendor invoice total. Purchase orders are excluded.
 * Period inclusion uses Asia/Colombo calendar dates on issuedAt, labour endedAt, and financeApprovedAt.
 */

export const MAINTENANCE_COST_TIMEZONE = "Asia/Colombo";

export type MoneyCents = number;

export function toCents(amount: string | number | null | undefined): MoneyCents | null {
  if (amount == null || amount === "") return null;
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function centsToAmount(cents: MoneyCents) {
  const sign = cents < 0 ? -1 : 1;
  const abs = Math.abs(cents);
  return (sign * Math.trunc(abs / 100)) + (sign * (abs % 100)) / 100;
}

export type PartsLine = {
  id: string;
  issuedQuantity: number;
  returnedQuantity: number;
  unitCost: string | number | null;
  issuedAt?: Date | string | null;
};

export type LabourLine = {
  id: string;
  durationMinutes: number | null;
  labourRateSnapshot: string | number | null;
  endedAt?: Date | string | null;
};

export type ServiceLine = {
  id: string;
  status: string;
  totalAmount: string | number | null;
  currency?: string | null;
  financeApprovedAt?: Date | string | null;
};

export type PurchaseCommitment = {
  id: string;
  totalAmount: string | number | null;
};

function lastById<T extends { id: string }>(rows: T[]) {
  const seen = new Map<string, T>();
  for (const row of rows) seen.set(row.id, row);
  return [...seen.values()];
}

export function rollupMaintenanceCost(input: {
  parts: PartsLine[];
  labour: LabourLine[];
  services: ServiceLine[];
  commitments?: PurchaseCommitment[];
}) {
  let partsCents = 0;
  let labourCents = 0;
  let serviceCents = 0;
  const currencies = new Set<string>();
  const unvalued: string[] = [];

  for (const line of lastById(input.parts)) {
    const qty = line.issuedQuantity - line.returnedQuantity;
    const unit = toCents(line.unitCost);
    if (qty === 0) continue;
    if (unit == null) {
      unvalued.push(`parts:${line.id}`);
      continue;
    }
    partsCents += qty * unit;
  }
  for (const line of lastById(input.labour)) {
    const minutes = line.durationMinutes ?? 0;
    if (minutes <= 0) continue;
    const rate = toCents(line.labourRateSnapshot);
    if (rate == null) {
      unvalued.push(`labour:${line.id}`);
      continue;
    }
    labourCents += Math.round((minutes * rate) / 60);
  }
  for (const line of lastById(input.services)) {
    if (line.status !== "APPROVED" && line.status !== "PAID") continue;
    const amount = toCents(line.totalAmount);
    const currency = (line.currency || "LKR").toUpperCase();
    currencies.add(currency);
    if (currency !== "LKR") {
      unvalued.push(`currency:${line.id}`);
      continue;
    }
    if (amount == null) {
      unvalued.push(`service:${line.id}`);
      continue;
    }
    serviceCents += amount;
  }
  const actualCents = partsCents + labourCents + serviceCents;
  return {
    partsCents,
    labourCents,
    serviceCents,
    actualCents,
    parts: centsToAmount(partsCents),
    labour: centsToAmount(labourCents),
    services: centsToAmount(serviceCents),
    actual: centsToAmount(actualCents),
    commitmentExcluded: (input.commitments ?? []).length,
    unvalued,
    complete: unvalued.length === 0,
    currency: "LKR",
    taxBasis: "Stored invoice totalAmount; tax is not added again."
  };
}

export function varianceAgainstEstimate(actualCents: MoneyCents, estimate: string | number | null | undefined, jobOpen: boolean) {
  const estimateCents = toCents(estimate);
  if (estimateCents == null) {
    return { amount: null, percent: null, label: "N/A", explanation: "No approved estimate is recorded.", completeComparison: false };
  }
  if (estimateCents <= 0) {
    return { amount: centsToAmount(actualCents - estimateCents), percent: null, label: "N/A", explanation: "Variance percentage needs a positive estimate.", completeComparison: true };
  }
  const amountCents = actualCents - estimateCents;
  const percent = Math.round((amountCents / estimateCents) * 10000) / 100;
  return {
    amount: centsToAmount(amountCents),
    percent,
    label: jobOpen ? "Currently above estimate" : amountCents > 0 ? "Above estimate" : "Within estimate",
    explanation: "Lifetime recognized cost compared with the stored estimate.",
    completeComparison: true
  };
}

export function spreadsheetCell(value: string | number | null) {
  const text = value == null ? "" : String(value);
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function inBusinessDateRange(value: Date | string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= start.getTime() && time <= end.getTime();
}
