import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, QaIssueSeverity, QaIssueStatus, RoleName, RolloutWaveStatus, SupportTicketSeverity, SupportTicketStatus } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import type { CreateRolloutWaveDto, UpdateRolloutWaveDto, WaveActionDto } from "./dto/go-live.dto";

@Injectable()
export class RolloutWavesService {
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
      entity: "RolloutWave",
      entityId,
      action: AuditAction.UPDATE,
      module: "go-live",
      reason,
      metadata: { event } as Prisma.InputJsonValue
    });
  }

  private async countCriticalBlockers(tenantId?: string) {
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

  async findAll() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view rollout waves");
    return this.prisma.rolloutWave.findMany({
      where: this.tenantWhere(),
      orderBy: { waveNo: "asc" }
    });
  }

  async create(dto: CreateRolloutWaveDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage rollout waves");
    const tenantId = this.tenantWhere().tenantId;
    const created = await this.prisma.rolloutWave.create({
      data: {
        tenantId,
        waveNo: dto.waveNo,
        waveName: dto.waveName,
        departments: dto.departments as Prisma.InputJsonValue,
        branches: dto.branches as Prisma.InputJsonValue,
        roles: dto.roles as Prisma.InputJsonValue,
        plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : undefined,
        plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
        successCriteria: dto.successCriteria,
        notes: dto.notes,
        status: RolloutWaveStatus.PLANNED
      }
    });
    await this.audit("rollout_wave_created", created.id);
    return created;
  }

  async update(id: string, dto: UpdateRolloutWaveDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage rollout waves");
    const existing = await this.prisma.rolloutWave.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Rollout wave not found");

    return this.prisma.rolloutWave.update({
      where: { id },
      data: {
        waveName: dto.waveName,
        status: dto.status,
        blockers: dto.blockers as Prisma.InputJsonValue,
        notes: dto.notes
      }
    });
  }

  async start(id: string) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage rollout waves");
    const where = this.tenantWhere();
    const existing = await this.prisma.rolloutWave.findFirst({ where: { id, ...where } });
    if (!existing) throw new NotFoundException("Rollout wave not found");

    const priorActive = await this.prisma.rolloutWave.findFirst({
      where: { ...where, status: RolloutWaveStatus.ACTIVE, waveNo: { lt: existing.waveNo } }
    });
    if (priorActive) {
      const blockers = await this.countCriticalBlockers(where.tenantId);
      if (blockers > 0) {
        throw new BadRequestException("Next wave cannot start while prior wave has critical blockers");
      }
    }

    const activeWithBlockers = await this.prisma.rolloutWave.findFirst({
      where: { ...where, status: RolloutWaveStatus.ACTIVE, id: { not: id } }
    });
    if (activeWithBlockers) {
      const blockers = await this.countCriticalBlockers(where.tenantId);
      if (blockers > 0) {
        throw new BadRequestException("Cannot start wave while another active wave has critical blockers");
      }
    }

    const updated = await this.prisma.rolloutWave.update({
      where: { id },
      data: { status: RolloutWaveStatus.ACTIVE, plannedStartDate: existing.plannedStartDate ?? new Date() }
    });
    await this.audit("rollout_wave_started", id);
    return updated;
  }

  async complete(id: string, dto: WaveActionDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage rollout waves");
    const existing = await this.prisma.rolloutWave.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Rollout wave not found");

    const actorId = this.ctx().actorId;
    const updated = await this.prisma.rolloutWave.update({
      where: { id },
      data: {
        status: RolloutWaveStatus.COMPLETED,
        plannedEndDate: new Date(),
        signOffByUserId: actorId ?? undefined,
        signOffAt: new Date(),
        notes: dto.reason ? [existing.notes, dto.reason].filter(Boolean).join("\n") : existing.notes
      }
    });
    await this.audit("rollout_wave_completed", id, dto.reason);
    return updated;
  }

  async pause(id: string, dto: WaveActionDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage rollout waves");
    const existing = await this.prisma.rolloutWave.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Rollout wave not found");
    if (!dto.reason?.trim()) throw new BadRequestException("Pause requires reason");

    const updated = await this.prisma.rolloutWave.update({
      where: { id },
      data: {
        status: RolloutWaveStatus.PAUSED,
        notes: [existing.notes, `Paused: ${dto.reason}`].filter(Boolean).join("\n")
      }
    });
    await this.audit("rollout_wave_paused", id, dto.reason);
    return updated;
  }
}
