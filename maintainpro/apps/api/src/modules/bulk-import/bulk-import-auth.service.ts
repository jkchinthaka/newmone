import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";

/**
 * DB-authoritative SUPER_ADMIN gate for the bulk import framework.
 *
 * A JWT claiming SUPER_ADMIN is not sufficient on its own: the actor's role,
 * active flag and lock state are re-read from the database on every preview
 * AND commit call. This mirrors PermissionsGuard.loadDbUser() (see
 * common/guards/permissions.guard.ts) rather than the cheaper
 * requestContext.actorRole shortcut used elsewhere — bulk import can create
 * or mutate many records at once, so a stale/forged token must never pass.
 */
@Injectable()
export class BulkImportAuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertSuperAdmin(userId: string | undefined): Promise<void> {
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
      throw new ForbiddenException("Bulk import is restricted to SUPER_ADMIN.");
    }
  }
}
