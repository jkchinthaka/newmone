/** Client checks for the meter reading field. The API repeats these rules. */

export function meterFractionDigits(unit: string | null | undefined, type?: string | null): number {
  const unitText = (unit ?? "").trim().toLowerCase();
  if (/(pulse|count|each|integer|unitless)/.test(unitText)) return 0;
  if (/(kwh|kw\b|m3|m³|litre|liter|gallon|cubic|therm)/.test(unitText)) return 3;
  const kind = (type ?? "").trim().toUpperCase();
  if (kind === "ELECTRICITY" || kind === "WATER" || kind === "GAS") return 3;
  return 0;
}

export function readingFieldError(raw: string, fractionDigits: number): string | null {
  const text = raw.trim();
  if (!text) return "Enter the meter reading.";
  if (fractionDigits > 0 && /^\d+\.$/.test(text)) return "Finish the decimal or remove the dot.";
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) {
    return "Enter a numeric reading of zero or greater. Letters and scientific notation are not allowed.";
  }
  const fraction = text.split(".")[1] ?? "";
  if (fraction.length > fractionDigits) {
    return fractionDigits === 0
      ? "This meter accepts whole numbers only."
      : `This meter accepts at most ${fractionDigits} decimal places.`;
  }
  return null;
}

export function readingAllowsFraction(fractionDigits: number) {
  return fractionDigits > 0;
}

/**
 * Accept a draft only when every character is a digit or one decimal point.
 * Invalid keystrokes and pastes stay out of the field so the value is never rewritten.
 */
export function acceptReadingDraft(
  current: string,
  incoming: string,
  fractionDigits: number
): { value: string; rejected: boolean } {
  if (incoming === "") return { value: "", rejected: false };
  const pattern = fractionDigits > 0 ? /^(?:0|[1-9]\d*)?(?:\.\d*)?$/ : /^(?:0|[1-9]\d*)?$/;
  if (!pattern.test(incoming)) return { value: current, rejected: true };
  const fraction = incoming.split(".")[1] ?? "";
  if (fraction.length > fractionDigits) return { value: current, rejected: true };
  return { value: incoming, rejected: false };
}

export function consumptionWarning(consumption: number | null, samples: readonly number[]): string | null {
  if (consumption == null || samples.length === 0) return null;
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  if (average > 0 && consumption > average * 3) {
    return `Consumption ${consumption} is more than three times the recent average of ${average}. Confirm the reading before leaving the meter.`;
  }
  return null;
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
