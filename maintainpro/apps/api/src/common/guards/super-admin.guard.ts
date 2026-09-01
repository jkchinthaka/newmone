import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";

/**
 * DB-authoritative SUPER_ADMIN gate. A JWT claiming SUPER_ADMIN is never
 * sufficient on its own — the actor's role, active flag, and lock state are
 * re-read from the database on every request. Mirrors the bulk-import
 * framework's BulkImportAuthService; used here for the Admin Console's
 * user/role/permission mutation endpoints.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { sub?: string } }>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException("Authentication is required");
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        lockedUntil: true,
        role: { select: { name: true } }
      }
    });

    if (!dbUser) {
      throw new UnauthorizedException("Authenticated user not found");
    }

    if (dbUser.isActive === false) {
      throw new UnauthorizedException("User account is disabled");
    }

    if (dbUser.lockedUntil && dbUser.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException("User account is temporarily locked");
    }

    if (dbUser.role.name !== RoleName.SUPER_ADMIN) {
      throw new ForbiddenException("This action is restricted to SUPER_ADMIN.");
    }

    return true;
  }
}
