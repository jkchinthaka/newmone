/**
 * Generic PM trigger evaluation engine.
 * Supports CALENDAR | METER | EXPIRY | CONDITION | EVENT,
 * combined with EARLIEST (OR / whichever first) or ALL (AND).
 */

export type TriggerKind = "CALENDAR" | "METER" | "EXPIRY" | "CONDITION" | "EVENT";
export type CombineMode = "EARLIEST" | "ALL";

export type TriggerDefinition = {
  id: string;
  kind: TriggerKind;
  combineGroup?: number;
  intervalDays?: number | null;
  intervalValue?: number | null;
  referenceKey?: string | null;
  isActive?: boolean;
};

export type TriggerContext = {
  now?: Date;
  /** Last completion / baseline for calendar intervals */
  lastCompletionAt?: Date | null;
  /** Explicit next due date if already computed */
  nextDueAt?: Date | null;
  gracePeriodDays?: number;
  /** Current meter reading for METER triggers */
  currentMeterValue?: number | null;
  /** Baseline meter at last completion */
  lastCompletionMeter?: number | null;
  /** Explicit next due meter */
  nextDueMeterValue?: number | null;
  /** Expiry date for EXPIRY triggers */
  expiresAt?: Date | null;
  /** CONDITION / EVENT flags from external evaluators */
  conditionMet?: boolean;
  eventFired?: boolean;
};

export type SingleTriggerResult = {
  triggerId: string;
  kind: TriggerKind;
  due: boolean;
  inGrace: boolean;
  dueAt: Date | null;
  reason: string;
  metadata?: Record<string, unknown>;
};

export type CombinedTriggerResult = {
  due: boolean;
  inGrace: boolean;
  combineMode: CombineMode;
  dueAt: Date | null;
  winningTriggerId: string | null;
  results: SingleTriggerResult[];
  summary: string;
};

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export function evaluateCalendarTrigger(
  trigger: TriggerDefinition,
  ctx: TriggerContext
): SingleTriggerResult {
  const now = ctx.now ?? new Date();
  const grace = ctx.gracePeriodDays ?? 0;
  let dueAt = ctx.nextDueAt ?? null;
  if (!dueAt && trigger.intervalDays && trigger.intervalDays > 0) {
    const baseline = ctx.lastCompletionAt ?? now;
    dueAt = addDays(baseline, trigger.intervalDays);
  }
  if (!dueAt) {
    return {
      triggerId: trigger.id,
      kind: "CALENDAR",
      due: false,
      inGrace: false,
      dueAt: null,
      reason: "CALENDAR_NO_DUE_DATE"
    };
  }
  const graceEnd = addDays(dueAt, grace);
  const due = now.getTime() >= dueAt.getTime();
  const inGrace = due && grace > 0 && now.getTime() <= graceEnd.getTime();
  return {
    triggerId: trigger.id,
    kind: "CALENDAR",
    due,
    inGrace,
    dueAt,
    reason: due ? (inGrace ? "CALENDAR_IN_GRACE" : "CALENDAR_DUE") : "CALENDAR_NOT_DUE",
    metadata: { gracePeriodDays: grace }
  };
}

export function evaluateMeterTrigger(
  trigger: TriggerDefinition,
  ctx: TriggerContext
): SingleTriggerResult {
  const current = ctx.currentMeterValue;
  let threshold = ctx.nextDueMeterValue ?? null;
  if (threshold == null && trigger.intervalValue && trigger.intervalValue > 0) {
    const baseline = ctx.lastCompletionMeter ?? 0;
    threshold = baseline + trigger.intervalValue;
  }
  if (current == null || threshold == null) {
    return {
      triggerId: trigger.id,
      kind: "METER",
      due: false,
      inGrace: false,
      dueAt: null,
      reason: "METER_INSUFFICIENT_DATA",
      metadata: { current, threshold }
    };
  }
  const due = Number(current) >= Number(threshold);
  return {
    triggerId: trigger.id,
    kind: "METER",
    due,
    inGrace: false,
    dueAt: due ? ctx.now ?? new Date() : null,
    reason: due ? "METER_DUE" : "METER_NOT_DUE",
    metadata: { current, threshold, intervalValue: trigger.intervalValue ?? null }
  };
}

export function evaluateExpiryTrigger(
  trigger: TriggerDefinition,
  ctx: TriggerContext
): SingleTriggerResult {
  const now = ctx.now ?? new Date();
  const expiresAt = ctx.expiresAt;
  const grace = ctx.gracePeriodDays ?? 0;
  if (!expiresAt) {
    return {
      triggerId: trigger.id,
      kind: "EXPIRY",
      due: false,
      inGrace: false,
      dueAt: null,
      reason: "EXPIRY_NO_DATE",
      metadata: { referenceKey: trigger.referenceKey ?? null }
    };
  }
  const graceEnd = addDays(expiresAt, grace);
  const due = now.getTime() >= expiresAt.getTime();
  const inGrace = due && grace > 0 && now.getTime() <= graceEnd.getTime();
  return {
    triggerId: trigger.id,
    kind: "EXPIRY",
    due,
    inGrace,
    dueAt: expiresAt,
    reason: due
      ? now.getTime() > graceEnd.getTime()
        ? "EXPIRY_EXPIRED"
        : "EXPIRY_IN_GRACE"
      : "EXPIRY_CURRENT",
    metadata: { referenceKey: trigger.referenceKey ?? null, gracePeriodDays: grace }
  };
}

export function evaluateConditionTrigger(
  trigger: TriggerDefinition,
  ctx: TriggerContext
): SingleTriggerResult {
  const due = Boolean(ctx.conditionMet);
  return {
    triggerId: trigger.id,
    kind: "CONDITION",
    due,
    inGrace: false,
    dueAt: due ? ctx.now ?? new Date() : null,
    reason: due ? "CONDITION_MET" : "CONDITION_NOT_MET",
    metadata: { referenceKey: trigger.referenceKey ?? null }
  };
}

export function evaluateEventTrigger(
  trigger: TriggerDefinition,
  ctx: TriggerContext
): SingleTriggerResult {
  const due = Boolean(ctx.eventFired);
  return {
    triggerId: trigger.id,
    kind: "EVENT",
    due,
    inGrace: false,
    dueAt: due ? ctx.now ?? new Date() : null,
    reason: due ? "EVENT_FIRED" : "EVENT_NOT_FIRED",
    metadata: { referenceKey: trigger.referenceKey ?? null }
  };
}

export function evaluateSingleTrigger(
  trigger: TriggerDefinition,
  ctx: TriggerContext
): SingleTriggerResult {
  if (trigger.isActive === false) {
    return {
      triggerId: trigger.id,
      kind: trigger.kind,
      due: false,
      inGrace: false,
      dueAt: null,
      reason: "TRIGGER_INACTIVE"
    };
  }
  switch (trigger.kind) {
    case "CALENDAR":
      return evaluateCalendarTrigger(trigger, ctx);
    case "METER":
      return evaluateMeterTrigger(trigger, ctx);
    case "EXPIRY":
      return evaluateExpiryTrigger(trigger, ctx);
    case "CONDITION":
      return evaluateConditionTrigger(trigger, ctx);
    case "EVENT":
      return evaluateEventTrigger(trigger, ctx);
    default:
      return {
        triggerId: trigger.id,
        kind: trigger.kind,
        due: false,
        inGrace: false,
        dueAt: null,
        reason: "UNKNOWN_TRIGGER_KIND"
      };
  }
}

/**
 * Combined evaluation: EARLIEST = due when any trigger is due (whichever first);
 * ALL = due only when every active trigger is due.
 * Example: 500 hours OR 3 months -> EARLIEST with METER + CALENDAR.
 */
export function evaluateCombinedTriggers(
  triggers: TriggerDefinition[],
  ctx: TriggerContext,
  combineMode: CombineMode = "EARLIEST"
): CombinedTriggerResult {
  const active = triggers.filter((t) => t.isActive !== false);
  const results = active.map((t) => evaluateSingleTrigger(t, ctx));

  if (results.length === 0) {
    return {
      due: false,
      inGrace: false,
      combineMode,
      dueAt: null,
      winningTriggerId: null,
      results,
      summary: "NO_ACTIVE_TRIGGERS"
    };
  }

  if (combineMode === "ALL") {
    const due = results.every((r) => r.due);
    const inGrace = due && results.every((r) => r.inGrace || r.due);
    const dueDates = results.map((r) => r.dueAt).filter((d): d is Date => !!d);
    const dueAt =
      dueDates.length > 0
        ? new Date(Math.max(...dueDates.map((d) => d.getTime())))
        : null;
    return {
      due,
      inGrace: due && results.some((r) => r.inGrace),
      combineMode,
      dueAt,
      winningTriggerId: due ? results[results.length - 1]?.triggerId ?? null : null,
      results,
      summary: due ? "ALL_TRIGGERS_DUE" : "WAITING_FOR_ALL_TRIGGERS"
    };
  }

  // EARLIEST - whichever comes first
  const dueOnes = results.filter((r) => r.due);
  if (dueOnes.length === 0) {
    const upcoming = results
      .filter((r) => r.dueAt)
      .sort((a, b) => (a.dueAt!.getTime() - b.dueAt!.getTime()));
    return {
      due: false,
      inGrace: false,
      combineMode,
      dueAt: upcoming[0]?.dueAt ?? null,
      winningTriggerId: upcoming[0]?.triggerId ?? null,
      results,
      summary: "NOT_DUE"
    };
  }

  const sorted = [...dueOnes].sort((a, b) => {
    const at = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bt = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    return at - bt;
  });
  const winner = sorted[0];
  return {
    due: true,
    inGrace: winner.inGrace,
    combineMode,
    dueAt: winner.dueAt,
    winningTriggerId: winner.triggerId,
    results,
    summary: `EARLIEST_DUE:${winner.kind}:${winner.reason}`
  };
}

/** Stable generation key for duplicate auto-WO prevention within a due window. */
export function buildPmGenerationKey(planId: string, dueAt: Date | null, now = new Date()): string {
  const anchor = dueAt ?? now;
  const day = anchor.toISOString().slice(0, 10);
  return `${planId}:${day}`;
}
