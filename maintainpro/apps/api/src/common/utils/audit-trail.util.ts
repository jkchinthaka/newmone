import { AuditAction, Prisma } from "@prisma/client";

import { toJsonText } from "./json-text";
import { requestContext } from "../context/request-context";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../../modules/auth/auth.types";

export type AuditSource = "WEB" | "MOBILE" | "API" | "OFFLINE";

export type AuditTrailInput = {
  entity: string;
  entityId: string;
  action: AuditAction;
  module: string;
  actor?: Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  overrideFlag?: boolean;
  overrideType?: string;
  riskSeverity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  relatedWorkOrderId?: string;
  source?: AuditSource;
};

export function resolveAuditSource(requestPath?: string | null): AuditSource {
  if (!requestPath) return "API";
  if (/mobile|flutter/i.test(requestPath)) return "MOBILE";
  if (/offline/i.test(requestPath)) return "OFFLINE";
  return "WEB";
}

/**
 * Standard audit writer for sensitive actions.
 * See docs/go-live/audit-trail-standard.md for field contract.
 */
export async function writeAuditTrail(prisma: PrismaService, payload: AuditTrailInput) {
  const ctx = requestContext.get();
  const actorId = payload.actor?.sub ?? ctx?.actorId ?? null;
  const actorEmail = payload.actor?.email ?? ctx?.actorEmail ?? null;
  const actorRole = payload.actor?.role ?? ctx?.actorRole ?? null;
  const source = payload.source ?? resolveAuditSource(ctx?.requestPath);

  const metadata: Record<string, unknown> = {
    ...(payload.metadata && typeof payload.metadata === "object" ? (payload.metadata as Record<string, unknown>) : {}),
    source,
    overrideFlag: payload.overrideFlag === true,
    ...(payload.overrideType ? { overrideType: payload.overrideType } : {}),
    ...(payload.riskSeverity ? { riskSeverity: payload.riskSeverity } : {}),
    ...(payload.relatedWorkOrderId ? { workOrderId: payload.relatedWorkOrderId } : {})
  };

  await prisma.auditLog.create({
    data: {
      tenantId: payload.actor?.tenantId ?? ctx?.tenantId ?? null,
      actorId,
      module: payload.module,
      entity: payload.entity,
      entityId: payload.entityId,
      action: payload.action,
      reason: payload.reason,
      ipAddress: ctx?.ipAddress ?? undefined,
      userAgent: ctx?.userAgent ?? undefined,
      requestPath: ctx?.requestPath ?? undefined,
      actorSnapshot:
        actorId || actorEmail || actorRole
          ? toJsonText({
              id: actorId,
              email: actorEmail,
              role: actorRole,
              name: actorEmail
            }) ?? undefined
          : undefined,
      metadata: toJsonText(metadata) ?? undefined,
      beforeData: toJsonText(payload.beforeData) ?? undefined,
      afterData: toJsonText(payload.afterData) ?? undefined
    }
  });
}

export function rowsToCsv(headers: string[], rows: Record<string, unknown>[], metaLines: string[] = []) {
  const neutralize = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  };
  const escape = (value: unknown) => {
    const text = neutralize(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [...metaLines, headers.map((header) => escape(header)).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}
