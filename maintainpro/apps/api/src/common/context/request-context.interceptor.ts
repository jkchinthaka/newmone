import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";

import { requestContext } from "./request-context";

type AuthAwareRequest = Request & {
  requestId?: string;
  user?: {
    sub?: string;
    email?: string;
    role?: string;
    tenantId?: string | null;
    permissions?: string[];
  };
  tenantId?: string | null;
};

/**
 * Populates the AsyncLocalStorage request context with the *authenticated* actor
 * and the tenant resolved by TenantContextGuard.
 *
 * This must run as an interceptor, not middleware: NestJS always runs
 * middleware before guards, so by the time RequestContextMiddleware ran,
 * JwtAuthGuard had not yet attached `request.user` and TenantContextGuard had
 * not yet resolved the effective tenantId (JWT claim / membership fallback).
 * Reading those fields at middleware time meant requestContext.tenantId /
 * actorId were always null unless the caller happened to send X-Tenant-Id,
 * which caused tenant-scoped services relying on requestContext.getTenantId()
 * to fail closed with "Tenant context is required" even for a valid,
 * already-authorized session. Interceptors run after guards, so request.user
 * and request.tenantId are fully resolved here.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthAwareRequest>();
    const existing = requestContext.get();

    const routePath = req.baseUrl || req.path || req.originalUrl || req.url || "";
    const module = routePath.split("/").filter(Boolean)[0] ?? null;
    const forwarded = req.headers["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === "string"
        ? forwarded.split(",")[0]
        : null;

    requestContext.enterWith({
      actorId: req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      actorRole: req.user?.role ?? null,
      tenantId: req.tenantId ?? req.user?.tenantId ?? null,
      module,
      ipAddress: forwardedIp || req.ip || existing?.ipAddress || null,
      userAgent:
        (typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null) ??
        existing?.userAgent ??
        null,
      requestPath: req.originalUrl || req.url || existing?.requestPath || null,
      requestId: req.requestId ?? existing?.requestId ?? null,
      permissions: Array.isArray(req.user?.permissions) ? req.user.permissions : []
    });

    return next.handle();
  }
}
