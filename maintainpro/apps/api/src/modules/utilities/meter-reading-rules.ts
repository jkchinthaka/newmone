export const METER_READING_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "ASSET_MANAGER",
  "SUPERVISOR",
  "TECHNICIAN",
  "MECHANIC"
] as const;

export type MeterReadingInput = {
  value: number;
  readingAt: Date;
  now: Date;
  previousValue?: number | null;
  recentConsumptions?: number[];
  resetReason?: string | null;
};

export type MeterReadingDecision =
  | { ok: true; consumption: number | null; warning: string | null; reset: boolean }
  | { ok: false; message: string };

/** Continuous utility units may record up to three decimal places. Count-style units stay whole numbers. */
export function meterFractionDigits(unit: string | null | undefined, type?: string | null): number {
  const unitText = (unit ?? "").trim().toLowerCase();
  if (/(pulse|count|each|integer|unitless)/.test(unitText)) return 0;
  if (/(kwh|kw\b|m3|m³|litre|liter|gallon|cubic|therm)/.test(unitText)) return 3;
  const kind = (type ?? "").trim().toUpperCase();
  if (kind === "ELECTRICITY" || kind === "WATER" || kind === "GAS") return 3;
  return 0;
}

/**
 * Accept only a finite nonnegative decimal. Reject partial parses (`12abc`),
 * scientific notation, signs, and values finer than the meter allows.
 */
export function parseStrictReadingValue(
  raw: unknown,
  fractionDigits: number
): { ok: true; value: number; text: string } | { ok: false; message: string } {
  const message = "Enter a numeric reading of zero or greater. Letters and scientific notation are not allowed.";
  let text: string;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return { ok: false, message };
    text = String(raw);
    if (/e/i.test(text)) return { ok: false, message };
  } else if (typeof raw === "string") {
    text = raw.trim();
  } else {
    return { ok: false, message };
  }

  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) {
    return { ok: false, message };
  }
  const fraction = text.split(".")[1] ?? "";
  if (fraction.length > fractionDigits) {
    return {
      ok: false,
      message:
        fractionDigits === 0
          ? "This meter accepts whole numbers only."
          : `This meter accepts at most ${fractionDigits} decimal places.`
    };
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return { ok: false, message };
  return { ok: true, value, text };
}

export function comparableConsumptions(
  rows: readonly { notes?: string | null; consumption?: number | string | null }[]
): number[] {
  const samples: number[] = [];
  for (const row of rows) {
    if (String(row.notes ?? "").includes("[reset:")) break;
    const consumption = Number(row.consumption ?? NaN);
    if (Number.isFinite(consumption) && consumption > 0) samples.push(consumption);
    if (samples.length === 5) break;
  }
  return samples;
}

export function evaluateMeterReading(input: MeterReadingInput): MeterReadingDecision {
  if (!Number.isFinite(input.value) || input.value < 0) {
    return { ok: false, message: "Reading value must be a number greater than or equal to 0." };
  }
  if (Number.isNaN(input.readingAt.getTime())) {
    return { ok: false, message: "Reading time is required." };
  }
  if (input.readingAt.getTime() > input.now.getTime()) {
    return { ok: false, message: "Reading time cannot be in the future." };
  }

  const previous = input.previousValue;
  const resetReason = input.resetReason?.trim() ?? "";
  const hasPrevious = previous != null && Number.isFinite(previous);
  if (hasPrevious && input.value < Number(previous) && resetReason.length < 3) {
    return {
      ok: false,
      message: "Reading is lower than the previous reading. Select meter reset or replacement and enter a reason."
    };
  }

  const reset = hasPrevious && input.value < Number(previous);
  const consumption = !hasPrevious || reset ? null : input.value - Number(previous);
  const samples = (input.recentConsumptions ?? []).filter((value) => Number.isFinite(value) && value > 0).slice(0, 5);
  let warning: string | null = null;
  if (consumption != null && samples.length > 0) {
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    if (average > 0 && consumption > average * 3) {
      warning = `Consumption ${consumption} is more than three times the recent average of ${average}. Confirm the reading before leaving the meter.`;
    }
  }

  return { ok: true, consumption, warning, reset };
}
