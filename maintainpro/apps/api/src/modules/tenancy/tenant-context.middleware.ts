import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

type TenantAwareRequest = Request & {
  tenantContext?: {
    requestedTenantId: string | null;
  };
};

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: TenantAwareRequest, _res: Response, next: NextFunction): void {
    const rawHeader = req.header("x-tenant-id");
    const requestedTenantId =
      typeof rawHeader === "string" && rawHeader.trim().length > 0
        ? rawHeader.trim()
        : null;

    req.tenantContext = {
      requestedTenantId
    };

    next();
  }
}
