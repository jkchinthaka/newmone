import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, PilotRolloutStatus, Prisma, QaIssueSeverity, QaIssueStatus, RoleName, SupportTicketSeverity, SupportTicketStatus, TrainingStatus } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { createPaginationMeta } from "../../common/utils/pagination-meta";
import { clampPage, clampPageSize } from "../../common/utils/pagination.util";
import { PrismaService } from "../../database/prisma.service";
import { CutoverChecklistService } from "./cutover-checklist.service";
import type { CreatePilotRolloutDto, ExtendPilotDto, GoLiveListQueryDto, UpdatePilotRolloutDto } from "./dto/go-live.dto";

@Injectable()
export class PilotRolloutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cutover: CutoverChecklistService
  ) {}

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

  private async audit(event: string, entityId: string, reason?: string, metadata?: Record<string, unknown>) {
    await writeAuditTrail(this.prisma, {
      entity: "PilotRollout",
      entityId,
      action: AuditAction.UPDATE,
      module: "go-live",
      reason,
      metadata: { event, ...metadata } as Prisma.InputJsonValue
    });
  }

  private async countCriticalBlockers(tenantId: string | undefined) {
    const where = tenantId ? { tenantId } : {};
    const [qa, tickets] = await Promise.all([
      this.prisma.qaIssue.count({
        where: { ...where, severity: QaIssueSeverity.CRITICAL, status: { notIn: [QaIssueStatus.CLOSED, QaIssueStatus.ACCEPTED_RISK, QaIssueStatus.PASSED] } }
      }),
      this.prisma.supportTicket.count({
        where: { ...where, severity: SupportTicketSeverity.CRITICAL, status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.RESOLVED] } }
      })
    ]);
    return qa + tickets;
  }

  private async refreshMetrics(pilot: { id: string; tenantId: string | null; selectedUsers?: unknown }) {
    const tenantId = pilot.tenantId ?? undefined;
    const where = tenantId ? { tenantId } : {};
    const userIds = Array.isArray(pilot.selectedUsers) ? (pilot.selectedUsers as string[]) : [];

    const [trained, workOrders, issues, blockers] = await Promise.all([
      userIds.length
        ? this.prisma.trainingSession.count({
            where: { tenantId, traineeUserId: { in: userIds }, status: TrainingStatus.COMPLETED }
          })
        : this.prisma.trainingSession.count({ where: { ...where, status: TrainingStatus.COMPLETED } }),
      this.prisma.workOrder.count({ where }),
      this.prisma.supportTicket.count({ where }),
      this.countCriticalBlockers(tenantId)
    ]);

    return this.prisma.pilotRollout.update({
      where: { id: pilot.id },
      data: {
        trainedUsersCount: trained,
        activeUsersCount: userIds.length,
        workOrdersCreated: workOrders,
        issuesReported: issues,
        criticalBlockers: blockers
      }
    });
  }

  async findAll(query: GoLiveListQueryDto) {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view pilot rollouts");
    const where = this.tenantWhere();
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const skip = (page - 1) * pageSize;

    const filter: Prisma.PilotRolloutWhereInput = { ...where };
    if (query.status) filter.status = query.status as PilotRolloutStatus;
    if (query.search) {
      filter.OR = [
        { pilotName: { contains: query.search, mode: "insensitive" } },
        { department: { contains: query.search, mode: "insensitive" } }
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.pilotRollout.findMany({ where: filter, skip, take: pageSize, orderBy: { createdAt: "desc" } }),
      this.prisma.pilotRollout.count({ where: filter })
    ]);
    return { items, meta: createPaginationMeta(total, page, pageSize) };
  }

  async create(dto: CreatePilotRolloutDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage pilot rollouts");
    const tenantId = this.tenantWhere().tenantId;
    const created = await this.prisma.pilotRollout.create({
      data: {
        tenantId,
        pilotName: dto.pilotName,
        department: dto.department,
        branch: dto.branch,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        pilotOwnerUserId: dto.pilotOwnerUserId,
        selectedUsers: dto.selectedUsers as Prisma.InputJsonValue,
        selectedRoles: dto.selectedRoles as Prisma.InputJsonValue,
        selectedModules: dto.selectedModules as Prisma.InputJsonValue,
        successCriteria: dto.successCriteria,
        riskLevel: dto.riskLevel,
        notes: dto.notes,
        status: PilotRolloutStatus.PLANNED
      }
    });
    await this.audit("go_live_pilot_created", created.id);
    return created;
  }

  async update(id: string, dto: UpdatePilotRolloutDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage pilot rollouts");
    const existing = await this.prisma.pilotRollout.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Pilot rollout not found");

    const updated = await this.prisma.pilotRollout.update({
      where: { id },
      data: {
        pilotName: dto.pilotName,
        department: dto.department,
        branch: dto.branch,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        pilotOwnerUserId: dto.pilotOwnerUserId,
        selectedUsers: dto.selectedUsers as Prisma.InputJsonValue,
        status: dto.status,
        userFeedback: dto.userFeedback,
        managerFeedback: dto.managerFeedback,
        pilotResult: dto.pilotResult,
        notes: dto.notes
      }
    });
    return this.refreshMetrics(updated);
  }

  async start(id: string) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage pilot rollouts");
    const existing = await this.prisma.pilotRollout.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Pilot rollout not found");

    if (existing.tenantId) {
      const trainingReady = await this.cutover.isTrainingReady();
      if (!trainingReady) throw new BadRequestException("Pilot cannot start until training checklist items are ready");

      const backupReady = await this.cutover.isBackupReady();
      if (!backupReady) throw new BadRequestException("Pilot cannot start until backup checklist is ready");
    }

    const updated = await this.prisma.pilotRollout.update({
      where: { id },
      data: { status: PilotRolloutStatus.ACTIVE, startDate: existing.startDate ?? new Date() }
    });
    await this.audit("go_live_pilot_started", id);
    return this.refreshMetrics(updated);
  }

  async complete(id: string) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage pilot rollouts");
    const existing = await this.prisma.pilotRollout.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Pilot rollout not found");

    const blockers = await this.countCriticalBlockers(existing.tenantId ?? undefined);
    if (blockers > 0) throw new BadRequestException("Pilot cannot complete while critical blockers are open");

    const updated = await this.prisma.pilotRollout.update({
      where: { id },
      data: { status: PilotRolloutStatus.COMPLETED, endDate: new Date(), criticalBlockers: blockers }
    });
    await this.audit("go_live_pilot_completed", id);
    return updated;
  }

  async extend(id: string, dto: ExtendPilotDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage pilot rollouts");
    const existing = await this.prisma.pilotRollout.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Pilot rollout not found");

    const updated = await this.prisma.pilotRollout.update({
      where: { id },
      data: {
        status: PilotRolloutStatus.EXTENDED,
        endDate: dto.endDate ? new Date(dto.endDate) : existing.endDate,
        notes: [existing.notes, `Extended: ${dto.reason}`].filter(Boolean).join("\n")
      }
    });
    await this.audit("go_live_pilot_extended", id, dto.reason);
    return updated;
  }
}
