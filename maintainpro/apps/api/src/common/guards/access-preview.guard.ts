import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { previewUserId } from "../auth/access-preview";

/** Before authentication: even public login/token endpoints cannot mutate during preview. */
@Injectable()
export class AccessPreviewGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true;
    const req = context.switchToHttp().getRequest();
    if (previewUserId(req.headers ?? {}) && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      throw new ForbiddenException("Preview is read-only. Exit preview before making changes.");
    }
    return true;
  }
}
