import { Injectable } from "@nestjs/common";
import { AppSettingScope, Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { DEFAULT_ORG_POLICY, type OrgPolicySnapshot } from "../policies/governance-policies";

export const ENTERPRISE_POLICY_KEY = "enterprise.policy";

@Injectable()
export class OrganizationPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getPolicy(tenantId: string): Promise<OrgPolicySnapshot> {
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        scope_scopeId_key: {
          scope: AppSettingScope.TENANT,
          scopeId: tenantId,
          key: ENTERPRISE_POLICY_KEY
        }
      }
    });
    if (!setting || typeof setting.value !== "object" || setting.value == null || Array.isArray(setting.value)) {
      return { ...DEFAULT_ORG_POLICY };
    }
    const value = setting.value as Record<string, unknown>;
    return {
      slaWarningPct: num(value.slaWarningPct, DEFAULT_ORG_POLICY.slaWarningPct),
      slaBreachPct: num(value.slaBreachPct, DEFAULT_ORG_POLICY.slaBreachPct),
      slaEscalatePct: num(value.slaEscalatePct, DEFAULT_ORG_POLICY.slaEscalatePct),
      weekendsCountAsBusiness: Boolean(value.weekendsCountAsBusiness ?? DEFAULT_ORG_POLICY.weekendsCountAsBusiness),
      holidays: Array.isArray(value.holidays) ? value.holidays.map(String) : [],
      emergencyBypassesBudget: value.emergencyBypassesBudget !== false,
      ptwStrict: Boolean(value.ptwStrict),
      ptwRequiredTaxonomyCodes: Array.isArray(value.ptwRequiredTaxonomyCodes)
        ? value.ptwRequiredTaxonomyCodes.map(String)
        : [],
      approvalPurchaseLimit: num(value.approvalPurchaseLimit, 0),
      approvalAdjustLimit: num(value.approvalAdjustLimit, 0)
    };
  }

  async savePolicy(tenantId: string, patch: Partial<OrgPolicySnapshot>) {
    const current = await this.getPolicy(tenantId);
    const next = { ...current, ...patch };
    await this.prisma.appSetting.upsert({
      where: {
        scope_scopeId_key: {
          scope: AppSettingScope.TENANT,
          scopeId: tenantId,
          key: ENTERPRISE_POLICY_KEY
        }
      },
      create: {
        scope: AppSettingScope.TENANT,
        scopeId: tenantId,
        key: ENTERPRISE_POLICY_KEY,
        value: next as Prisma.InputJsonValue
      },
      update: { value: next as Prisma.InputJsonValue }
    });
    return next;
  }
}

function num(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
