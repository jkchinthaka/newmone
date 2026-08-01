import { createHash } from "node:crypto";

import type { PrismaService } from "../../database/prisma.service";

type SecurityEventInput = {
  tenantId?: string | null;
  actorId?: string | null;
  eventType: string;
  outcome: "SUCCESS" | "FAILURE" | "BLOCKED" | "INFO";
  requestId?: string | null;
  reasonCode?: string;
  sourceCategory?: string;
  identifierHint?: string | null;
  metadata?: Record<string, unknown>;
};

function fingerprintIdentifier(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined;
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 16);
}

function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !/password|token|cookie|csrf|authorization|secret|payload|url/i.test(key))
      .slice(0, 12)
      .map(([key, value]) => {
        if (typeof value === "string") return [key, value.slice(0, 120)];
        if (typeof value === "number" || typeof value === "boolean" || value == null) return [key, value];
        return [key, String(value).slice(0, 120)];
      })
  );
}

/** Fire-and-forget safe security event write used by AuthService (no Nest module coupling). */
export function recordAuthSecurityEvent(prisma: PrismaService, input: SecurityEventInput): void {
  try {
    const model = (prisma as { securityEvent?: { create: (args: unknown) => Promise<unknown> } }).securityEvent;
    if (!model?.create) return;

    const fingerprint = fingerprintIdentifier(input.identifierHint);
    void model
      .create({
        data: {
          tenantId: input.tenantId ?? null,
          actorId: input.actorId ?? null,
          eventType: input.eventType,
          outcome: input.outcome,
          requestId: input.requestId ?? null,
          reasonCode: input.reasonCode ?? null,
          sourceCategory: input.sourceCategory ?? "AUTH",
          identifierFingerprint: fingerprint ?? null,
          metadata: sanitizeMetadata(input.metadata)
        }
      })
      .catch(() => undefined);
  } catch {
    // Never block authentication on security-event persistence.
  }
}
