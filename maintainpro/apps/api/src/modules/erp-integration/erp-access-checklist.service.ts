import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, ErpAccessChecklistStatus, Prisma, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { ERP_ACCESS_CHECKLIST, type ErpReadinessVerdict } from "./erp.constants";
import type { UpdateAccessChecklistDto } from "./dto/erp.dto";

@Injectable()
export class ErpAccessChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const c = requestContext.get();
    return { actorId: c?.actorId, actorRole: c?.actorRole, permissions: c?.permissions ?? [], tenantId: c?.tenantId };
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

  async ensureBootstrap(tenantId: string) {
    const count = await this.prisma.erpAccessChecklistItem.count({ where: { tenantId } });
    if (count > 0) return;
    await this.prisma.erpAccessChecklistItem.createMany({
      data: ERP_ACCESS_CHECKLIST.map((item) => ({
        tenantId,
        itemKey: item.itemKey,
        title: item.title,
        status: ErpAccessChecklistStatus.NOT_STARTED
      }))
    });
  }

  async findAll() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view ERP access checklist");
    const tenantId = this.tenantId();
    await this.ensureBootstrap(tenantId);
    return this.prisma.erpAccessChecklistItem.findMany({ where: { tenantId }, orderBy: { itemKey: "asc" } });
  }

  computeVerdict(items: { status: ErpAccessChecklistStatus }[]): ErpReadinessVerdict {
    const verified = items.filter((i) => i.status === ErpAccessChecklistStatus.VERIFIED).length;
    const received = items.filter(
      (i) => i.status === ErpAccessChecklistStatus.RECEIVED || i.status === ErpAccessChecklistStatus.VERIFIED
    ).length;
    if (verified >= ERP_ACCESS_CHECKLIST.length) return "READY_FOR_LIVE_API";
    if (verified >= 8) return "READY_FOR_TEST_API";
    if (received > 0) return "NOT_READY";
    return "WAITING_FOR_BILEETA";
  }

  async getReadiness() {
    const items = await this.findAll();
    return {
      verdict: this.computeVerdict(items),
      items,
      title: "Bileeta API Access Readiness"
    };
  }

  async update(id: string, dto: UpdateAccessChecklistDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to update ERP checklist");
    const tenantId = this.tenantId();
    const existing = await this.prisma.erpAccessChecklistItem.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Checklist item not found");
    const updated = await this.prisma.erpAccessChecklistItem.update({
      where: { id },
      data: { status: dto.status, notes: dto.notes, updatedByUserId: this.ctx().actorId ?? undefined }
    });
    await writeAuditTrail(this.prisma, {
      entity: "ErpAccessChecklistItem",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "erp-integration",
      metadata: { event: "erp_access_checklist_updated", status: dto.status } as Prisma.InputJsonValue,
      beforeData: existing as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }
}
