export type ComplianceStatus = "CURRENT" | "DUE" | "GRACE" | "EXPIRED" | "UNKNOWN";

export function evaluateComplianceStatus(input: {
  expiresAt?: Date | null;
  now?: Date;
  gracePeriodDays?: number;
  reminderDays?: number;
}): ComplianceStatus {
  if (!input.expiresAt) {
    return "UNKNOWN";
  }
  const now = input.now ?? new Date();
  const grace = input.gracePeriodDays ?? 0;
  const reminder = input.reminderDays ?? 30;
  const expiresAt = input.expiresAt;
  const msDay = 24 * 60 * 60 * 1000;
  const graceEnd = new Date(expiresAt.getTime() + grace * msDay);
  const dueWindowStart = new Date(expiresAt.getTime() - reminder * msDay);

  if (now.getTime() > graceEnd.getTime()) {
    return "EXPIRED";
  }
  if (now.getTime() >= expiresAt.getTime()) {
    return grace > 0 ? "GRACE" : "EXPIRED";
  }
  if (now.getTime() >= dueWindowStart.getTime()) {
    return "DUE";
  }
  return "CURRENT";
}
