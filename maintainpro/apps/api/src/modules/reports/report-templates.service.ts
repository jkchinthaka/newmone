import { BadRequestException, Injectable } from "@nestjs/common";
import { AppSettingScope, AuditAction } from "@prisma/client";

import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { canViewReportModule } from "./report-access.matrix";
import {
  BUILTIN_REPORT_TEMPLATES,
  type ReportTemplateDefinition,
  validateReportTemplate
} from "./report-kpi";

const SETTING_KEY = "report.templates";

type Actor = JwtPayload;

@Injectable()
export class ReportTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor) {
    const custom = await this.readCustom(actor.tenantId);
    return [...BUILTIN_REPORT_TEMPLATES, ...custom].filter((template) => this.visible(actor, template));
  }

  async save(actor: Actor, raw: Partial<ReportTemplateDefinition>) {
    let template: ReportTemplateDefinition;
    try {
      template = validateReportTemplate(raw);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Template is not valid.");
    }
    if (!canViewReportModule({ role: actor.role }, template.reportType)) {
      throw new BadRequestException("You cannot save a template for a report you cannot view.");
    }
    const custom = await this.readCustom(actor.tenantId);
    const existing = custom.find((item) => item.id === template.id);
    const next = existing ? custom.map((item) => (item.id === template.id ? template : item)) : [...custom, template];
    await this.writeCustom(actor, next);
    await writeAuditTrail(this.prisma, {
      entity: "ReportTemplate",
      entityId: template.id,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      module: "reports",
      actor,
      reason: existing ? "report_template_updated" : "report_template_created",
      metadata: { name: template.name, reportType: template.reportType, active: template.active }
    });
    return template;
  }

  private visible(actor: Actor, template: ReportTemplateDefinition) {
    if (!template.active && actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") return false;
    if (template.roles.length && !template.roles.includes(String(actor.role)) && actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
      return false;
    }
    return canViewReportModule({ role: actor.role }, template.reportType);
  }

  private async readCustom(tenantId?: string | null): Promise<ReportTemplateDefinition[]> {
    const tenant = tenantId ? requireTenantId(tenantId) : "GLOBAL";
    const row = await this.prisma.appSetting.findUnique({
      where: { scope_scopeId_key: { scope: AppSettingScope.TENANT, scopeId: tenant, key: SETTING_KEY } }
    });
    if (!row?.value) return [];
    try {
      const parsed = JSON.parse(row.value) as Partial<ReportTemplateDefinition>[];
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((item) => {
        try {
          return [validateReportTemplate(item)];
        } catch {
          return [];
        }
      });
    } catch {
      return [];
    }
  }

  private async writeCustom(actor: Actor, templates: ReportTemplateDefinition[]) {
    const tenant = actor.tenantId ? requireTenantId(actor.tenantId) : "GLOBAL";
    await this.prisma.appSetting.upsert({
      where: { scope_scopeId_key: { scope: AppSettingScope.TENANT, scopeId: tenant, key: SETTING_KEY } },
      create: {
        scope: AppSettingScope.TENANT,
        scopeId: tenant,
        key: SETTING_KEY,
        value: JSON.stringify(templates),
        isSecret: false
      },
      update: { value: JSON.stringify(templates) }
    });
  }
}
