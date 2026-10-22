export type SlaClock = "On track" | "At risk" | "Breached";

export type SlaRuleMinutes = {
  priority: string;
  responseMinutes?: number | null;
  completionMinutes?: number | null;
};

const DEFAULT_SLA_MINUTES: Record<string, { responseMinutes: number; completionMinutes: number }> = {
  CRITICAL: { responseMinutes: 30, completionMinutes: 4 * 60 },
  HIGH: { responseMinutes: 2 * 60, completionMinutes: 24 * 60 },
  MEDIUM: { responseMinutes: 8 * 60, completionMinutes: 72 * 60 },
  LOW: { responseMinutes: 24 * 60, completionMinutes: 7 * 24 * 60 }
};

/** Parse a Colombo wall time such as 2026-10-22T09:00:00. */
export function colomboDate(local: string): Date {
  return new Date(`${local}+05:30`);
}

export function slaMinutesForPriority(priority: string, rules: SlaRuleMinutes[] = []) {
  const key = priority.trim().toUpperCase();
  const rule = rules.find((item) => item.priority.trim().toUpperCase() === key);
  const fallback = DEFAULT_SLA_MINUTES[key] ?? DEFAULT_SLA_MINUTES.LOW;
  return {
    responseMinutes: rule?.responseMinutes ?? fallback.responseMinutes,
    completionMinutes: rule?.completionMinutes ?? fallback.completionMinutes
  };
}

export function slaClock(input: {
  createdAt: Date;
  stoppedAt?: Date | null;
  allowanceMinutes: number | null;
  now: Date;
}): SlaClock | null {
  if (input.allowanceMinutes == null || input.allowanceMinutes <= 0) return null;
  const deadline = input.createdAt.getTime() + input.allowanceMinutes * 60_000;
  if (input.stoppedAt) {
    return input.stoppedAt.getTime() <= deadline ? "On track" : "Breached";
  }
  const remaining = deadline - input.now.getTime();
  if (remaining < 0) return "Breached";
  if (remaining <= input.allowanceMinutes * 60_000 * 0.25) return "At risk";
  return "On track";
}

export function workOrderSla(input: {
  priority: string;
  createdAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  now: Date;
  rules?: SlaRuleMinutes[];
}) {
  const minutes = slaMinutesForPriority(input.priority, input.rules);
  return {
    respond: slaClock({
      createdAt: input.createdAt,
      stoppedAt: input.startedAt,
      allowanceMinutes: minutes.responseMinutes,
      now: input.now
    }),
    resolve: slaClock({
      createdAt: input.createdAt,
      stoppedAt: input.completedAt,
      allowanceMinutes: minutes.completionMinutes,
      now: input.now
    })
  };
}

const SLA_RANK: Record<SlaClock, number> = { "On track": 1, "At risk": 2, Breached: 3 };

export function worseSla(respond: SlaClock | null, resolve: SlaClock | null): SlaClock | null {
  const clocks = [respond, resolve].filter((clock): clock is SlaClock => Boolean(clock));
  if (!clocks.length) return null;
  return clocks.sort((left, right) => SLA_RANK[right] - SLA_RANK[left])[0];
}

function sumLine(values: Array<number | null>): number | null {
  if (!values.length) return null;
  let total = 0;
  for (const value of values) {
    if (value == null || Number.isNaN(value)) return null;
    total += value;
  }
  return Math.round(total * 100) / 100;
}

export function workOrderCost(input: {
  labour: Array<{ minutes?: number | null; rate?: number | null }>;
  parts: Array<{ quantity: number; unitCost?: number | null }>;
  vendorTotals: Array<number | null>;
}) {
  const labour = sumLine(input.labour.map((row) => (row.minutes == null || row.rate == null ? null : (row.minutes / 60) * row.rate)));
  const parts = sumLine(input.parts.map((row) => (row.unitCost == null ? null : row.quantity * row.unitCost)));
  const vendor = sumLine(input.vendorTotals);
  const known = [labour, parts, vendor].filter((value): value is number => value != null);
  return {
    labour,
    parts,
    vendor,
    total: known.length ? Math.round(known.reduce((sum, value) => sum + value, 0) * 100) / 100 : null
  };
}

export function assignmentLoadLabel(openJobs: number) {
  const tone = openJobs >= 3 ? "Busy" : "Available";
  const jobs = openJobs === 1 ? "1 job" : `${openJobs} jobs`;
  return `${tone} · ${jobs}`;
}
