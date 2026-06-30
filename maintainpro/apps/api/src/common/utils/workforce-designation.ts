import { RoleName } from "@prisma/client";

/**
 * Canonical workforce designations used for assignment filtering (UAT-007).
 * User.designation is the primary filter; when missing, roleNameToDesignationFallback() applies.
 */
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

export type AssignableWorkforceDesignation = (typeof ASSIGNABLE_WORKFORCE_DESIGNATIONS)[number];

/** Roles that may appear in the workforce assignment employee picker. */
export const ASSIGNABLE_WORKFORCE_ROLE_NAMES: RoleName[] = [
  RoleName.TECHNICIAN,
  RoleName.MECHANIC,
  RoleName.ASSET_MANAGER,
  RoleName.INVENTORY_KEEPER,
  RoleName.SUPERVISOR,
  RoleName.CLEANER,
  RoleName.SECURITY_OFFICER,
  RoleName.FACILITY_MANAGER,
  RoleName.BUILDING_SUPERVISOR,
  RoleName.FARM_WORKER,
  RoleName.IRRIGATION_OPERATOR,
  RoleName.HARVEST_CREW
];

/**
 * Fallback when User.designation is null/blank: map platform role to a workforce designation label.
 * Used only for display and designation-filter matching — not for RBAC.
 */
export function roleNameToDesignationFallback(roleName?: string | null): string | null {
  if (!roleName) {
    return null;
  }

  switch (roleName) {
    case RoleName.TECHNICIAN:
      return "TECHNICIAN";
    case RoleName.MECHANIC:
      return "MECHANIC";
    case RoleName.ASSET_MANAGER:
    case RoleName.BUILDING_SUPERVISOR:
    case RoleName.FIELD_SUPERVISOR:
    case RoleName.SUPERVISOR:
      return "SUPERVISOR";
    case RoleName.INVENTORY_KEEPER:
      return "HELPER";
    case RoleName.CLEANER:
      return "CLEANER";
    case RoleName.SECURITY_OFFICER:
    case RoleName.FACILITY_MANAGER:
      return "MAINTENANCE_STAFF";
    case RoleName.FARM_WORKER:
    case RoleName.IRRIGATION_OPERATOR:
    case RoleName.HARVEST_CREW:
      return "HELPER";
    default:
      return null;
  }
}

export function resolveEffectiveDesignation(input: {
  designation?: string | null;
  roleName?: string | null;
}): string | null {
  const explicit = input.designation?.trim();
  if (explicit) {
    return explicit;
  }

  return roleNameToDesignationFallback(input.roleName);
}

export function matchesWorkforceDesignation(
  input: { designation?: string | null; roleName?: string | null },
  designationFilter?: string | null
): boolean {
  if (!designationFilter?.trim()) {
    return true;
  }

  const effective = resolveEffectiveDesignation(input);
  if (!effective) {
    return false;
  }

  return effective.toLowerCase() === designationFilter.trim().toLowerCase();
}

export function isAssignableWorkforceDesignation(value?: string | null): boolean {
  if (!value?.trim()) {
    return false;
  }

  return ASSIGNABLE_WORKFORCE_DESIGNATIONS.some(
    (entry) => entry.toLowerCase() === value.trim().toLowerCase()
  );
}
