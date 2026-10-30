import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = "allowPendingPasswordChange";

/**
 * Marks a route usable while the caller still has to replace a temporary password
 * (auth/me, auth/logout, the self-service password change).
 */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);

export const PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED";

/**
 * Runs after JwtAuthGuard. `req.user.mustChangePassword` is set by JwtStrategy.validate
 * from the database, so a token claim can never bypass it.
 */
@Injectable()
export class PasswordChangeRequiredGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { mustChangePassword?: boolean } }>();
    if (request.user?.mustChangePassword === true) {
      throw new ForbiddenException({
        message: "You must change your password before continuing.",
        code: PASSWORD_CHANGE_REQUIRED_CODE
      });
    }
    return true;
  }
}
