export function removalReasonIsNew(createReason: string, removalReason: string): boolean {
  const next = removalReason.trim();
  return next.length > 0 && next !== createReason.trim();
}

/** DELETE body. permissionKey and reason stay out of the query string. */
export function permissionOverrideDeleteConfig(permissionKey: string, reason: string) {
  return {
    data: { permissionKey, reason }
  };
}

export function showPermissionOverridesCard(input: {
  role: string | null;
  accessStudioEnabled: boolean;
  editingUserId: string | null;
  currentUserId: string | null;
}): boolean {
  return (
    input.accessStudioEnabled === true &&
    input.role === "SUPER_ADMIN" &&
    typeof input.editingUserId === "string" &&
    input.editingUserId.length > 0 &&
    input.editingUserId !== input.currentUserId
  );
}
