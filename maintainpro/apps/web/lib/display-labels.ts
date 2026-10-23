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
  // One name per work-order status (same words on chips, pills, and filters).
  TECHNICIAN_COMPLETED: "Awaiting verification",
  REWORK_REQUIRED: "Sent back for rework",
  WAITING_PARTS: "Waiting for parts",
  VERIFIED: "Verified",
  CLOSED: "Closed"
};

/**
 * Work-order status names shown to users. Keep one name per status everywhere.
 * TECHNICIAN_COMPLETED = "Awaiting verification", REWORK_REQUIRED = "Sent back for rework".
 */
export const WORK_ORDER_STATUS_LABELS: Readonly<Record<string, string>> = {
  OPEN: "Open",
  PLANNED: "Planned",
  APPROVED: "Approved",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  WAITING_PARTS: "Waiting for parts",
  TECHNICIAN_COMPLETED: "Awaiting verification",
  REWORK_REQUIRED: "Sent back for rework",
  VERIFIED: "Verified",
  CLOSED: "Closed",
  COMPLETED: "Closed",
  CANCELLED: "Cancelled",
  OVERDUE: "Overdue"
};

export function workOrderStatusLabel(value: string | null | undefined, fallback = "—"): string {
  if (!value?.trim()) return fallback;
  const key = value.trim().toUpperCase();
  return WORK_ORDER_STATUS_LABELS[key] ?? formatEnumLabel(value, fallback);
}

export const PRIORITY_LABELS: Readonly<Record<string, string>> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
  URGENT: "Urgent",
  EMERGENCY: "Emergency"
};

export function priorityLabel(value: string | null | undefined, fallback = "—"): string {
  if (!value?.trim()) return fallback;
  return PRIORITY_LABELS[value.trim().toUpperCase()] ?? formatEnumLabel(value, fallback);
}

/** Vehicle availability as gate and fleet staff say it. */
export const VEHICLE_STATUS_LABELS: Readonly<Record<string, string>> = {
  AVAILABLE: "Available",
  IN_USE: "In use",
  UNDER_MAINTENANCE: "In workshop",
  OUT_OF_SERVICE: "Out of service",
  DISPOSED: "Disposed"
};

export function vehicleStatusLabel(value: string | null | undefined, fallback = "—"): string {
  if (!value?.trim()) return fallback;
  return VEHICLE_STATUS_LABELS[value.trim().toUpperCase()] ?? formatEnumLabel(value, fallback);
}

/** Part request states as stores staff say them. */
export const PART_REQUEST_STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING_OPERATIONAL: "Waiting for approval",
  PENDING_FINANCE: "Waiting for finance",
  APPROVED: "Ready to issue",
  PARTIALLY_ISSUED: "Part issued",
  ISSUED: "Issued",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled"
};

export function partRequestStatusLabel(value: string | null | undefined, fallback = "—"): string {
  if (!value?.trim()) return fallback;
  return PART_REQUEST_STATUS_LABELS[value.trim().toUpperCase()] ?? formatEnumLabel(value, fallback);
}

/** Gate movement codes (OUT / IN, ALLOWED / BLOCKED / OVERRIDE_APPROVED). */
export const GATE_MOVEMENT_LABELS: Readonly<Record<string, string>> = {
  OUT: "Gate out",
  IN: "Gate in",
  ALLOWED: "Allowed",
  BLOCKED: "Blocked",
  OVERRIDE_APPROVED: "Released by manager"
};

export function gateMovementLabel(value: string | null | undefined, fallback = "—"): string {
  if (!value?.trim()) return fallback;
  return GATE_MOVEMENT_LABELS[value.trim().toUpperCase()] ?? formatEnumLabel(value, fallback);
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
