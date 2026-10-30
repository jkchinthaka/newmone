type TriggerInterval = { kind: string; intervalDays?: number | null; intervalValue?: number | null };

const DAY_MS = 24 * 60 * 60 * 1000;

function shortest(values: Array<number | null | undefined>): number | null {
  const positive = values.filter((value): value is number => typeof value === "number" && value > 0);
  return positive.length ? Math.min(...positive) : null;
}

/**
 * First calendar due date for a new plan: one interval after it takes effect.
 * Without it the trigger engine measured from "now" on every run and the plan never came due.
 */
export function initialPmNextDueAt(effectiveFrom: Date, triggers: TriggerInterval[] | undefined): Date | null {
  const days = shortest((triggers ?? []).filter((t) => t.kind === "CALENDAR").map((t) => t.intervalDays));
  return days == null ? null : new Date(effectiveFrom.getTime() + days * DAY_MS);
}

/**
 * Baseline after a PM work order closes. Calendar plans move the due date forward from the close;
 * meter plans move the threshold forward from the reading taken at completion, so the same reading
 * does not create another work order the next day.
 */
export function pmBaselineAfterClose(input: {
  closedAt: Date;
  triggers: TriggerInterval[];
  completionReading?: number | null;
  isVehicle: boolean;
  /** Threshold the plan was using (stored, or last completion + interval). Used when no reading was captured. */
  previousThreshold?: number | null;
}) {
  const days = shortest(input.triggers.filter((t) => t.kind === "CALENDAR").map((t) => t.intervalDays));
  const meterInterval = shortest(input.triggers.filter((t) => t.kind === "METER").map((t) => t.intervalValue));
  const reading =
    typeof input.completionReading === "number" && Number.isFinite(input.completionReading)
      ? input.completionReading
      : null;
  return {
    lastCompletionAt: input.closedAt,
    ...(days != null ? { nextDueAt: new Date(input.closedAt.getTime() + days * DAY_MS) } : {}),
    ...(reading != null
      ? {
          ...(input.isVehicle ? { lastCompletionMileage: reading } : { lastCompletionHours: reading }),
          ...(meterInterval != null ? { nextDueMeterValue: reading + meterInterval } : {})
        }
      : meterInterval != null && typeof input.previousThreshold === "number"
        ? { nextDueMeterValue: input.previousThreshold + meterInterval }
        : {})
  };
}
