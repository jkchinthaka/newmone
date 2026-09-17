import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import {
  isKnownFeatureCode,
  TENANT_FEATURE_CATALOG
} from "../../common/utils/tenant-feature-catalog";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

@Injectable()
export class TenantFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForTenant(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    await this.ensureDefaults(tenantId, actor.sub);
    const now = new Date();
    const rows = await this.prisma.tenantFeatureFlag.findMany({
      where: { tenantId },
      orderBy: { code: "asc" }
    });
    return rows.map((row) => ({
      ...row,
      currentlyEnabled: this.isCurrentlyEnabled(row, now)
    }));
  }

  /** Enabled feature codes for nav / lightweight clients. */
  async enabledCodes(tenantId: string | null | undefined): Promise<string[]> {
    const tid = requireTenantId(tenantId);
    await this.ensureDefaults(tid);
    const now = new Date();
    const rows = await this.prisma.tenantFeatureFlag.findMany({ where: { tenantId: tid } });
    return rows.filter((row) => this.isCurrentlyEnabled(row, now)).map((row) => row.code);
  }

  async isEnabled(tenantId: string, code: string): Promise<boolean> {
    const tid = requireTenantId(tenantId);
    await this.ensureDefaults(tid);
    const row = await this.prisma.tenantFeatureFlag.findUnique({
      where: { tenantId_code: { tenantId: tid, code: code.trim().toUpperCase() } }
    });
    if (!row) return true;
    return this.isCurrentlyEnabled(row, new Date());
  }

  async assertEnabled(tenantId: string, code: string) {
    const ok = await this.isEnabled(tenantId, code);
    if (!ok) {
      throw new BadRequestException(`Feature ${code} is disabled for this tenant`);
    }
  }

  async upsert(
    actor: Actor,
    input: {
      code: string;
      enabled: boolean;
      name?: string;
      description?: string;
      effectiveFrom?: string;
      effectiveTo?: string | null;
      configJson?: unknown;
      reason?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const code = input.code.trim().toUpperCase();
    if (!isKnownFeatureCode(code) && !/^[A-Z][A-Z0-9_]{1,62}$/.test(code)) {
      throw new BadRequestException("Invalid feature code");
    }
    const catalog = TENANT_FEATURE_CATALOG.find((f) => f.code === code);
    const before = await this.prisma.tenantFeatureFlag.findUnique({
      where: { tenantId_code: { tenantId, code } }
    });

    let configJson: string | null | undefined;
    if (input.configJson !== undefined) {
      if (input.configJson == null) configJson = null;
      else if (typeof input.configJson === "string") configJson = input.configJson;
      else configJson = JSON.stringify(input.configJson);
      // Reject obviously executable payloads
      if (configJson && /\b(eval|Function|script)\b/i.test(configJson)) {
        throw new BadRequestException("configJson must not contain executable content");
      }
    }

    const saved = await this.prisma.tenantFeatureFlag.upsert({
      where: { tenantId_code: { tenantId, code } },
      update: {
        enabled: input.enabled,
        name: input.name?.trim() || catalog?.name || before?.name || code,
        description:
          input.description !== undefined
            ? input.description
            : before?.description ?? catalog?.description ?? null,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
        effectiveTo:
          input.effectiveTo === null
            ? null
            : input.effectiveTo
              ? new Date(input.effectiveTo)
              : undefined,
        configJson: configJson === undefined ? undefined : configJson,
        updatedById: actor.sub
      },
      create: {
        tenantId,
        code,
        name: input.name?.trim() || catalog?.name || code,
        description: input.description ?? catalog?.description ?? null,
        enabled: input.enabled,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        configJson: configJson ?? null,
        updatedById: actor.sub
      }
    });

    await this.recordHistory(actor, {
      entityType: "TenantFeatureFlag",
      entityId: saved.id,
      action: before ? "UPDATE" : "CREATE",
      reason: input.reason ?? `Feature ${code} ${input.enabled ? "enabled" : "disabled"}`,
      beforeJson: before,
      afterJson: saved
    });

    return saved;
  }

  async ensureDefaults(tenantId: string, actorId?: string) {
    for (const feature of TENANT_FEATURE_CATALOG) {
      await this.prisma.tenantFeatureFlag.upsert({
        where: { tenantId_code: { tenantId, code: feature.code } },
        update: {},
        create: {
          tenantId,
          code: feature.code,
          name: feature.name,
          description: feature.description,
          enabled: true,
          updatedById: actorId
        }
      });
    }
  }

  private isCurrentlyEnabled(
    row: { enabled: boolean; effectiveFrom: Date; effectiveTo: Date | null },
    now: Date
  ) {
    if (!row.enabled) return false;
    if (row.effectiveFrom.getTime() > now.getTime()) return false;
    if (row.effectiveTo && row.effectiveTo.getTime() < now.getTime()) return false;
    return true;
  }

  private async recordHistory(
    actor: Actor,
    input: {
      entityType: string;
      entityId: string;
      action: string;
      reason?: string;
      beforeJson?: unknown;
      afterJson?: unknown;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const priorCount = await this.prisma.configChangeHistory.count({
      where: {
        tenantId,
        entityType: input.entityType,
        entityId: input.entityId
      }
    });
    await this.prisma.configChangeHistory.create({
      data: {
        tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        reason: input.reason,
        beforeJson: input.beforeJson != null ? JSON.stringify(input.beforeJson) : null,
        afterJson: input.afterJson != null ? JSON.stringify(input.afterJson) : null,
        version: priorCount + 1,
        actorId: actor.sub
      }
    });
  }
}
