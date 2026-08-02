import { Logger } from "@nestjs/common";

import { requestContext } from "../context/request-context";
import { sanitizeLogText } from "./sanitize-for-log.util";

export type StructuredLogFields = {
  event: string;
  level?: "log" | "warn" | "error" | "debug";
  method?: string;
  routeTemplate?: string;
  statusCode?: number;
  durationMs?: number;
  tenantCategory?: string;
  actorRole?: string;
  errorCode?: string;
  buildCommit?: string;
  extraSafe?: Record<string, string | number | boolean | null>;
};

/**
 * Emits a single-line JSON-ish structured log via Nest Logger.
 * Fields are bounded and must not include secrets or PII emails.
 */
export function emitStructuredLog(
  logger: Logger,
  service: string,
  fields: StructuredLogFields
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level: fields.level ?? "log",
    service,
    environment: process.env.APP_ENVIRONMENT || process.env.NODE_ENV || "development",
    event: fields.event,
    requestId: requestContext.getRequestId() ?? null,
    method: fields.method ?? null,
    routeTemplate: fields.routeTemplate ? sanitizeLogText(fields.routeTemplate, 200) : null,
    statusCode: fields.statusCode ?? null,
    durationMs: fields.durationMs ?? null,
    tenantCategory: fields.tenantCategory ?? null,
    actorRole: fields.actorRole ?? null,
    errorCode: fields.errorCode ?? null,
    buildCommit: fields.buildCommit ?? process.env.APP_COMMIT_SHA ?? null,
    ...(fields.extraSafe ?? {})
  };

  const line = sanitizeLogText(JSON.stringify(payload), 4_000);
  const level = fields.level ?? "log";
  if (level === "error") {
    logger.error(line);
  } else if (level === "warn") {
    logger.warn(line);
  } else if (level === "debug") {
    logger.debug(line);
  } else {
    logger.log(line);
  }
}
