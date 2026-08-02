export const REPORTING_CURRENCY_CODE = "LKR" as const;
export const REPORTING_LOCALE = "en-LK" as const;
export const REPORTING_TIMEZONE = "Asia/Colombo" as const;
export const LKR_FRACTION_DIGITS = 2;
export const MAX_REPORT_RANGE_DAYS = 366;
export const MAX_EXPORT_ROWS = 5000;

const formatter = new Intl.NumberFormat(REPORTING_LOCALE, {
  style: "currency",
  currency: REPORTING_CURRENCY_CODE,
  maximumFractionDigits: LKR_FRACTION_DIGITS,
  minimumFractionDigits: LKR_FRACTION_DIGITS
});

export function formatReportCurrency(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return formatter.format(amount);
}

export function normalizeMonetaryAmount(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export function monetaryMetadata() {
  return {
    currencyCode: REPORTING_CURRENCY_CODE,
    locale: REPORTING_LOCALE,
    reportingTimezone: REPORTING_TIMEZONE,
    fractionDigits: LKR_FRACTION_DIGITS
  };
}
