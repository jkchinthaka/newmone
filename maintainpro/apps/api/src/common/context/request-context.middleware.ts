import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { requestContext } from "./request-context";

type AuthAwareRequest = Request & {
  user?: {
    sub?: string;
    email?: string;
    role?: string;
    tenantId?: string | null;
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

    requestContext.run(
      {
        actorId,
        actorEmail,
        actorRole,
        tenantId
      },
      () => next()
    );
  }
}
