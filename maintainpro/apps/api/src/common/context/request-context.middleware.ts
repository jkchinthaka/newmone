import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { requestContext } from "./request-context";

type AuthAwareRequest = Request & {
  user?: {
    sub?: string;
    email?: string;
    role?: string;
    tenantId?: string | null;
    permissions?: string[];
  };
  tenantContext?: { requestedTenantId: string | null };
};

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: AuthAwareRequest, _res: Response, next: NextFunction): void {
    const actorId = req.user?.sub ?? null;
    const actorEmail = req.user?.email ?? null;
    const actorRole = req.user?.role ?? null;
    const tenantId =
      req.tenantContext?.requestedTenantId ?? req.user?.tenantId ?? null;
    const routePath = req.baseUrl || req.path || req.originalUrl || req.url || "";
    const module = routePath.split("/").filter(Boolean)[0] ?? null;
    const forwarded = req.headers["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === "string"
        ? forwarded.split(",")[0]
        : null;
    const ipAddress = forwardedIp || req.ip || null;
    const userAgent =
      typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
    const requestPath = req.originalUrl || req.url || null;

    requestContext.run(
      {
        actorId,
        actorEmail,
        actorRole,
        tenantId,
        module,
        ipAddress,
        userAgent,
        requestPath,
        permissions: Array.isArray(req.user?.permissions) ? req.user.permissions : []
      },
      () => next()
    );
  }
}
