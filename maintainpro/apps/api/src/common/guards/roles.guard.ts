import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, Optional } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PrismaService } from "../../database/prisma.service";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { sub?: string; role?: string | { name?: string } } | undefined;
    const jwtRole = typeof user?.role === "string" ? user.role : user?.role?.name;

    if (this.prisma?.user?.findUnique && user?.sub) {
      return this.roleFromDatabase(user.sub).then((roleName) => this.assertRole(roleName, requiredRoles));
    }

    return this.assertRole(jwtRole, requiredRoles);
  }

  private async roleFromDatabase(userId: string): Promise<string | undefined> {
    const dbUser = await this.prisma!.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        lockedUntil: true,
        role: { select: { name: true } }
      }
    });
    if (!dbUser || dbUser.isActive === false) {
      throw new ForbiddenException("You do not have permission to access this resource.");
    }
    if (dbUser.lockedUntil && dbUser.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException("You do not have permission to access this resource.");
    }
    return dbUser.role.name;
  }

  private assertRole(userRole: string | undefined, requiredRoles: string[]): boolean {
    if (!userRole) {
      throw new ForbiddenException("Authenticated role is required.");
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException("You do not have permission to access this resource.");
    }

    return true;
  }
}
