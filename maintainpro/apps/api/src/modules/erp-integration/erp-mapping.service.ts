import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { DEFAULT_FIELD_MAPPINGS } from "./erp.constants";
import type { CreateErpMappingDto, UpdateErpMappingDto } from "./dto/erp.dto";

@Injectable()
export class ErpMappingService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const c = requestContext.get();
    return { actorId: c?.actorId, actorRole: c?.actorRole, tenantId: c?.tenantId, permissions: c?.permissions ?? [] };
  }

  canView() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("erp.view") || permissions.includes("erp.manage");
  }

  canManage() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("erp.manage");
  }

  private tenantId(): string {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN && tenantId) return tenantId;
    if (!tenantId) throw new BadRequestException("Tenant context is required");
    return tenantId;
  }

  private async audit(event: string, entityId: string, before?: unknown, after?: unknown) {
    await writeAuditTrail(this.prisma, {
      entity: "ErpFieldMapping",
      entityId,
      action: AuditAction.UPDATE,
      module: "erp-integration",
      metadata: { event } as Prisma.InputJsonValue,
      beforeData: before as Prisma.InputJsonValue,
      afterData: after as Prisma.InputJsonValue
    });
  }

  async ensureDefaults(tenantId: string) {
    const count = await this.prisma.erpFieldMapping.count({ where: { tenantId } });
    if (count > 0) return;
    await this.prisma.erpFieldMapping.createMany({
      data: DEFAULT_FIELD_MAPPINGS.map((m) => ({
        tenantId,
        sourceSystem: "BILEETA",
        sourceField: m.sourceField,
        targetModel: m.targetModel,
        targetField: m.targetField,
        required: m.required,
        active: true
      }))
    });
  }

  async findAll() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view ERP mappings");
    const tenantId = this.tenantId();
    await this.ensureDefaults(tenantId);
    return this.prisma.erpFieldMapping.findMany({ where: { tenantId }, orderBy: [{ targetModel: "asc" }, { sourceField: "asc" }] });
  }

  async create(dto: CreateErpMappingDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage ERP mappings");
    const tenantId = this.tenantId();
    const created = await this.prisma.erpFieldMapping.create({
      data: {
        tenantId,
        sourceSystem: dto.sourceSystem ?? "BILEETA",
        sourceField: dto.sourceField,
        targetModel: dto.targetModel,
        targetField: dto.targetField,
        transformRule: dto.transformRule,
        required: dto.required ?? false,
        active: dto.active ?? true,
        notes: dto.notes
      }
    });
    await this.audit("erp_mapping_created", created.id, null, created);
    return created;
  }

  async update(id: string, dto: UpdateErpMappingDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage ERP mappings");
    const tenantId = this.tenantId();
    const existing = await this.prisma.erpFieldMapping.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("ERP mapping not found");
    const updated = await this.prisma.erpFieldMapping.update({
      where: { id },
      data: { transformRule: dto.transformRule, required: dto.required, active: dto.active, notes: dto.notes }
    });
    await this.audit("erp_mapping_updated", id, existing, updated);
    return updated;
  }

  async countPending() {
    const tenantId = this.tenantId();
    await this.ensureDefaults(tenantId);
    return this.prisma.erpFieldMapping.count({ where: { tenantId, active: false } });
  }
}
