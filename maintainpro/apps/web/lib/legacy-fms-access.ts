/** Roles that may open the raw Legacy FMS Archive workspace (/home). */
export const LEGACY_FMS_ARCHIVE_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export type LegacyFmsArchiveRole = (typeof LEGACY_FMS_ARCHIVE_ROLES)[number];

export function canAccessLegacyFmsArchive(roleName: string | null | undefined): boolean {
  if (!roleName) {
    return false;
  }

  return LEGACY_FMS_ARCHIVE_ROLES.includes(roleName.trim().toUpperCase() as LegacyFmsArchiveRole);
}

export function isLegacyFmsArchiveNavItem(itemId: string): boolean {
  return itemId === "legacy-fms-archive";
}
