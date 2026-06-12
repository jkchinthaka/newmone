export const DEFAULT_LOCALE = "en-LK";
export const DEFAULT_TIME_ZONE = "Asia/Colombo";
export const DEFAULT_CURRENCY = "LKR";
export const EMPTY_DISPLAY = "—";

export type LocalizableValue = string | number | Date | null | undefined;

export type LocalizationOptions = {
  locale?: string;
  timeZone?: string;
  fallback?: string;
};

type DateFormatOptions = LocalizationOptions &
  Pick<Intl.DateTimeFormatOptions, "dateStyle" | "month" | "day" | "year">;

type TimeFormatOptions = LocalizationOptions &
  Pick<Intl.DateTimeFormatOptions, "timeStyle" | "hour" | "minute" | "second">;

type DateTimeFormatOptions = LocalizationOptions &
  Pick<
    Intl.DateTimeFormatOptions,
    "dateStyle" | "timeStyle" | "month" | "day" | "year" | "hour" | "minute"
  >;

type CurrencyFormatOptions = LocalizationOptions &
  Pick<Intl.NumberFormatOptions, "minimumFractionDigits" | "maximumFractionDigits">;

type NumberFormatOptions = LocalizationOptions &
  Pick<Intl.NumberFormatOptions, "minimumFractionDigits" | "maximumFractionDigits">;

type PercentFormatOptions = LocalizationOptions &
  Pick<Intl.NumberFormatOptions, "minimumFractionDigits" | "maximumFractionDigits">;

function resolveOptions(options?: LocalizationOptions) {
  return {
    locale: options?.locale ?? DEFAULT_LOCALE,
    timeZone: options?.timeZone ?? DEFAULT_TIME_ZONE,
    fallback: options?.fallback ?? EMPTY_DISPLAY
  };
}

export function parseLocalizableDate(value: LocalizableValue): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function coerceLocalizableNumber(value: LocalizableValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function formatDate(value: LocalizableValue, options?: DateFormatOptions): string {
  const { locale, timeZone, fallback } = resolveOptions(options);
  const date = parseLocalizableDate(value);

  if (!date) {
    return fallback;
  }

  const { fallback: _fallback, locale: _locale, timeZone: _timeZone, ...intlOptions } = options ?? {};

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone,
    ...intlOptions
  }).format(date);
}

export function formatTime(value: LocalizableValue, options?: TimeFormatOptions): string {
  const { locale, timeZone, fallback } = resolveOptions(options);
  const date = parseLocalizableDate(value);

  if (!date) {
    return fallback;
  }

  const { fallback: _fallback, locale: _locale, timeZone: _timeZone, ...intlOptions } = options ?? {};

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    ...intlOptions
  }).format(date);
}

export function formatDateTime(value: LocalizableValue, options?: DateTimeFormatOptions): string {
  const { locale, timeZone, fallback } = resolveOptions(options);
  const date = parseLocalizableDate(value);

  if (!date) {
    return fallback;
  }

  const { fallback: _fallback, locale: _locale, timeZone: _timeZone, ...intlOptions } = options ?? {};

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    ...intlOptions
  }).format(date);
}

export function formatCurrency(value: LocalizableValue, options?: CurrencyFormatOptions): string {
  const { locale, fallback } = resolveOptions(options);
  const numeric = coerceLocalizableNumber(value);

  if (numeric === null) {
    return fallback;
  }

  const {
    fallback: _fallback,
    locale: _locale,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    ...rest
  } = options ?? {};

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: DEFAULT_CURRENCY,
    minimumFractionDigits,
    maximumFractionDigits,
    ...rest
  }).format(numeric);
}

export function formatNumber(value: LocalizableValue, options?: NumberFormatOptions): string {
  const { locale, fallback } = resolveOptions(options);
  const numeric = coerceLocalizableNumber(value);

  if (numeric === null) {
    return fallback;
  }

  const {
    fallback: _fallback,
    locale: _locale,
    minimumFractionDigits,
    maximumFractionDigits,
    ...rest
  } = options ?? {};

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
    ...rest
  }).format(numeric);
}

export function formatPercent(value: LocalizableValue, options?: PercentFormatOptions): string {
  const { locale, fallback } = resolveOptions(options);
  const numeric = coerceLocalizableNumber(value);

  if (numeric === null) {
    return fallback;
  }

  const {
    fallback: _fallback,
    locale: _locale,
    minimumFractionDigits = 1,
    maximumFractionDigits = 1,
    ...rest
  } = options ?? {};

  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits,
    maximumFractionDigits,
    ...rest
  }).format(numeric / 100);
}

export function formatRelativeDateLabel(
  value: LocalizableValue,
  options?: LocalizationOptions
): string {
  const resolved = resolveOptions(options);
  const date = parseLocalizableDate(value);

  if (!date) {
    return resolved.fallback;
  }

  const startOfDay = (input: Date) =>
    new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();

  const diffDays = Math.round((startOfDay(date) - startOfDay(new Date())) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Tomorrow";
  }

  if (diffDays === -1) {
    return "Yesterday";
  }

  if (diffDays > 1 && diffDays <= 7) {
    return `In ${diffDays} days`;
  }

  if (diffDays < -1 && diffDays >= -7) {
    return `${Math.abs(diffDays)} days ago`;
  }

  return formatDate(value, options);
}
