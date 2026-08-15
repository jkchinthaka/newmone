import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PrismaService } from "../../database/prisma.service";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

type RequestUser = {
  sub?: string;
  role?: string;
  permissions?: string[];
};

const COMPATIBLE_PERMISSION_ALIASES: Record<string, string[]> = {
  "gate.out.create": ["vehicles.operate"],
  "gate.in.create": ["vehicles.operate"]
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: RequestUser;
      headers?: Record<string, unknown>;
    }>();
    const user = request.user;

    if (!user?.sub) {
      throw new UnauthorizedException("Authentication is required");
    }

    // Test harness only: HTTP e2e sets x-test-permissions and must not consume
    // prisma.user.findUnique mocks used by the service under test.
    if (process.env.NODE_ENV === "test" && typeof request.headers?.["x-test-permissions"] === "string") {
      if (user.role === "SUPER_ADMIN") {
        return true;
      }
      return this.assertHasPermissions(this.toPermissionSet(user.permissions), requiredPermissions);
    }

    // Authoritative DB lookup. JWT permission lists are ignored in production
    // (they can remain until token expiry).
    const dbUser = await this.loadDbUser(user.sub);

    if (!dbUser) {
      throw new UnauthorizedException("Authenticated user not found");
    }

    if (dbUser.isActive === false) {
      throw new UnauthorizedException("User account is disabled");
    }

    if (dbUser.lockedUntil && dbUser.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException("User account is temporarily locked");
    }

    // SUPER_ADMIN is determined from DB role only (not JWT claim alone).
    if (dbUser.role.name === "SUPER_ADMIN") {
      return true;
    }

    return this.assertHasPermissions(
      this.toPermissionSet(dbUser.role.permissions.map((p) => p.key)),
      requiredPermissions
    );
  }

  private async loadDbUser(userId: string) {
    if (!this.prisma.user?.findUnique) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        lockedUntil: true,
        role: {
          select: {
            name: true,
            permissions: {
              select: { key: true }
            }
          }
        }
      }
    });
  }

  private assertHasPermissions(
    userPermissions: Set<string>,
    requiredPermissions: string[]
  ): boolean {
    const missingPermissions = requiredPermissions.filter(
      (permission) => !this.hasPermission(userPermissions, permission)
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Missing required permission(s): ${missingPermissions.join(", ")}`
      );
    }

    return true;
  }

  private toPermissionSet(permissions: string[] | undefined): Set<string> {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return new Set();
    }

    return new Set(permissions.map((permission) => permission.trim()).filter(Boolean));
  }

  private hasPermission(userPermissions: Set<string>, requiredPermission: string): boolean {
    if (userPermissions.has(requiredPermission)) {
      return true;
    }

    return (COMPATIBLE_PERMISSION_ALIASES[requiredPermission] ?? []).some((permission) =>
      userPermissions.has(permission)
    );
  }
}
