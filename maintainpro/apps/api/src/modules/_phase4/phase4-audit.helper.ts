import { AuditAction, Prisma } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

export type Phase4Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

export interface RecordAuditInput {
  entity: string;
  entityId: string;
  action: AuditAction;
  module: string;
  actor?: Phase4Actor;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
}

export async function recordPhase4Audit(prisma: PrismaService, payload: RecordAuditInput) {
  const ctx = requestContext.get();
  const actorId = payload.actor?.sub ?? ctx?.actorId ?? null;
  const actorEmail = payload.actor?.email ?? ctx?.actorEmail ?? null;
  const actorRole = payload.actor?.role ?? ctx?.actorRole ?? null;

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
          ? ({ id: actorId, email: actorEmail, role: actorRole } as Prisma.InputJsonValue)
          : undefined,
      metadata: payload.metadata,
      beforeData: payload.beforeData,
      afterData: payload.afterData
    }
  });
}

export function resolveTenantId(actor?: Phase4Actor): string | null | undefined {
  if (!actor) return undefined;
  return actor.tenantId ?? null;
}

export function assertActor(actor: Phase4Actor | undefined): Phase4Actor {
  if (!actor?.sub) {
    throw new Error("Authenticated actor context is required");
  }
  return actor;
}

export function isValidObjectId(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}
