import { allow, deny, firstDenial, type PolicyDecision } from "./policy-decision";

export type MeterPolicyInput = {
  previous?: number | null;
  next?: number | null;
  now?: Date;
  recordedAt?: Date | null;
  maxFutureDays?: number;
};

export type PmAdvanceInput = {
  intervalDays?: number | null;
  intervalMileage?: number | null;
  intervalHours?: number | null;
  policy?: "ACTUAL_COMPLETION" | "FIXED_SCHEDULE" | string | null;
};

export function canMeterReadingAdvance(input: MeterPolicyInput): PolicyDecision {
  const next = input.next;
  if (next == null || !Number.isFinite(Number(next))) {
    return deny("METER_NEGATIVE", { next });
  }
  if (Number(next) < 0) {
    return deny("METER_NEGATIVE", { next });
  }
  if (input.previous != null && Number.isFinite(Number(input.previous)) && Number(next) < Number(input.previous)) {
    return deny("METER_ROLLBACK", { previous: input.previous, next }, "HIGH");
  }
  const recordedAt = input.recordedAt ?? input.now ?? new Date();
  const now = input.now ?? new Date();
  const maxFutureDays = input.maxFutureDays ?? 1;
  if (recordedAt.getTime() - now.getTime() > maxFutureDays * 24 * 60 * 60 * 1000) {
    return deny("METER_FUTURE_IMPOSSIBLE", { recordedAt: recordedAt.toISOString() });
  }
  return allow();
}

export function canMaintenanceScheduleAdvance(input: PmAdvanceInput): PolicyDecision {
  const hasInterval =
    (input.intervalDays != null && input.intervalDays > 0) ||
    (input.intervalMileage != null && input.intervalMileage > 0) ||
    (input.intervalHours != null && input.intervalHours > 0);
  if (!hasInterval) {
    return deny("PM_INTERVAL_INVALID", {
      intervalDays: input.intervalDays ?? null,
      intervalMileage: input.intervalMileage ?? null,
      intervalHours: input.intervalHours ?? null
    });
  }
  const policy = input.policy ?? "ACTUAL_COMPLETION";
  if (policy !== "ACTUAL_COMPLETION" && policy !== "FIXED_SCHEDULE") {
    return deny("PM_NEXT_DUE_INVALID", { policy });
  }
  return allow();
}

export function nextPreventiveDue(input: {
  policy?: "ACTUAL_COMPLETION" | "FIXED_SCHEDULE" | string | null;
  completedAt: Date;
  completedMileage?: number | null;
  completedHours?: number | null;
  previousDueDate?: Date | null;
  previousDueMileage?: number | null;
  previousDueHours?: number | null;
  intervalDays?: number | null;
  intervalMileage?: number | null;
  intervalHours?: number | null;
}): PolicyDecision & {
  nextDueDate?: Date | null;
  nextDueMileage?: number | null;
  nextDueHours?: number | null;
} {
  const scheduleOk = canMaintenanceScheduleAdvance(input);
  if (!scheduleOk.allowed) {
    return scheduleOk;
  }

  const policy = input.policy === "FIXED_SCHEDULE" ? "FIXED_SCHEDULE" : "ACTUAL_COMPLETION";
  const baseDate = policy === "FIXED_SCHEDULE" && input.previousDueDate ? input.previousDueDate : input.completedAt;
  const baseMileage =
    policy === "FIXED_SCHEDULE" && input.previousDueMileage != null
      ? Number(input.previousDueMileage)
      : input.completedMileage != null
        ? Number(input.completedMileage)
        : null;
  const baseHours =
    policy === "FIXED_SCHEDULE" && input.previousDueHours != null
      ? Number(input.previousDueHours)
      : input.completedHours != null
        ? Number(input.completedHours)
        : null;

  const nextDueDate =
    input.intervalDays && input.intervalDays > 0
      ? new Date(baseDate.getTime() + input.intervalDays * 24 * 60 * 60 * 1000)
      : null;
  const nextDueMileage =
    input.intervalMileage && input.intervalMileage > 0 && baseMileage != null
      ? baseMileage + input.intervalMileage
      : null;
  const nextDueHours =
    input.intervalHours && input.intervalHours > 0 && baseHours != null ? baseHours + input.intervalHours : null;

  if (!nextDueDate && nextDueMileage == null && nextDueHours == null) {
    return deny("PM_NEXT_DUE_INVALID", { policy });
  }
  if (nextDueDate && nextDueDate.getTime() <= input.completedAt.getTime() && policy === "ACTUAL_COMPLETION") {
    return deny("PM_NEXT_DUE_INVALID", { policy, nextDueDate: nextDueDate.toISOString() });
  }

  return {
    ...allow("PM_ADVANCED", { policy }),
    nextDueDate,
    nextDueMileage,
    nextDueHours
  };
}

export function forecastServiceDue(input: {
  currentMileage?: number | null;
  nextDueMileage?: number | null;
  nextDueDate?: Date | null;
  avgKmPerDay?: number | null;
  sampleDays?: number | null;
}): {
  coverage: "COMPLETE" | "INSUFFICIENT_DATA";
  estimatedDueDate: Date | null;
  remainingKm: number | null;
  remainingDays: number | null;
  avgKmPerDay: number | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
} {
  const current = Number(input.currentMileage);
  const dueMileage = Number(input.nextDueMileage);
  const avg = Number(input.avgKmPerDay);
  const hasMileagePath = Number.isFinite(current) && Number.isFinite(dueMileage) && dueMileage > current;
  const hasRate = Number.isFinite(avg) && avg > 0 && Number(input.sampleDays ?? 0) >= 7;

  if (hasMileagePath && hasRate) {
    const remainingKm = dueMileage - current;
    const remainingDays = remainingKm / avg;
    return {
      coverage: "COMPLETE",
      estimatedDueDate: new Date(Date.now() + remainingDays * 24 * 60 * 60 * 1000),
      remainingKm,
      remainingDays,
      avgKmPerDay: avg,
      confidence: Number(input.sampleDays) >= 21 ? "HIGH" : "MEDIUM"
    };
  }

  if (input.nextDueDate) {
    return {
      coverage: "COMPLETE",
      estimatedDueDate: input.nextDueDate,
      remainingKm: hasMileagePath ? dueMileage - current : null,
      remainingDays: (input.nextDueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      avgKmPerDay: hasRate ? avg : null,
      confidence: hasMileagePath ? "MEDIUM" : "LOW"
    };
  }

  return {
    coverage: "INSUFFICIENT_DATA",
    estimatedDueDate: null,
    remainingKm: hasMileagePath ? dueMileage - current : null,
    remainingDays: null,
    avgKmPerDay: hasRate ? avg : null,
    confidence: "NONE"
  };
}
