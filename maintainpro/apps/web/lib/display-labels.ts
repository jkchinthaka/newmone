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
  EXPIRING_SOON: "Expiring soon"
};

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
