import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, RoleName, TrainingStatus } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { createPaginationMeta } from "../../common/utils/pagination-meta";
import { clampPage, clampPageSize } from "../../common/utils/pagination.util";
import { PrismaService } from "../../database/prisma.service";
import { TRAINING_CHECKLISTS } from "./operations.constants";
import { sanitizeOperationsText } from "./operations-sanitize.util";
import type { CreateTrainingDto, OperationsListQueryDto, UpdateTrainingDto } from "./dto/operations.dto";

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const c = requestContext.get();
    return { actorId: c?.actorId ?? null, actorRole: c?.actorRole ?? null, tenantId: c?.tenantId ?? null, permissions: c?.permissions ?? [] };
  }

  private requireActorId() {
    const { actorId } = this.ctx();
    if (!actorId) throw new ForbiddenException("You do not have permission to perform this action");
    return actorId;
  }

  private requireTenantId() {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole !== RoleName.SUPER_ADMIN && !tenantId) throw new ForbiddenException("Tenant context required");
    return tenantId;
  }

  canManage() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("operations.manage") || permissions.includes("training.manage");
  }

  canView() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("operations.view") || this.canManage();
  }

  private async nextNo(tenantId: string | null) {
    const count = await this.prisma.trainingSession.count({ where: tenantId ? { tenantId } : {} });
    return `TRN-${String(count + 1).padStart(4, "0")}`;
  }

  async findAll(query: OperationsListQueryDto) {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view training");
    const tenantId = this.requireTenantId();
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const where: Prisma.TrainingSessionWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(query.status ? { status: query.status as TrainingStatus } : {}),
      ...(query.category ? { category: query.category as never } : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.trainingSession.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.trainingSession.count({ where })
    ]);
    return { items, meta: createPaginationMeta(page, pageSize, total) };
  }

  async create(dto: CreateTrainingDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage training");
    const tenantId = this.requireTenantId();
    const actorId = this.requireActorId();
    const checklistItems = dto.checklistItems ?? TRAINING_CHECKLISTS[dto.category] ?? [];
    const session = await this.prisma.trainingSession.create({
      data: {
        tenantId,
        trainingSessionNo: await this.nextNo(tenantId),
        role: dto.role,
        category: dto.category,
        traineeUserId: dto.traineeUserId,
        trainerUserId: dto.trainerUserId ?? actorId,
        module: dto.module?.trim() || null,
        checklistItems: checklistItems as Prisma.InputJsonValue,
        trainingDate: dto.trainingDate ? new Date(dto.trainingDate) : null,
        status: TrainingStatus.NOT_STARTED
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "TrainingSession",
      entityId: session.id,
      action: AuditAction.CREATE,
      module: "post-go-live",
      metadata: { event: "training_created", category: dto.category }
    });
    return session;
  }

  async update(id: string, dto: UpdateTrainingDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage training");
    const tenantId = this.requireTenantId();
    const existing = await this.prisma.trainingSession.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Training session not found");
    return this.prisma.trainingSession.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.evidence !== undefined ? { evidence: sanitizeOperationsText(dto.evidence) } : {}),
        ...(dto.notes !== undefined ? { notes: sanitizeOperationsText(dto.notes) } : {}),
        ...(dto.trainingDate !== undefined ? { trainingDate: new Date(dto.trainingDate) } : {})
      }
    });
  }

  async complete(id: string) {
    if (!this.canManage()) throw new ForbiddenException("Only authorized trainers can mark training complete");
    const tenantId = this.requireTenantId();
    const actorId = this.requireActorId();
    const existing = await this.prisma.trainingSession.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Training session not found");
    const updated = await this.prisma.trainingSession.update({
      where: { id },
      data: { status: TrainingStatus.COMPLETED, signOffByUserId: actorId, trainingDate: existing.trainingDate ?? new Date() }
    });
    await writeAuditTrail(this.prisma, {
      entity: "TrainingSession",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      metadata: { event: "training_completed" }
    });
    return updated;
  }

  async markRetraining(id: string, reason?: string) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage training");
    const tenantId = this.requireTenantId();
    const existing = await this.prisma.trainingSession.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Training session not found");
    const updated = await this.prisma.trainingSession.update({
      where: { id },
      data: { status: TrainingStatus.NEEDS_RETRAINING, notes: reason ? sanitizeOperationsText(reason) : existing.notes }
    });
    await writeAuditTrail(this.prisma, {
      entity: "TrainingSession",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      reason,
      metadata: { event: "training_retraining_required" }
    });
    return updated;
  }

  async completionStats() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view training");
    const tenantId = this.requireTenantId();
    const items = await this.prisma.trainingSession.findMany({ where: tenantId ? { tenantId } : {} });
    const completed = items.filter((i) => i.status === TrainingStatus.COMPLETED).length;
    return {
      total: items.length,
      completed,
      completionPercentage: items.length ? Math.round((completed / items.length) * 100) : 0,
      byCategory: Object.keys(TRAINING_CHECKLISTS).map((cat) => ({
        category: cat,
        total: items.filter((i) => i.category === cat).length,
        completed: items.filter((i) => i.category === cat && i.status === TrainingStatus.COMPLETED).length
      }))
    };
  }
}
