import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, CutoverItemStatus, Prisma, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { CUTOVER_CATEGORY_CATALOG, isCutoverPassing } from "./go-live.constants";
import type { CreateCutoverItemDto, UpdateCutoverItemDto } from "./dto/go-live.dto";

@Injectable()
export class CutoverChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const c = requestContext.get();
    return {
      actorId: c?.actorId ?? null,
      actorRole: c?.actorRole ?? null,
      tenantId: c?.tenantId ?? null,
      permissions: c?.permissions ?? []
    };
  }

  canManage(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("go_live.manage");
  }

  canView(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("go_live.view") || permissions.includes("go_live.manage");
  }

  private tenantId(): string {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN && tenantId) return tenantId;
    if (!tenantId) throw new BadRequestException("Tenant context is required");
    return tenantId;
  }

  private async audit(event: string, entityId: string, before?: unknown, after?: unknown, reason?: string) {
    await writeAuditTrail(this.prisma, {
      entity: "CutoverChecklistItem",
      entityId,
      action: AuditAction.UPDATE,
      module: "go-live",
      reason,
      metadata: { event } as Prisma.InputJsonValue,
      beforeData: before as Prisma.InputJsonValue,
      afterData: after as Prisma.InputJsonValue
    });
  }

  async ensureBootstrap(tenantId: string) {
    const existing = await this.prisma.cutoverChecklistItem.count({ where: { tenantId } });
    if (existing > 0) return;

    const rows = CUTOVER_CATEGORY_CATALOG.flatMap((cat) =>
      cat.items.map((item) => ({
        tenantId,
        itemKey: item.itemKey,
        category: cat.key,
        title: item.title,
        description: item.description,
        blocker: item.blocker ?? false,
        status: CutoverItemStatus.NOT_STARTED
      }))
    );
    await this.prisma.cutoverChecklistItem.createMany({ data: rows });
  }

  async findAll() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view cutover checklist");
    const tenantId = this.tenantId();
    await this.ensureBootstrap(tenantId);
    return this.prisma.cutoverChecklistItem.findMany({
      where: { tenantId },
      orderBy: [{ category: "asc" }, { title: "asc" }]
    });
  }

  async getCompletionStats() {
    const tenantId = this.tenantId();
    await this.ensureBootstrap(tenantId);
    const items = await this.prisma.cutoverChecklistItem.findMany({ where: { tenantId } });
    const total = items.length || 1;
    const passed = items.filter((i) => isCutoverPassing(i.status)).length;
    return { total: items.length, passed, completionPercentage: Math.round((passed / total) * 100) };
  }

  isBackupReady(): Promise<boolean> {
    return this.isCategoryReady("BACKUP_READY");
  }

  async isCategoryReady(category: string): Promise<boolean> {
    const tenantId = this.tenantId();
    await this.ensureBootstrap(tenantId);
    const blockers = await this.prisma.cutoverChecklistItem.findMany({
      where: { tenantId, category: category as never, blocker: true }
    });
    if (!blockers.length) return true;
    return blockers.every((i) => isCutoverPassing(i.status));
  }

  async isTrainingReady(): Promise<boolean> {
    const tenantId = this.tenantId();
    await this.ensureBootstrap(tenantId);
    const trainingItems = await this.prisma.cutoverChecklistItem.findMany({
      where: { tenantId, category: "TRAINING_READY", blocker: true }
    });
    return trainingItems.every((i) => isCutoverPassing(i.status));
  }

  async createItem(dto: CreateCutoverItemDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage cutover checklist");
    const tenantId = this.tenantId();
    const itemKey = `custom.${dto.title.toLowerCase().replace(/\s+/g, "_").slice(0, 40)}`;
    const created = await this.prisma.cutoverChecklistItem.create({
      data: {
        tenantId,
        itemKey,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        blocker: dto.blocker ?? false,
        status: CutoverItemStatus.NOT_STARTED
      }
    });
    await this.audit("cutover_item_updated", created.id, null, created);
    return created;
  }

  async updateItem(id: string, dto: UpdateCutoverItemDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage cutover checklist");
    const tenantId = this.tenantId();
    const existing = await this.prisma.cutoverChecklistItem.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Cutover item not found");

    if (dto.status === CutoverItemStatus.ACCEPTED_RISK && !dto.reason?.trim()) {
      throw new BadRequestException("Accepted risk requires a reason");
    }

    const actorId = this.ctx().actorId;
    const updated = await this.prisma.cutoverChecklistItem.update({
      where: { id },
      data: {
        status: dto.status,
        owner: dto.owner,
        evidence: dto.evidence,
        notes: dto.notes,
        completedByUserId: dto.status && isCutoverPassing(dto.status) ? actorId : existing.completedByUserId,
        completedAt: dto.status && isCutoverPassing(dto.status) ? new Date() : existing.completedAt
      }
    });
    await this.audit("cutover_item_updated", id, existing, updated, dto.reason);
    return updated;
  }
}
