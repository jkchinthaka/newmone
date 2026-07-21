import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { requestContext } from "../context/request-context";

const REQUEST_ID_HEADER = "x-request-id";
const MAX_REQUEST_ID_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9\-_.]+$/;

export function normalizeIncomingRequestId(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!value || value.length > MAX_REQUEST_ID_LENGTH) {
    return null;
  }
  if (!REQUEST_ID_PATTERN.test(value)) {
    return null;
  }
  return value;
}

export function resolveRequestId(headerValue: unknown): string {
  return normalizeIncomingRequestId(headerValue) ?? randomUUID();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
    (req as Request & { requestId?: string }).requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    const existing = requestContext.get();
    if (existing) {
      requestContext.enterWith({ ...existing, requestId });
    } else {
      requestContext.enterWith({
        actorId: null,
        actorEmail: null,
        actorRole: null,
        tenantId: null,
        module: null,
        ipAddress: req.ip ?? null,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        requestPath: req.originalUrl ?? req.url ?? null,
        requestId
      });
    }

    next();
  }
}