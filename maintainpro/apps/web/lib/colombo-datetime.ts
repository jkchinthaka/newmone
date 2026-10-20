export const COLOMBO_TIME_ZONE = "Asia/Colombo";
const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTH_INDEX: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
};

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return calendarDateExists(year, month, day);
}

function calendarDateExists(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatCalendarDate(value: string) {
  if (!isCalendarDate(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`;
}

/** Accepts 16/10/2026, 16-10-2026, 2026-10-16 and 16 Oct 2026. */
export function parseTypedDate(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  let year = 0;
  let month = 0;
  let day = 0;
  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const named = text.match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/);
  if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
    year = Number(numeric[3]);
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (named) {
    day = Number(named[1]);
    month = MONTH_INDEX[named[2].toLowerCase()] ?? 0;
    year = Number(named[3]);
  } else {
    return null;
  }
  if (!calendarDateExists(year, month, day)) return null;
  return ymd(year, month, day);
}

export function formatClock(hours: number, minutes: number) {
  const meridiem = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

export function parseTypedTime(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, " ");
  const withMeridiem = text.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  const plain = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!withMeridiem && !plain) return null;
  const minutes = Number((withMeridiem ?? plain)![2]);
  if (minutes < 0 || minutes > 59) return null;
  let hours = Number((withMeridiem ?? plain)![1]);
  if (withMeridiem) {
    const meridiem = withMeridiem[3].toUpperCase();
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM") hours = hours === 12 ? 0 : hours;
    if (meridiem === "PM") hours = hours === 12 ? 12 : hours + 12;
  } else if (hours < 0 || hours > 23) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function quarterHourOptions() {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) options.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return options;
}

export function colomboTodayYmd(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function colomboNowTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${read("hour")}:${read("minute")}`;
}

export function colomboDateTimeToIso(date: string, time: string) {
  if (!isCalendarDate(date) || !/^\d{2}:\d{2}$/.test(time)) return "";
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes) - COLOMBO_OFFSET_MS).toISOString();
}

export function isoToColomboParts(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return { date: colomboTodayYmd(date), time: colomboNowTime(date) };
}

export function formatColomboDateTime(iso: string) {
  const parts = isoToColomboParts(iso);
  if (!parts) return "";
  const [hours, minutes] = parts.time.split(":").map(Number);
  return `${formatCalendarDate(parts.date)} ${formatClock(hours, minutes)}`;
}

export function addCalendarDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return ymd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addCalendarMonths(value: string, months: number) {
  const [year, month, day] = value.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return ymd(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(day, last));
}

export function weekBound(value: string, end: boolean) {
  const [year, month, day] = value.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  return addCalendarDays(value, end ? 6 - mondayOffset : -mondayOffset);
}

export function calendarKeyTarget(value: string, key: string) {
  if (key === "ArrowLeft") return addCalendarDays(value, -1);
  if (key === "ArrowRight") return addCalendarDays(value, 1);
  if (key === "ArrowUp") return addCalendarDays(value, -7);
  if (key === "ArrowDown") return addCalendarDays(value, 7);
  if (key === "PageUp") return addCalendarMonths(value, -1);
  if (key === "PageDown") return addCalendarMonths(value, 1);
  if (key === "Home") return weekBound(value, false);
  if (key === "End") return weekBound(value, true);
  if (key === "Enter") return "select" as const;
  if (key === "Escape") return "close" as const;
  return null;
}

export function calendarMonthGrid(year: number, monthIndex: number) {
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const leading = (firstWeekday + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: Array<{ day: number | null; value: string }> = [];
  for (let index = 0; index < leading; index += 1) cells.push({ day: null, value: "" });
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ day, value: ymd(year, monthIndex + 1, day) });
  return cells;
}

export function monthLabel(year: number, monthIndex: number) {
  return `${MONTHS[monthIndex]} ${year}`;
}

export function dateOutsideRange(value: string, minDate?: string, maxDate?: string) {
  if (minDate && value < minDate) return true;
  if (maxDate && value > maxDate) return true;
  return false;
}
