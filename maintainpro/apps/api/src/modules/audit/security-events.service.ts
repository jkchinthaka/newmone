import { createHash } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";

export type SecurityEventInput = {
  tenantId?: string | null;
  actorId?: string | null;
  eventType: string;
  outcome: "SUCCESS" | "FAILURE" | "BLOCKED" | "INFO";
  requestId?: string | null;
  reasonCode?: string;
  sourceCategory?: string;
  /** Optional email or username — stored only as a short fingerprint, never plaintext. */
  identifierHint?: string | null;
  metadata?: Record<string, unknown>;
};

const MAX_METADATA_KEYS = 12;
const MAX_METADATA_STRING = 120;

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);
  private readonly recentFailureBuckets = new Map<string, { count: number; windowStart: number }>();

  constructor(private readonly prisma: PrismaService) {}

  fingerprintIdentifier(value?: string | null): string | undefined {
    if (!value?.trim()) return undefined;
    return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 16);
  }

  private sanitizeMetadata(metadata?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
    if (!metadata) return undefined;
    const entries = Object.entries(metadata)
      .filter(([key]) => !/password|token|cookie|csrf|authorization|secret|payload|url/i.test(key))
      .slice(0, MAX_METADATA_KEYS)
      .map(([key, value]) => {
        if (typeof value === "string") {
          return [key, value.slice(0, MAX_METADATA_STRING)];
        }
        if (typeof value === "number" || typeof value === "boolean" || value == null) {
          return [key, value];
        }
        return [key, String(value).slice(0, MAX_METADATA_STRING)];
      });
    return Object.fromEntries(entries) as Prisma.InputJsonValue;
  }

  private allowWrite(eventType: string, fingerprint?: string): boolean {
    if (!eventType.includes("FAILURE") && !eventType.includes("LOCK")) return true;
    const key = `${eventType}:${fingerprint ?? "anon"}`;
    const now = Date.now();
    const bucket = this.recentFailureBuckets.get(key);
    if (!bucket || now - bucket.windowStart > 60_000) {
      this.recentFailureBuckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (bucket.count >= 30) {
      return false;
    }
    bucket.count += 1;
    return true;
  }

  async record(input: SecurityEventInput): Promise<void> {
    const fingerprint = this.fingerprintIdentifier(input.identifierHint);
    if (!this.allowWrite(input.eventType, fingerprint)) {
      return;
    }

    try {
      await this.prisma.securityEvent.create({
        data: {
          tenantId: input.tenantId ?? null,
          actorId: input.actorId ?? null,
          eventType: input.eventType,
          outcome: input.outcome,
          requestId: input.requestId ?? null,
          reasonCode: input.reasonCode ?? null,
          sourceCategory: input.sourceCategory ?? "AUTH",
          identifierFingerprint: fingerprint ?? null,
          metadata: this.sanitizeMetadata(input.metadata)
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to persist security event ${input.eventType}`);
    }
  }

  async listForTenant(
    tenantId: string | null,
    options: { eventType?: string; from?: Date; to?: Date; page?: number; pageSize?: number } = {}
  ) {
    const scopedTenantId = requireTenantId(tenantId);
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
    const where: Prisma.SecurityEventWhereInput = {
      tenantId: scopedTenantId,
      ...(options.eventType ? { eventType: options.eventType } : {}),
      ...(options.from || options.to
        ? {
            createdAt: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lte: options.to } : {})
            }
          }
        : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.securityEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tenantId: true,
          actorId: true,
          eventType: true,
          outcome: true,
          requestId: true,
          reasonCode: true,
          sourceCategory: true,
          identifierFingerprint: true,
          metadata: true,
          createdAt: true
        }
      }),
      this.prisma.securityEvent.count({ where })
    ]);

    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    };
  }
}
