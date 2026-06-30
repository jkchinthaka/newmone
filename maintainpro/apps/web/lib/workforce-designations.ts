/** Mirrors backend ASSIGNABLE_WORKFORCE_DESIGNATIONS for assignment UI filters. */
export const ASSIGNABLE_WORKFORCE_DESIGNATIONS = [
  "TECHNICIAN",
  "ELECTRICIAN",
  "MECHANIC",
  "WELDER",
  "HELPER",
  "SUPERVISOR",
  "CLEANER",
  "MAINTENANCE_STAFF"
] as const;

/**
 * Workforce employees are sourced from the Employee master (not login users directly).
 * Linked users still drive RBAC when canLogin is enabled.
 */
export const DESIGNATION_FALLBACK_NOTE =
  "Employees are loaded from the Workforce Employee master. Login-linked employees keep platform RBAC via their user account.";

const MANAGER_OVERRIDE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"]);

export const WORKFORCE_EMPLOYEE_MANAGER_ROLES = MANAGER_OVERRIDE_ROLES;

export function canManageWorkforceEmployees(role?: string | null): boolean {
  return Boolean(role && MANAGER_OVERRIDE_ROLES.has(role));
}

export function canOverrideLeaveConflict(role?: string | null): boolean {
  return Boolean(role && MANAGER_OVERRIDE_ROLES.has(role));
}

export function toDateTimeLocalValue(iso?: string | null): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dateTimeLocalToIso(value: string): string | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

export function formatEmployeeOptionLabel(input: {
  fullName: string;
  effectiveDesignation?: string | null;
  branchName?: string | null;
  departmentName?: string | null;
  availabilityLabel?: string | null;
  workloadPercentage?: number | null;
}): string {
  const designation = input.effectiveDesignation ?? "Unspecified";
  const location = [input.branchName, input.departmentName].filter(Boolean).join(" / ") || "—";
  const availability = input.availabilityLabel ?? "Available";
  const workload =
    typeof input.workloadPercentage === "number" ? `${input.workloadPercentage}% load` : "— load";
  return `${input.fullName} — ${designation} — ${location} — ${availability} — ${workload}`;
}
