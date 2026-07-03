import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import type { CreateRollbackPlanDto, UpdateRollbackPlanDto } from "./dto/go-live.dto";

@Injectable()
export class RollbackPlanService {
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

  private tenantWhere(): { tenantId?: string } {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN && !tenantId) return {};
    if (!tenantId) throw new BadRequestException("Tenant context is required");
    return { tenantId };
  }

  private async audit(event: string, entityId: string, reason?: string) {
    await writeAuditTrail(this.prisma, {
      entity: "RollbackPlan",
      entityId,
      action: AuditAction.UPDATE,
      module: "go-live",
      reason,
      metadata: { event } as Prisma.InputJsonValue
    });
  }

  private async nextPlanNo(tenantId?: string) {
    const count = await this.prisma.rollbackPlan.count({ where: tenantId ? { tenantId } : {} });
    return `RB-${String(count + 1).padStart(4, "0")}`;
  }

  async findActive() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view rollback plan");
    return this.prisma.rollbackPlan.findFirst({
      where: { ...this.tenantWhere(), active: true },
      orderBy: { updatedAt: "desc" }
    });
  }

  async findAll() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view rollback plans");
    return this.prisma.rollbackPlan.findMany({
      where: this.tenantWhere(),
      orderBy: { createdAt: "desc" }
    });
  }

  async create(dto: CreateRollbackPlanDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage rollback plan");
    const tenantId = this.tenantWhere().tenantId;
    const actorId = this.ctx().actorId;

    if (!dto.rollbackSteps?.trim()) {
      throw new BadRequestException("Rollback steps are required");
    }

    await this.prisma.rollbackPlan.updateMany({
      where: { tenantId, active: true },
      data: { active: false }
    });

    const created = await this.prisma.rollbackPlan.create({
      data: {
        tenantId,
        rollbackPlanNo: await this.nextPlanNo(tenantId),
        versionBeforeGoLive: dto.versionBeforeGoLive,
        currentVersion: dto.currentVersion,
        rollbackTrigger: dto.rollbackTrigger,
        rollbackSteps: dto.rollbackSteps,
        databaseRestoreReference: dto.databaseRestoreReference,
        codeCommitReference: dto.codeCommitReference,
        responsibleUserId: dto.responsibleUserId ?? actorId ?? undefined,
        estimatedRollbackMinutes: dto.estimatedRollbackMinutes,
        testedStatus: dto.testedStatus,
        notes: dto.notes,
        active: true
      }
    });
    await this.audit("rollback_plan_created", created.id);
    return created;
  }

  async update(id: string, dto: UpdateRollbackPlanDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage rollback plan");
    const existing = await this.prisma.rollbackPlan.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Rollback plan not found");

    const updated = await this.prisma.rollbackPlan.update({
      where: { id },
      data: {
        versionBeforeGoLive: dto.versionBeforeGoLive,
        currentVersion: dto.currentVersion,
        rollbackTrigger: dto.rollbackTrigger,
        rollbackSteps: dto.rollbackSteps,
        databaseRestoreReference: dto.databaseRestoreReference,
        codeCommitReference: dto.codeCommitReference,
        testedStatus: dto.testedStatus,
        notes: dto.notes
      }
    });
    await this.audit("rollback_plan_updated", id);
    return updated;
  }

  isReady(plan: { rollbackSteps: string | null; databaseRestoreReference: string | null } | null): boolean {
    return Boolean(plan?.rollbackSteps?.trim() && plan?.databaseRestoreReference?.trim());
  }
}
