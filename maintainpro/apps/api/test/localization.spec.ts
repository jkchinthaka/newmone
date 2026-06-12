import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  EMPTY_DISPLAY,
  coerceLocalizableNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeDateLabel,
  formatTime,
  parseLocalizableDate
} from "../../web/lib/localization";

describe("localization helpers", () => {
  it("uses Sri Lanka defaults for locale, timezone, and currency", () => {
    expect(DEFAULT_LOCALE).toBe("en-LK");
    expect(DEFAULT_TIME_ZONE).toBe("Asia/Colombo");
    expect(DEFAULT_CURRENCY).toBe("LKR");
  });

  it("formats dates with en-LK defaults", () => {
    const formatted = formatDate("2026-06-12T10:30:00.000Z");
    expect(formatted).toMatch(/2026/);
    expect(formatted).not.toBe(EMPTY_DISPLAY);
  });

  it("formats currency as LKR", () => {
    const formatted = formatCurrency(125000.5);
    expect(formatted).toContain("125");
    expect(formatted.toLowerCase()).toMatch(/lkr|rs/);
  });

  it("returns fallback for invalid or empty values", () => {
    expect(formatDate(null)).toBe(EMPTY_DISPLAY);
    expect(formatDate("not-a-date")).toBe(EMPTY_DISPLAY);
    expect(formatCurrency(undefined)).toBe(EMPTY_DISPLAY);
    expect(formatNumber("")).toBe(EMPTY_DISPLAY);
    expect(formatPercent("invalid")).toBe(EMPTY_DISPLAY);
  });

  it("formats numbers and percentages safely", () => {
    expect(formatNumber(12345.678, { maximumFractionDigits: 2 })).toMatch(/12/);
    expect(formatPercent(42.5)).toMatch(/42\.5%/);
  });

  it("formats time and datetime without crashing", () => {
    expect(formatTime("2026-06-12T10:30:00.000Z")).not.toBe(EMPTY_DISPLAY);
    expect(formatDateTime("2026-06-12T10:30:00.000Z")).not.toBe(EMPTY_DISPLAY);
  });

  it("parses supported localizable inputs", () => {
    expect(parseLocalizableDate("2026-01-15")?.getFullYear()).toBe(2026);
    expect(parseLocalizableDate(new Date("2026-01-15T00:00:00.000Z"))).toBeInstanceOf(Date);
    expect(coerceLocalizableNumber("42.5")).toBe(42.5);
    expect(coerceLocalizableNumber("abc")).toBeNull();
  });

  it("formats relative labels for nearby dates", () => {
    const today = new Date();
    expect(formatRelativeDateLabel(today)).toBe("Today");

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    expect(formatRelativeDateLabel(tomorrow)).toBe("Tomorrow");
  });

  it("respects custom fallback values", () => {
    expect(formatDate(null, { fallback: "N/A" })).toBe("N/A");
    expect(formatCurrency(null, { fallback: "N/A" })).toBe("N/A");
  });
});
