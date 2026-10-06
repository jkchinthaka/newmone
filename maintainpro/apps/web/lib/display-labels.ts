/**
 * Central mapping from internal enum / status codes to user-facing business language.
 */

const ENUM_LABELS: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  INSUFFICIENT_DATA: "Insufficient data",
  UNAVAILABLE: "Unavailable",
  COMPLETE: "Complete",
  DEGRADED: "Degraded",
  NOT_ASSESSED: "Not assessed",
  ATTENTION_REQUIRED: "Attention required",
  NON_COMPLIANT: "Non-compliant",
  COMPLIANT: "Compliant",
  PENDING_VERIFICATION: "Pending verification",
  EXPIRING_SOON: "Expiring soon",
  TECHNICIAN_COMPLETED: "Technician completed",
  REWORK_REQUIRED: "Rework required",
  OUT_OF_STOCK: "Out of stock",
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  WAITING_PARTS: "Waiting for parts",
  PENDING_APPROVAL: "Pending approval",
  ACCIDENT_REPAIR: "Accident repair",
  NOT_REQUIRED: "Not required"
};

/**
 * Single-word enum codes that are safe to humanize in reports (OPEN -> Open). Codes with
 * an underscore are always enum codes. Other all-caps words (currency LKR, tags) are left as is.
 */
const KNOWN_SINGLE_WORD_CODES = new Set([
  "OPEN", "PLANNED", "ASSIGNED", "COMPLETED", "VERIFIED", "CLOSED", "CANCELLED", "OVERDUE",
  "LOW", "MEDIUM", "HIGH", "CRITICAL", "ELIGIBLE", "INELIGIBLE", "ANOMALOUS", "NORMAL",
  "PENDING", "APPROVED", "REJECTED", "ACTIVE", "INACTIVE", "DRAFT", "AVAILABLE", "RETIRED",
  "CORRECTIVE", "PREVENTIVE", "EMERGENCY", "INSPECTION", "INSTALLATION", "EQUIPMENT",
  "MACHINE", "MACHINERY", "VEHICLE", "FACILITY", "OTHER", "SUBMITTED", "RECEIVED", "PAID",
  "DISABLED", "DEGRADED", "OPERATIONAL", "FAILED", "UPLOADED", "MISSING", "BREAKDOWN",
  "MAINTENANCE", "OPERATIONS", "SUSPENDED", "SCRAPPED", "MANAGER", "ADMIN", "TECHNICIAN",
  "VIEWER", "DRIVER", "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"
]);

/** True when a raw value is an internal enum code that must not be shown verbatim. */
export function isEnumCode(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(trimmed)) return false;
  return trimmed.includes("_") || KNOWN_SINGLE_WORD_CODES.has(trimmed) || Boolean(ENUM_LABELS[trimmed]);
}

/** Humanize a value only when it is an enum code; leave names, tags and IDs untouched. */
export function formatDisplayValue(value: string): string {
  return isEnumCode(value) ? formatEnumLabel(value) : value;
}

/** Map enum option codes to {id, label} for selects: value stays the raw code. */
export function toEnumOptions(values: readonly string[] | null | undefined): Array<{ id: string; label: string }> {
  return (values ?? []).map((value) => ({ id: value, label: formatDisplayValue(value) }));
}

/** Turn SCREAMING_SNAKE or camelCase codes into readable labels. */
export function formatEnumLabel(value: string | null | undefined, fallback = "—"): string {
  if (!value?.trim()) return fallback;
  const normalized = value.trim();
  if (ENUM_LABELS[normalized]) return ENUM_LABELS[normalized];
  if (/^[A-Z0-9_]+$/.test(normalized)) {
    return normalized
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ");
  }
  return normalized;
}

export function formatCoverageStatus(value: string | null | undefined): string {
  return formatEnumLabel(value, "Unknown");
}

/** Rewrites known developer-facing report coverage notes into business language. */
export function formatReportCoverageNote(note: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/persisted as SecurityEvent records?/gi, "recorded in the security audit log"],
    [/SecurityEvent/g, "security audit log"],
    [/INSUFFICIENT_DATA \(value null\)/gi, "insufficient historical data (shown as unavailable)"],
    [/INSUFFICIENT_DATA/g, "insufficient data"],
    [/coverage status/gi, "data availability status"]
  ];

  let output = note;
  for (const [pattern, replacement] of replacements) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

export function formatRequiredChecksAttention(count: number): string {
  const noun = count === 1 ? "required dependency check needs" : "required dependency checks need";
  return `${count} ${noun} attention.`;
}
