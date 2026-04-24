import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AppSettingScope, AuditAction, Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";

import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role.name,
      isActive: user.isActive,
      lastLogin: user.lastLogin
    };
  }

  async updateProfile(
    userId: string,
    payload: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      currentPassword: string;
      newPassword: string;
    }>
  ) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!current) {
      throw new NotFoundException("User not found");
    }

    const nextData: Record<string, unknown> = {};

    if (typeof payload.firstName === "string") {
      nextData.firstName = payload.firstName.trim();
    }
    if (typeof payload.lastName === "string") {
      nextData.lastName = payload.lastName.trim();
    }
    if (typeof payload.phone === "string") {
      nextData.phone = payload.phone.trim();
    }

    if (typeof payload.email === "string") {
      const email = payload.email.trim().toLowerCase();
      if (!email.includes("@")) {
        throw new BadRequestException("Email is invalid");
      }

      const existing = await this.prisma.user.findFirst({
        where: {
          email,
          id: { not: userId }
        },
        select: { id: true }
      });

      if (existing) {
        throw new BadRequestException("Email already in use");
      }

      nextData.email = email;
    }

    if (payload.newPassword) {
      if (!payload.currentPassword) {
        throw new BadRequestException("Current password is required to set a new password");
      }

      const valid = await bcrypt.compare(payload.currentPassword, current.passwordHash);
      if (!valid) {
        throw new ForbiddenException("Current password is incorrect");
      }

      nextData.passwordHash = await bcrypt.hash(payload.newPassword, 12);
    }

    if (Object.keys(nextData).length === 0) {
      return this.getProfile(userId);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: nextData
    });

    await this.recordAudit({
      tenantId: current.tenantId,
      actorId: userId,
      entity: "SETTINGS_PROFILE",
      entityId: userId,
      action: AuditAction.UPDATE,
      beforeData: {
        firstName: current.firstName,
        lastName: current.lastName,
        email: current.email,
        phone: current.phone
      },
      afterData: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phone
      }
    });

    return this.getProfile(userId);
  }

  async getOrganization(actor: JwtPayload) {
    const tenant = await this.requireTenant(actor);
    const profile = await this.getTenantSetting<Record<string, unknown>>(tenant.id, "organization.profile", {
      timezone: "UTC",
      currency: "USD",
      logoUrl: ""
    });

    return {
      tenantId: tenant.id,
      companyName: tenant.name,
      slug: tenant.slug,
      timezone: (profile.timezone as string | undefined) ?? "UTC",
      currency: (profile.currency as string | undefined) ?? "USD",
      logoUrl: (profile.logoUrl as string | undefined) ?? ""
    };
  }

  async updateOrganization(
    actor: JwtPayload,
    payload: Partial<{
      companyName: string;
      slug: string;
      timezone: string;
      currency: string;
      logoUrl: string;
    }>
  ) {
    const tenant = await this.requireTenant(actor);

    const before = await this.getOrganization(actor);

    const nextTenantData: Record<string, unknown> = {};
    if (typeof payload.companyName === "string" && payload.companyName.trim()) {
      nextTenantData.name = payload.companyName.trim();
    }

    if (typeof payload.slug === "string" && payload.slug.trim()) {
      nextTenantData.slug = payload.slug.trim().toLowerCase();
    }

    if (Object.keys(nextTenantData).length > 0) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: nextTenantData
      });
    }

    const currentProfile = await this.getTenantSetting<Record<string, unknown>>(
      tenant.id,
      "organization.profile",
      {
        timezone: "UTC",
        currency: "USD",
        logoUrl: ""
      }
    );

    const mergedProfile = {
      ...currentProfile,
      ...(payload.timezone ? { timezone: payload.timezone } : {}),
      ...(payload.currency ? { currency: payload.currency } : {}),
      ...(payload.logoUrl !== undefined ? { logoUrl: payload.logoUrl } : {})
    };

    await this.setTenantSetting(tenant.id, "organization.profile", mergedProfile);

    const after = await this.getOrganization(actor);

    await this.recordAudit({
      tenantId: tenant.id,
      actorId: actor.sub,
      entity: "SETTINGS_ORGANIZATION",
      entityId: tenant.id,
      action: AuditAction.UPDATE,
      beforeData: before,
      afterData: after
    });

    return after;
  }

  async getSystemConfiguration(actor: JwtPayload) {
    const tenant = await this.requireTenant(actor);
    return this.getTenantSetting<Record<string, unknown>>(tenant.id, "system.configuration", {
      slaThresholdHours: {
        critical: 4,
        high: 24,
        medium: 72,
        low: 168
      },
      utilityRates: {
        electricity: 0,
        water: 0,
        gas: 0
      },
      notificationRules: {
        onlyCritical: false,
        emailOnlyOverdue: false
      }
    });
  }

  async updateSystemConfiguration(actor: JwtPayload, payload: Record<string, unknown>) {
    const tenant = await this.requireTenant(actor);
    const before = await this.getSystemConfiguration(actor);
    const next = {
      ...before,
      ...payload
    };

    await this.setTenantSetting(tenant.id, "system.configuration", next);

    await this.recordAudit({
      tenantId: tenant.id,
      actorId: actor.sub,
      entity: "SETTINGS_SYSTEM",
      entityId: tenant.id,
      action: AuditAction.UPDATE,
      beforeData: before,
      afterData: next
    });

    return next;
  }

  async getIntegrations(actor: JwtPayload) {
    const tenant = await this.requireTenant(actor);
    const raw = await this.getTenantSetting<Record<string, unknown>>(tenant.id, "system.integrations", {
      smtp: {
        host: "",
        port: 587,
        user: "",
        pass: ""
      },
      sms: {
        provider: "twilio",
        accountSid: "",
        authToken: ""
      },
      whatsapp: {
        phoneId: "",
        token: ""
      },
      webhooks: []
    });

    return this.maskSensitive(raw);
  }

  async updateIntegrations(actor: JwtPayload, payload: Record<string, unknown>) {
    const tenant = await this.requireTenant(actor);
    const before = await this.getTenantSetting<Record<string, unknown>>(tenant.id, "system.integrations", {
      smtp: {},
      sms: {},
      whatsapp: {},
      webhooks: []
    });

    const next = {
      ...before,
      ...payload
    };

    await this.setTenantSetting(tenant.id, "system.integrations", next, true);

    await this.recordAudit({
      tenantId: tenant.id,
      actorId: actor.sub,
      entity: "SETTINGS_INTEGRATIONS",
      entityId: tenant.id,
      action: AuditAction.UPDATE,
      beforeData: this.maskSensitive(before),
      afterData: this.maskSensitive(next)
    });

    return this.maskSensitive(next);
  }

  async getFeatureToggles(actor: JwtPayload) {
    const tenant = await this.requireTenant(actor);
    return this.getTenantSetting<Record<string, boolean>>(tenant.id, "system.featureToggles", {
      aiAssistant: true,
      predictiveAlerts: true,
      fleetModule: true,
      cleaningModule: true,
      utilitiesModule: true,
      inventoryModule: true
    });
  }

  async updateFeatureToggles(actor: JwtPayload, payload: Record<string, boolean>) {
    const tenant = await this.requireTenant(actor);
    const before = await this.getFeatureToggles(actor);
    const next = {
      ...before,
      ...payload
    };

    await this.setTenantSetting(tenant.id, "system.featureToggles", next);

    await this.recordAudit({
      tenantId: tenant.id,
      actorId: actor.sub,
      entity: "SETTINGS_FEATURE_TOGGLES",
      entityId: tenant.id,
      action: AuditAction.UPDATE,
      beforeData: before,
      afterData: next
    });

    return next;
  }

  async getAutomationRules(actor: JwtPayload) {
    const tenant = await this.requireTenant(actor);
    return this.getTenantSetting<Array<Record<string, unknown>>>(tenant.id, "system.automationRules", [
      {
        id: "rule-cleaning-missed",
        enabled: true,
        name: "Missed cleaning visit alert",
        condition: "IF cleaning missed",
        action: "Notify supervisors"
      },
      {
        id: "rule-utility-spike",
        enabled: true,
        name: "Utility spike alert",
        condition: "IF utility spike > 30%",
        action: "Notify manager"
      },
      {
        id: "rule-vehicle-overdue",
        enabled: true,
        name: "Vehicle overdue task",
        condition: "IF vehicle service overdue",
        action: "Create corrective task"
      }
    ]);
  }

  async updateAutomationRules(actor: JwtPayload, rules: Array<Record<string, unknown>>) {
    const tenant = await this.requireTenant(actor);
    const before = await this.getAutomationRules(actor);

    await this.setTenantSetting(tenant.id, "system.automationRules", rules);

    await this.recordAudit({
      tenantId: tenant.id,
      actorId: actor.sub,
      entity: "SETTINGS_AUTOMATION_RULES",
      entityId: tenant.id,
      action: AuditAction.UPDATE,
      beforeData: before,
      afterData: rules
    });

    return rules;
  }

  async getDigestSchedules(actor: JwtPayload) {
    const tenant = await this.requireTenant(actor);
    return this.getTenantSetting<Array<Record<string, unknown>>>(tenant.id, "system.digestSchedules", [
      {
        id: "daily-summary",
        enabled: true,
        frequency: "DAILY",
        deliveryTime: "08:00",
        channel: "IN_APP"
      },
      {
        id: "weekly-report",
        enabled: true,
        frequency: "WEEKLY",
        dayOfWeek: "MONDAY",
        deliveryTime: "09:00",
        channel: "EMAIL"
      },
      {
        id: "monthly-digest",
        enabled: true,
        frequency: "MONTHLY",
        dayOfMonth: 1,
        deliveryTime: "09:00",
        channel: "EMAIL"
      }
    ]);
  }

  async updateDigestSchedules(actor: JwtPayload, schedules: Array<Record<string, unknown>>) {
    const tenant = await this.requireTenant(actor);
    const before = await this.getDigestSchedules(actor);

    await this.setTenantSetting(tenant.id, "system.digestSchedules", schedules);

    await this.recordAudit({
      tenantId: tenant.id,
      actorId: actor.sub,
      entity: "SETTINGS_DIGEST_SCHEDULES",
      entityId: tenant.id,
      action: AuditAction.UPDATE,
      beforeData: before,
      afterData: schedules
    });

    return schedules;
  }

  async getAuditLogs(
    actor: JwtPayload,
    query: { page: number; pageSize: number; entity?: string }
  ): Promise<{ items: unknown[]; pagination: Pagination }> {
    const tenant = await this.requireTenant(actor);
    const page = Number.isFinite(query.page) && query.page > 0 ? query.page : 1;
    const pageSize = Math.min(
      100,
      Number.isFinite(query.pageSize) && query.pageSize > 0 ? query.pageSize : 20
    );

    const where = {
      tenantId: tenant.id,
      entity: query.entity ? query.entity : undefined
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  private async requireTenant(actor: JwtPayload) {
    if (!actor.tenantId) {
      throw new BadRequestException("User is not mapped to a tenant");
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: actor.tenantId }
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  private async getTenantSetting<T>(tenantId: string, key: string, fallback: T): Promise<T> {
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        scope_scopeId_key: {
          scope: AppSettingScope.TENANT,
          scopeId: tenantId,
          key
        }
      }
    });

    if (!setting) {
      return fallback;
    }

    return setting.value as T;
  }

  private async setTenantSetting(
    tenantId: string,
    key: string,
    value: unknown,
    isSecret = false
  ) {
    return this.prisma.appSetting.upsert({
      where: {
        scope_scopeId_key: {
          scope: AppSettingScope.TENANT,
          scopeId: tenantId,
          key
        }
      },
      create: {
        scope: AppSettingScope.TENANT,
        scopeId: tenantId,
        key,
        value: value as Prisma.InputJsonValue,
        isSecret
      },
      update: {
        value: value as Prisma.InputJsonValue,
        isSecret
      }
    });
  }

  private async recordAudit(payload: {
    tenantId: string | null;
    actorId: string;
    entity: string;
    entityId: string;
    action: AuditAction;
    beforeData?: unknown;
    afterData?: unknown;
  }) {
    if (!payload.tenantId) {
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId: payload.tenantId,
        actorId: payload.actorId,
        entity: payload.entity,
        entityId: payload.entityId,
        action: payload.action,
        beforeData: payload.beforeData as Prisma.InputJsonValue | undefined,
        afterData: payload.afterData as Prisma.InputJsonValue | undefined
      }
    });
  }

  private maskSensitive(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.maskSensitive(item));
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    const output: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      const keyLc = key.toLowerCase();

      if (
        keyLc.includes("secret") ||
        keyLc.includes("token") ||
        keyLc.includes("password") ||
        keyLc.includes("apikey") ||
        keyLc === "pass" ||
        keyLc.endsWith("key")
      ) {
        output[key] = typeof entry === "string" && entry.length > 0 ? "********" : "";
      } else {
        output[key] = this.maskSensitive(entry);
      }
    }

    return output;
  }
}
