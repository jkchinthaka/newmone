import { ForbiddenException } from "@nestjs/common";

/** Who may assign which role. The caller still has to be allowed to edit users. */
export function assertRoleAssignmentAllowed(input: {
  actorRole: string | null | undefined;
  actorId?: string | null;
  targetUserId?: string | null;
  currentRoleName?: string | null;
  nextRoleName: string;
}): void {
  const actorRole = input.actorRole ?? "";
  const next = input.nextRoleName;

  if (
    input.actorId &&
    input.targetUserId &&
    input.actorId === input.targetUserId &&
    input.currentRoleName &&
    input.currentRoleName !== next
  ) {
    throw new ForbiddenException("You cannot change your own role");
  }

  if (actorRole !== "SUPER_ADMIN" && next === "SUPER_ADMIN") {
    throw new ForbiddenException("Only a super admin can assign the super admin role");
  }

  if (actorRole !== "SUPER_ADMIN" && actorRole !== "ADMIN" && next === "ADMIN") {
    throw new ForbiddenException("Only an administrator can assign the admin role");
  }
}
