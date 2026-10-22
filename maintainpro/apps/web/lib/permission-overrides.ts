export const PERMISSION_OVERRIDE_SCOPE_NOTE =
  "Overrides apply to permission-checked actions only; role-gated screens still follow the user's role.";

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
