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
 * When User.designation is blank, the API resolves an effective designation from role name.
 * See apps/api/src/common/utils/workforce-designation.ts (roleNameToDesignationFallback).
 */
export const DESIGNATION_FALLBACK_NOTE =
  "Employees without an explicit designation use their platform role label for filtering (e.g. TECHNICIAN role → TECHNICIAN designation).";

const MANAGER_OVERRIDE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"]);

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
  firstName: string;
  lastName: string;
  effectiveDesignation?: string | null;
  availabilityLabel?: string | null;
  workloadPercentage?: number | null;
}): string {
  const name = `${input.firstName} ${input.lastName}`.trim();
  const designation = input.effectiveDesignation ?? "Unspecified";
  const availability = input.availabilityLabel ?? "Available";
  const workload =
    typeof input.workloadPercentage === "number" ? `${input.workloadPercentage}% load` : "— load";
  return `${name} — ${designation} — ${availability} — ${workload}`;
}
