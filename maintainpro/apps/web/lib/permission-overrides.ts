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
