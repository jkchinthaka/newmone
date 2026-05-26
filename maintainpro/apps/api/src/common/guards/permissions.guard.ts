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

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user?.sub) {
      throw new UnauthorizedException("Authentication is required");
    }

    if (user.role === "SUPER_ADMIN") {
      return true;
    }

    let userPermissions = this.toPermissionSet(user.permissions);

    if (userPermissions.size === 0) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
        include: {
          role: {
            include: {
              permissions: {
                select: {
                  key: true
                }
              }
            }
          }
        }
      });

      if (!dbUser) {
        throw new UnauthorizedException("Authenticated user not found");
      }

      userPermissions = this.toPermissionSet(dbUser.role.permissions.map((permission) => permission.key));
    }

    const missingPermissions = requiredPermissions.filter(
      (permission) => !userPermissions.has(permission)
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

    return new Set(
      permissions
        .map((permission) => permission.trim())
        .filter(Boolean)
    );
  }
}