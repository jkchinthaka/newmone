import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, HypercareReadinessStatus, Prisma, RoleName, SupportTicketSeverity, SupportTicketStatus } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { HYPERCARE_DAILY_CHECKLIST } from "./operations.constants";
import { sanitizeOperationsText } from "./operations-sanitize.util";
import type { CompleteHypercareDto, CreateHypercareDto, ExtendHypercareDto, UpdateHypercareDto } from "./dto/operations.dto";

@Injectable()
export class HypercareService {
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
    return permissions.includes("hypercare.manage") || permissions.includes("operations.manage");
  }

  canView() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("operations.view") || this.canManage();
  }

  async findAll() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view hypercare");
    const tenantId = this.requireTenantId();
    return this.prisma.hypercarePlan.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { startDate: "desc" }
    });
  }

  async create(dto: CreateHypercareDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage hypercare");
    const tenantId = this.requireTenantId();
    const openCritical = await this.prisma.supportTicket.count({
      where: {
        ...(tenantId ? { tenantId } : {}),
        severity: SupportTicketSeverity.CRITICAL,
        status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.DUPLICATE] }
      }
    });
    const plan = await this.prisma.hypercarePlan.create({
      data: {
        tenantId,
        hypercarePeriodName: dto.hypercarePeriodName.trim(),
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        supportOwner: dto.supportOwner?.trim() || null,
        dailyChecklist: HYPERCARE_DAILY_CHECKLIST as Prisma.InputJsonValue,
        openCriticalIssues: openCritical,
        readinessStatus: HypercareReadinessStatus.ACTIVE
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "HypercarePlan",
      entityId: plan.id,
      action: AuditAction.CREATE,
      module: "post-go-live",
      metadata: { event: "hypercare_created" }
    });
    return plan;
  }

  async update(id: string, dto: UpdateHypercareDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage hypercare");
    const tenantId = this.requireTenantId();
    const existing = await this.prisma.hypercarePlan.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Hypercare plan not found");
    return this.prisma.hypercarePlan.update({
      where: { id },
      data: {
        ...(dto.readinessStatus !== undefined ? { readinessStatus: dto.readinessStatus } : {}),
        ...(dto.userFeedback !== undefined ? { userFeedback: sanitizeOperationsText(dto.userFeedback) } : {}),
        ...(dto.trainingGaps !== undefined ? { trainingGaps: sanitizeOperationsText(dto.trainingGaps) } : {}),
        ...(dto.dailyIssueCount !== undefined ? { dailyIssueCount: dto.dailyIssueCount } : {})
      }
    });
  }

  async extend(id: string, dto: ExtendHypercareDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage hypercare");
    const tenantId = this.requireTenantId();
    const existing = await this.prisma.hypercarePlan.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Hypercare plan not found");
    const updated = await this.prisma.hypercarePlan.update({
      where: { id },
      data: {
        endDate: new Date(dto.endDate),
        readinessStatus: HypercareReadinessStatus.EXTENDED,
        extensionReason: sanitizeOperationsText(dto.reason)
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "HypercarePlan",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      reason: dto.reason,
      metadata: { event: "hypercare_extended" }
    });
    return updated;
  }

  async complete(id: string, dto: CompleteHypercareDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage hypercare");
    const tenantId = this.requireTenantId();
    const actorId = this.requireActorId();
    const existing = await this.prisma.hypercarePlan.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Hypercare plan not found");

    const openCritical = await this.prisma.supportTicket.count({
      where: {
        ...(tenantId ? { tenantId } : {}),
        severity: SupportTicketSeverity.CRITICAL,
        status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.DUPLICATE] }
      }
    });
    if (openCritical > 0) {
      throw new BadRequestException("Hypercare cannot close while open critical support tickets exist");
    }

    const updated = await this.prisma.hypercarePlan.update({
      where: { id },
      data: {
        readinessStatus: HypercareReadinessStatus.COMPLETED,
        signOffByUserId: actorId,
        completedAt: new Date(),
        userFeedback: dto.notes ? sanitizeOperationsText(dto.notes) : existing.userFeedback
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "HypercarePlan",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      metadata: { event: "hypercare_completed" }
    });
    return updated;
  }

  async activePlan() {
    const tenantId = this.requireTenantId();
    return this.prisma.hypercarePlan.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
        readinessStatus: { in: [HypercareReadinessStatus.ACTIVE, HypercareReadinessStatus.EXTENDED, HypercareReadinessStatus.NEEDS_ATTENTION] }
      },
      orderBy: { startDate: "desc" }
    });
  }
}
