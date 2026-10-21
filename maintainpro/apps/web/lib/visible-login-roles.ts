export const VISIBLE_LOGIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "TECHNICIAN",
  "SECURITY_OFFICER",
  "INVENTORY_KEEPER"
] as const;

const ALLOWED = new Set<string>(VISIBLE_LOGIN_ROLES);

/** Create and edit dropdowns list these six roles. A saved legacy role stays visible so edit does not wipe it. */
export function visibleLoginRoles<T extends { id: string; name: string }>(roles: T[], currentRoleId?: string): T[] {
  return roles.filter((role) => ALLOWED.has(role.name) || role.id === currentRoleId);
}
