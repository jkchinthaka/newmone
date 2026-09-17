import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Priority } from "@prisma/client";

import { parseJobDomain } from "../../common/utils/job-domain.util";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

export type MaintenanceTemplateInput = {
  code: string;
  name: string;
  description?: string;
  jobDomain: string;
  jobType?: string;
  categoryCode?: string;
  subcategoryCode?: string;
  defaultPriority?: string;
  estimatedHours?: number | null;
  estimatedDowntimeMin?: number | null;
  defaultExecutionMode?: string;
  requiredSkills?: string[];
  defaultParts?: unknown[];
  safetyRequirements?: string[];
  permitRequirement?: string | null;
  checklistTemplateId?: string | null;
  signOffRequirements?: string[];
  instructions?: string | null;
  documents?: unknown[];
  reason?: string;
};

@Injectable()
export class MaintenanceTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: { jobDomain?: string; activeOnly?: boolean } = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    const domain = query.jobDomain ? parseJobDomain(query.jobDomain) : null;
    return this.prisma.maintenanceTemplate.findMany({
      where: {
        tenantId,
        ...(domain ? { jobDomain: domain } : {}),
        ...(query.activeOnly === false ? {} : { active: true })
      },
      orderBy: [{ code: "asc" }, { version: "desc" }]
    });
  }

  async get(actor: Actor, id: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const row = await this.prisma.maintenanceTemplate.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Maintenance template not found");
    return row;
  }

  async create(actor: Actor, input: MaintenanceTemplateInput) {
    const tenantId = requireTenantId(actor.tenantId);
    const jobDomain = parseJobDomain(input.jobDomain);
    if (!jobDomain) throw new BadRequestException("Invalid jobDomain");
    if (!input.code?.trim() || !input.name?.trim()) {
      throw new BadRequestException("code and name are required");
    }
    const code = input.code.trim().toUpperCase();
    const existing = await this.prisma.maintenanceTemplate.findFirst({
      where: { tenantId, code, active: true }
    });
    if (existing) {
      throw new BadRequestException(
        `Active template ${code} already exists — revise it instead of creating a duplicate`
      );
    }

    if (input.checklistTemplateId) {
      const checklist = await this.prisma.checklistTemplate.findFirst({
        where: { id: input.checklistTemplateId, tenantId, isActive: true }
      });
      if (!checklist) throw new BadRequestException("Checklist template not found");
    }

    const created = await this.prisma.maintenanceTemplate.create({
      data: this.toCreateData(tenantId, actor.sub, code, jobDomain, input, 1)
    });

    await this.recordHistory(actor, {
      entityType: "MaintenanceTemplate",
      entityId: created.id,
      action: "CREATE",
      reason: input.reason ?? "Maintenance template created",
      afterJson: this.publicSnapshot(created)
    });

    return created;
  }

  /**
   * Bump version: deactivate prior active versions of the same code, create new row.
   * Existing WorkOrder.maintenanceTemplateSnapshot rows remain frozen.
   */
  async revise(actor: Actor, templateId: string, input: Partial<MaintenanceTemplateInput> & { changeReason?: string }) {
    const tenantId = requireTenantId(actor.tenantId);
    const current = await this.prisma.maintenanceTemplate.findFirst({
      where: { id: templateId, tenantId }
    });
    if (!current) throw new NotFoundException("Maintenance template not found");

    const nextVersion = current.version + 1;
    const jobDomain = input.jobDomain ? parseJobDomain(input.jobDomain) : parseJobDomain(current.jobDomain);
    if (!jobDomain) throw new BadRequestException("Invalid jobDomain");

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceTemplate.updateMany({
        where: { tenantId, code: current.code, active: true },
        data: { active: false, effectiveTo: new Date(), updatedById: actor.sub }
      });

      return tx.maintenanceTemplate.create({
        data: this.toCreateData(
          tenantId,
          actor.sub,
          current.code,
          jobDomain,
          {
            code: current.code,
            name: input.name ?? current.name,
            description: input.description !== undefined ? input.description : current.description ?? undefined,
            jobDomain,
            jobType: input.jobType !== undefined ? input.jobType : current.jobType ?? undefined,
            categoryCode:
              input.categoryCode !== undefined ? input.categoryCode : current.categoryCode ?? undefined,
            subcategoryCode:
              input.subcategoryCode !== undefined
                ? input.subcategoryCode
                : current.subcategoryCode ?? undefined,
            defaultPriority: input.defaultPriority ?? current.defaultPriority,
            estimatedHours:
              input.estimatedHours !== undefined ? input.estimatedHours : current.estimatedHours,
            estimatedDowntimeMin:
              input.estimatedDowntimeMin !== undefined
                ? input.estimatedDowntimeMin
                : current.estimatedDowntimeMin,
            defaultExecutionMode:
              input.defaultExecutionMode !== undefined
                ? input.defaultExecutionMode
                : current.defaultExecutionMode ?? undefined,
            requiredSkills:
              input.requiredSkills ?? this.parseJsonArray(current.requiredSkillsJson),
            defaultParts: input.defaultParts ?? this.parseJsonArray(current.defaultPartsJson),
            safetyRequirements:
              input.safetyRequirements ?? this.parseJsonArray(current.safetyRequirementsJson),
            permitRequirement:
              input.permitRequirement !== undefined
                ? input.permitRequirement
                : current.permitRequirement,
            checklistTemplateId:
              input.checklistTemplateId !== undefined
                ? input.checklistTemplateId
                : current.checklistTemplateId,
            signOffRequirements:
              input.signOffRequirements ?? this.parseJsonArray(current.signOffRequirementsJson),
            instructions:
              input.instructions !== undefined ? input.instructions : current.instructions,
            documents: input.documents ?? this.parseJsonArray(current.documentsJson)
          },
          nextVersion
        )
      });
    });

    await this.recordHistory(actor, {
      entityType: "MaintenanceTemplate",
      entityId: created.id,
      action: "REVISE",
      reason: input.changeReason ?? `Revised ${current.code} to v${nextVersion}`,
      beforeJson: this.publicSnapshot(current),
      afterJson: this.publicSnapshot(created)
    });

    return created;
  }

  async setActive(actor: Actor, templateId: string, active: boolean, reason?: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const current = await this.prisma.maintenanceTemplate.findFirst({
      where: { id: templateId, tenantId }
    });
    if (!current) throw new NotFoundException("Maintenance template not found");

    if (active) {
      await this.prisma.maintenanceTemplate.updateMany({
        where: { tenantId, code: current.code, active: true, NOT: { id: current.id } },
        data: { active: false, effectiveTo: new Date() }
      });
    }

    const updated = await this.prisma.maintenanceTemplate.update({
      where: { id: templateId },
      data: {
        active,
        effectiveTo: active ? null : new Date(),
        updatedById: actor.sub
      }
    });

    await this.recordHistory(actor, {
      entityType: "MaintenanceTemplate",
      entityId: updated.id,
      action: active ? "ACTIVATE" : "DEACTIVATE",
      reason: reason ?? (active ? "Template activated" : "Template deactivated"),
      beforeJson: this.publicSnapshot(current),
      afterJson: this.publicSnapshot(updated)
    });

    return updated;
  }

  /** Build immutable snapshot JSON for WorkOrder create. */
  buildSnapshot(template: {
    id: string;
    code: string;
    name: string;
    version: number;
    jobDomain: string;
    jobType: string | null;
    categoryCode: string | null;
    subcategoryCode: string | null;
    defaultPriority: string;
    estimatedHours: number | null;
    estimatedDowntimeMin: number | null;
    defaultExecutionMode: string | null;
    requiredSkillsJson: string;
    defaultPartsJson: string;
    safetyRequirementsJson: string;
    permitRequirement: string | null;
    checklistTemplateId: string | null;
    signOffRequirementsJson: string;
    instructions: string | null;
    documentsJson: string;
  }) {
    return {
      id: template.id,
      code: template.code,
      name: template.name,
      version: template.version,
      jobDomain: template.jobDomain,
      jobType: template.jobType,
      categoryCode: template.categoryCode,
      subcategoryCode: template.subcategoryCode,
      defaultPriority: template.defaultPriority,
      estimatedHours: template.estimatedHours,
      estimatedDowntimeMin: template.estimatedDowntimeMin,
      defaultExecutionMode: template.defaultExecutionMode,
      requiredSkills: this.parseJsonArray(template.requiredSkillsJson),
      defaultParts: this.parseJsonArray(template.defaultPartsJson),
      safetyRequirements: this.parseJsonArray(template.safetyRequirementsJson),
      permitRequirement: template.permitRequirement,
      checklistTemplateId: template.checklistTemplateId,
      signOffRequirements: this.parseJsonArray(template.signOffRequirementsJson),
      instructions: template.instructions,
      documents: this.parseJsonArray(template.documentsJson),
      snappedAt: new Date().toISOString()
    };
  }

  async resolveActiveTemplate(tenantId: string, templateId: string) {
    return this.prisma.maintenanceTemplate.findFirst({
      where: { id: templateId, tenantId, active: true }
    });
  }

  async seedDefaults(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const defaults: MaintenanceTemplateInput[] = [
      {
        code: "GEN_MONTHLY",
        name: "Generator Monthly Maintenance",
        jobDomain: "MACHINERY",
        jobType: "PREVENTIVE",
        categoryCode: "CORRECTIVE",
        subcategoryCode: "GENERATOR",
        defaultPriority: Priority.MEDIUM,
        estimatedHours: 2,
        estimatedDowntimeMin: 60,
        requiredSkills: ["Electrical", "Mechanical"],
        safetyRequirements: ["PPE", "LOTO"],
        instructions: "Inspect oil, coolant, battery, and run test load."
      },
      {
        code: "AC_QUARTERLY",
        name: "AC Quarterly Service",
        jobDomain: "SERVICE",
        jobType: "PREVENTIVE",
        categoryCode: "FACILITY_SERVICE",
        subcategoryCode: "AC",
        defaultPriority: Priority.MEDIUM,
        estimatedHours: 3,
        requiredSkills: ["Refrigeration"],
        instructions: "Filter clean, refrigerant check, drain clean."
      },
      {
        code: "VEH_10K",
        name: "10,000 KM Vehicle Service",
        jobDomain: "VEHICLE",
        jobType: "PREVENTIVE",
        categoryCode: "VEHICLE_REPAIR",
        subcategoryCode: "SCHEDULED_SERVICE",
        defaultPriority: Priority.MEDIUM,
        estimatedHours: 4,
        requiredSkills: ["Vehicle"],
        instructions: "Oil, filters, brakes, tyre pressure, lights."
      }
    ];

    const results = [];
    for (const item of defaults) {
      const existing = await this.prisma.maintenanceTemplate.findFirst({
        where: { tenantId, code: item.code }
      });
      if (existing) {
        results.push({ code: item.code, status: "skipped" });
        continue;
      }
      await this.create(actor, { ...item, reason: "Seed default maintenance template" });
      results.push({ code: item.code, status: "created" });
    }
    return results;
  }

  private toCreateData(
    tenantId: string,
    actorId: string | undefined,
    code: string,
    jobDomain: string,
    input: MaintenanceTemplateInput,
    version: number
  ) {
    const priority = (input.defaultPriority ?? "MEDIUM").toUpperCase();
    if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority)) {
      throw new BadRequestException("Invalid defaultPriority");
    }
    return {
      tenantId,
      code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      jobDomain,
      jobType: input.jobType?.trim() || null,
      categoryCode: input.categoryCode?.trim().toUpperCase() || null,
      subcategoryCode: input.subcategoryCode?.trim().toUpperCase() || null,
      defaultPriority: priority,
      estimatedHours: input.estimatedHours ?? null,
      estimatedDowntimeMin: input.estimatedDowntimeMin ?? null,
      defaultExecutionMode: input.defaultExecutionMode?.trim() || null,
      requiredSkillsJson: JSON.stringify(input.requiredSkills ?? []),
      defaultPartsJson: JSON.stringify(input.defaultParts ?? []),
      safetyRequirementsJson: JSON.stringify(input.safetyRequirements ?? []),
      permitRequirement: input.permitRequirement?.trim() || null,
      checklistTemplateId: input.checklistTemplateId || null,
      signOffRequirementsJson: JSON.stringify(input.signOffRequirements ?? []),
      instructions: input.instructions ?? null,
      documentsJson: JSON.stringify(input.documents ?? []),
      version,
      active: true,
      createdById: actorId,
      updatedById: actorId
    };
  }

  private publicSnapshot(row: {
    id: string;
    code: string;
    name: string;
    version: number;
    jobDomain: string;
    active: boolean;
    defaultPriority: string;
  }) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      version: row.version,
      jobDomain: row.jobDomain,
      active: row.active,
      defaultPriority: row.defaultPriority
    };
  }

  private parseJsonArray(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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
