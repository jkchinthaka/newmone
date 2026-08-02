import { BadRequestException } from "@nestjs/common";

import { MAX_REPORT_RANGE_DAYS, REPORTING_TIMEZONE } from "./report-currency.util";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export interface BusinessDateRange {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  reportingTimezone: typeof REPORTING_TIMEZONE;
}

function assertDateOnly(value: string, field: string) {
  if (!DATE_ONLY.test(value)) {
    throw new BadRequestException(`${field} must be an ISO date-only value (YYYY-MM-DD).`);
  }
}

/** Convert Asia/Colombo calendar date to UTC Date at start/end of business day. */
export function businessDayBound(dateOnly: string, bound: "start" | "end"): Date {
  assertDateOnly(dateOnly, bound === "start" ? "startDate" : "endDate");
  const suffix = bound === "start" ? "T00:00:00.000+05:30" : "T23:59:59.999+05:30";
  const parsed = new Date(`${dateOnly}${suffix}`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid ${bound === "start" ? "startDate" : "endDate"}.`);
  }
  return parsed;
}

export function resolveBusinessDateRange(query: { startDate?: string; endDate?: string }): BusinessDateRange {
  const endDate =
    query.endDate?.trim() ||
    new Intl.DateTimeFormat("en-CA", { timeZone: REPORTING_TIMEZONE }).format(new Date());
  let startDate = query.startDate?.trim();
  if (!startDate) {
    const end = businessDayBound(endDate, "end");
    const startMs = end.getTime() - 29 * 86_400_000;
    startDate = new Intl.DateTimeFormat("en-CA", { timeZone: REPORTING_TIMEZONE }).format(new Date(startMs));
  }

  assertDateOnly(startDate, "startDate");
  assertDateOnly(endDate, "endDate");

  const start = businessDayBound(startDate, "start");
  const end = businessDayBound(endDate, "end");

  if (start > end) {
    throw new BadRequestException("startDate must be before or equal to endDate.");
  }

  const spanDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
  if (spanDays > MAX_REPORT_RANGE_DAYS) {
    throw new BadRequestException(`Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days.`);
  }

  return { start, end, startDate, endDate, reportingTimezone: REPORTING_TIMEZONE };
}

export function colomboMonthKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORTING_TIMEZONE,
    year: "numeric",
    month: "2-digit"
  })
    .format(date)
    .slice(0, 7);
}
