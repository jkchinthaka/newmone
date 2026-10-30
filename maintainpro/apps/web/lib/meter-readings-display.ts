import { addCalendarDays, colomboDateTimeToIso, colomboNowTime, colomboTodayYmd } from "./colombo-datetime";
import { comparableConsumptions, consumptionWarning, readingFieldError } from "./meter-reading-input";

export const HIGH_USAGE_COPY =
  "This is more than 3× the usual use. Check the number on the meter. If it is correct, you can still save it.";

export type DisplayReading = {
  id?: string;
  meterId?: string;
  readingValue: number | string;
  readingDate: string;
  notes?: string | null;
  consumption?: number | string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Meter payloads do not include a normal range. Callers must hide that box. */
export function meterNormalRange(): null {
  return null;
}

/** Group the whole-number part for display. The stored draft stays free of commas. */
export function groupReading(raw: string): string {
  if (!raw) return "";
  const [whole, fraction] = raw.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export function displayUnit(unit?: string | null): string {
  const text = (unit ?? "").trim();
  if (/^m3$/i.test(text)) return "m³";
  return text;
}

export function formatMeterQuantity(value: number | string | null | undefined, unit?: string | null): string | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  const text = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0
  }).format(amount);
  const suffix = displayUnit(unit);
  return suffix ? `${text} ${suffix}` : text;
}

export function formatSignedUse(value: number, unit?: string | null): string | null {
  const body = formatMeterQuantity(value, unit);
  if (!body) return null;
  return value > 0 ? `+${body}` : body;
}

export function formatRecorded(iso: string, now = new Date()): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = colomboTodayYmd(date);
  const today = colomboTodayYmd(now);
  const time = colomboNowTime(date);
  if (day === today) return `Today ${time}`;
  if (day === addCalendarDays(today, -1)) return `Yesterday ${time}`;
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const label = `${dayOfMonth} ${MONTHS[month - 1]}`;
  return day.slice(0, 4) === today.slice(0, 4) ? `${label} ${time}` : `${label} ${year} ${time}`;
}

export function sinceLastLabel(iso: string, now = new Date()): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = colomboTodayYmd(date);
  const today = colomboTodayYmd(now);
  if (day > today) return null;
  if (day === today) return "Today";
  const start = Date.parse(`${day}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  const days = Math.round((end - start) / 86_400_000);
  if (!Number.isFinite(days) || days < 1) return null;
  return days === 1 ? "1 day" : `${days} days`;
}

export function readingTimeInFuture(value: string, now = new Date()): boolean {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > now.getTime();
}

export function savedReadingMessage(meterNumber: string, value: string, unit: string | null | undefined, readingAt: string, now = new Date()): string {
  const quantity = formatMeterQuantity(value, unit);
  const when = formatRecorded(readingAt, now);
  return [ `Reading saved for ${meterNumber}`, quantity, when ].filter(Boolean).join(" · ");
}

function finiteConsumption(row: DisplayReading): number | null {
  const amount = Number(row.consumption ?? NaN);
  return Number.isFinite(amount) ? amount : null;
}

function usageWindow(readingsNewestFirst: readonly DisplayReading[]): DisplayReading[] {
  const window: DisplayReading[] = [];
  for (const row of readingsNewestFirst) {
    if (String(row.notes ?? "").includes("[reset:")) break;
    window.push(row);
    if (window.length === 7) break;
  }
  return window;
}

/** Average daily use across the latest readings. Hidden when a span cannot be derived. */
export function averageDailyUse(readingsNewestFirst: readonly DisplayReading[]): number | null {
  const rows = usageWindow(readingsNewestFirst).filter((row) => {
    const amount = finiteConsumption(row);
    return amount != null && amount > 0 && !Number.isNaN(new Date(row.readingDate).getTime());
  });
  if (rows.length < 2) return null;
  const times = rows.map((row) => new Date(row.readingDate).getTime());
  const spanDays = (Math.max(...times) - Math.min(...times)) / 86_400_000;
  if (spanDays <= 0) return null;
  const sum = rows.reduce((total, row) => total + Number(row.consumption), 0);
  return sum / spanDays;
}

/** Last readings chart. Hidden until at least two real consumption points exist. */
export function lastSevenSpark(readingsNewestFirst: readonly DisplayReading[]): Array<{ value: number }> | null {
  const points: number[] = [];
  for (const row of usageWindow(readingsNewestFirst)) {
    const amount = finiteConsumption(row);
    if (amount == null) continue;
    points.push(amount);
  }
  if (points.length < 2) return null;
  return points.reverse().map((value) => ({ value }));
}

/** Intrinsic sparkline box. Hidden until two finite points can be drawn. */
export const SPARKLINE_WIDTH = 280;
export const SPARKLINE_HEIGHT = 40;

export function sparklineBox(
  points: readonly { value: number }[] | null | undefined,
  width = SPARKLINE_WIDTH,
  height = SPARKLINE_HEIGHT
): { width: number; height: number; points: string } | null {
  if (!points || points.length < 2 || !(width >= 2) || !(height >= 2)) return null;
  const values = points.map((point) => point.value).filter((value) => Number.isFinite(value));
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const padX = 1;
  const padY = 2;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;
  const drawn = values.map((value, index) => {
    const x = padX + (index / (values.length - 1)) * innerWidth;
    const y = padY + (1 - (value - min) / span) * innerHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return { width, height, points: drawn.join(" ") };
}

export function liveUsageWarning(consumption: number | null, samples: readonly number[]): string | null {
  return consumptionWarning(consumption, samples) ? HIGH_USAGE_COPY : null;
}

export function usagePreview(
  value: string,
  fractionDigits: number,
  last: DisplayReading | undefined,
  historyNewestFirst: readonly DisplayReading[]
): { consumption: number; warning: string | null } | null {
  if (!last || (value ? readingFieldError(value, fractionDigits) : "Enter the meter reading.")) return null;
  const next = Number(value);
  const previous = Number(last.readingValue);
  if (!Number.isFinite(next) || !Number.isFinite(previous) || next < previous) return null;
  const consumption = next - previous;
  return {
    consumption,
    warning: liveUsageWarning(consumption, comparableConsumptions(historyNewestFirst))
  };
}

/**
 * Inline warning before submit when the new value is below the last saved reading.
 * The API rejects a lower reading unless "meter reset or replaced" has a reason
 * (meter-reading-rules.ts), so the person should see it before pressing Save.
 */
export function lowerThanLastWarning(
  value: string,
  fractionDigits: number,
  last: DisplayReading | undefined,
  unit?: string | null
): string | null {
  if (!last || !value.trim() || readingFieldError(value, fractionDigits)) return null;
  const next = Number(value);
  const previous = Number(last.readingValue);
  if (!Number.isFinite(next) || !Number.isFinite(previous) || next >= previous) return null;
  const shown = formatMeterQuantity(previous, unit) ?? String(last.readingValue);
  return `Lower than last reading (${shown}). Was the meter replaced or reset?`;
}

/** "Now" for the reading time field, in Colombo time. Used on meter pick, Scan next, and after save. */
export function readingTimeNow(): string {
  return colomboDateTimeToIso(colomboTodayYmd(), colomboNowTime());
}

export function readingListStatus(reading: DisplayReading, meterReadingsNewestFirst: readonly DisplayReading[]): "SAVED" | "HIGH_USAGE" {
  const consumption = finiteConsumption(reading);
  if (consumption == null) return "SAVED";
  const readingTime = new Date(reading.readingDate).getTime();
  const older = meterReadingsNewestFirst.filter((row) => new Date(row.readingDate).getTime() < readingTime);
  return consumptionWarning(consumption, comparableConsumptions(older)) ? "HIGH_USAGE" : "SAVED";
}

export function myRecentReadings<T extends DisplayReading>(rows: readonly T[], userId: string, now = new Date()): T[] {
  if (!userId) return [];
  const cutoff = now.getTime() - 7 * 86_400_000;
  return rows.filter((row) => {
    if (!String(row.notes ?? "").includes(`[by:${userId}]`)) return false;
    const time = new Date(row.readingDate).getTime();
    return Number.isFinite(time) && time >= cutoff;
  });
}

export function latestByMeterId<T extends DisplayReading>(rows: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  const sorted = [...rows].sort((left, right) => new Date(right.readingDate).getTime() - new Date(left.readingDate).getTime());
  for (const row of sorted) {
    if (!row.meterId || map.has(row.meterId)) continue;
    map.set(row.meterId, row);
  }
  return map;
}

export function meterLine(description?: string | null, location?: string | null): string {
  return [description?.trim(), location?.trim()].filter(Boolean).join(" · ");
}
