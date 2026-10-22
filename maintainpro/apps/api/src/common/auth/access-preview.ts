import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { accessStudioEnabled } from "./effective-permissions";
import type { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../../modules/auth/auth.types";

export const ACCESS_PREVIEW_HEADER = "x-access-preview-user";

export function previewUserId(headers: Record<string, unknown>): string | null {
  const value = headers[ACCESS_PREVIEW_HEADER];
  if (value === undefined) return null;
  if (typeof value !== "string" || !value.trim() || value.length > 128) {
    throw new ForbiddenException("Invalid preview user");
  }
  return value.trim();
}

export async function resolvePreviewIdentity(
  prisma: PrismaService,
  headers: Record<string, unknown>,
  actor: JwtPayload
): Promise<JwtPayload> {
  const targetId = previewUserId(headers);
  if (!targetId) return actor;
  if (!accessStudioEnabled()) throw new ForbiddenException("Preview is unavailable. Exit preview to continue.");
  // A current database role is supplied by JwtStrategy, never a JWT role alone.
  if (actor.role !== "SUPER_ADMIN") throw new ForbiddenException("Only a super admin can preview a user");
  const activeTenant = typeof headers["x-tenant-id"] === "string" ? headers["x-tenant-id"] : actor.tenantId;
  if (!activeTenant) throw new ForbiddenException("Active tenant is required for preview");
  const target = await prisma.user.findFirst({
    where: { id: targetId, tenantId: activeTenant, isActive: true },
    select: { id: true, email: true, tenantId: true, lockedUntil: true, role: { select: { name: true } } }
  });
  if (!target) throw new NotFoundException("Preview user not found");
  if (target.role.name === "SUPER_ADMIN" || (target.lockedUntil && target.lockedUntil > new Date())) {
    throw new ForbiddenException("Choose an active non-super-admin user for preview");
  }
  return { sub: target.id, email: target.email, role: target.role.name, tenantId: target.tenantId };
}
