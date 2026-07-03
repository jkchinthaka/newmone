import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AuditAction,
  Prisma,
  QaIssueCategory,
  QaIssueSeverity,
  QaIssueStatus,
  QaEnvironment,
  RoleName,
  SupportTicketSeverity,
  SupportTicketStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { createPaginationMeta } from "../../common/utils/pagination-meta";
import { clampPage, clampPageSize } from "../../common/utils/pagination.util";
import { PrismaService } from "../../database/prisma.service";
import { computeSlaDueDates, DEFAULT_ESCALATION_RULES, mapPriorityToSla } from "./operations.constants";
import {
  containsSecretPatterns,
  sanitizeOperationsText,
  sanitizeTicketForViewer
} from "./operations-sanitize.util";
import type {
  AssignTicketDto,
  CloseTicketDto,
  CreateEscalationRuleDto,
  CreateSupportTicketDto,
  OperationsListQueryDto,
  ReopenTicketDto,
  ResolveTicketDto,
  TicketStatusDto,
  UpdateEscalationRuleDto,
  UpdateSupportTicketDto
} from "./dto/operations.dto";

@Injectable()
export class SupportTicketsService {
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

  private requireActorId() {
    const { actorId } = this.ctx();
    if (!actorId) throw new ForbiddenException("You do not have permission to perform this action");
    return actorId;
  }

  private requireTenantId(): string | null {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole !== RoleName.SUPER_ADMIN && !tenantId) {
      throw new BadRequestException("Tenant context is required");
    }
    return tenantId;
  }

  canManageSupport() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("support.manage") || permissions.includes("operations.manage");
  }

  canCreateSupport() {
    const { actorRole, permissions } = this.ctx();
    if (this.canManageSupport()) return true;
    return permissions.includes("support.create");
  }

  canViewTickets() {
    const { permissions } = this.ctx();
    return this.canManageSupport() || permissions.includes("operations.view") || permissions.includes("support.create");
  }

  canViewSensitive() {
    return this.canManageSupport();
  }

  private tenantWhere() {
    const tenantId = this.requireTenantId();
    return tenantId ? { tenantId } : {};
  }

  private async nextTicketNo(tenantId: string | null) {
    const count = await this.prisma.supportTicket.count({ where: tenantId ? { tenantId } : {} });
    return `SUP-${String(count + 1).padStart(4, "0")}`;
  }

  private mapTicket(ticket: Record<string, unknown>) {
    return sanitizeTicketForViewer(ticket, this.canViewSensitive());
  }

  private async audit(event: string, entityId: string, before?: object, after?: object, reason?: string) {
    await writeAuditTrail(this.prisma, {
      entity: "SupportTicket",
      entityId,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      reason,
      metadata: { event } as Prisma.InputJsonValue,
      beforeData: before as Prisma.InputJsonValue,
      afterData: after as Prisma.InputJsonValue
    });
  }

  async ensureEscalationDefaults() {
    const tenantId = this.requireTenantId();
    const count = await this.prisma.escalationRule.count({ where: tenantId ? { tenantId } : {} });
    if (count > 0) return;
    for (const rule of DEFAULT_ESCALATION_RULES) {
      await this.prisma.escalationRule.create({
        data: {
          tenantId,
          category: rule.category,
          severity: rule.severity,
          escalationLevel: rule.escalationLevel,
          responsibleRole: rule.responsibleRole,
          escalationAfterMinutes: rule.escalationAfterMinutes,
          notificationMethod: rule.notificationMethod
        }
      });
    }
  }

  async recalculateSlaBreaches() {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to manage SLA");
    const tenantId = this.requireTenantId();
    const now = new Date();
    const openStatuses: SupportTicketStatus[] = [
      SupportTicketStatus.OPEN,
      SupportTicketStatus.ACKNOWLEDGED,
      SupportTicketStatus.ASSIGNED,
      SupportTicketStatus.IN_PROGRESS,
      SupportTicketStatus.WAITING_USER,
      SupportTicketStatus.WAITING_VENDOR,
      SupportTicketStatus.REOPENED
    ];
    const tickets = await this.prisma.supportTicket.findMany({
      where: { ...(tenantId ? { tenantId } : {}), status: { in: openStatuses } }
    });

    let updated = 0;
    for (const ticket of tickets) {
      const firstBreached = !ticket.firstResponseAt && ticket.firstResponseDueAt && ticket.firstResponseDueAt < now;
      const resolutionBreached = !ticket.resolvedAt && ticket.resolutionDueAt && ticket.resolutionDueAt < now;
      if (firstBreached !== ticket.firstResponseBreached || resolutionBreached !== ticket.resolutionBreached) {
        await this.prisma.supportTicket.update({
          where: { id: ticket.id },
          data: {
            firstResponseBreached: Boolean(firstBreached),
            resolutionBreached: Boolean(resolutionBreached)
          }
        });
        updated += 1;
        if (resolutionBreached && ticket.severity === SupportTicketSeverity.CRITICAL) {
          await this.escalateTicket(ticket.id, "sla_breached");
        }
      }
    }
    return { recalculated: tickets.length, updated };
  }

  private async escalateTicket(ticketId: string, reason: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id: ticketId, ...this.tenantWhere() } });
    if (!ticket) return;
    const nextLevel = Math.min(ticket.escalationLevel + 1, 4);
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { escalationLevel: nextLevel, escalatedAt: new Date() }
    });
    await writeAuditTrail(this.prisma, {
      entity: "SupportTicket",
      entityId: ticketId,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      reason,
      metadata: { event: "sla_escalated", level: nextLevel }
    });
    return updated;
  }

  private async maybeCreateQaIssue(ticket: { id: string; title: string; description: string; tenantId: string | null }) {
    const tenantId = ticket.tenantId;
    const count = await this.prisma.qaIssue.count({ where: tenantId ? { tenantId } : {} });
    const issue = await this.prisma.qaIssue.create({
      data: {
        tenantId,
        issueNo: `QA-${String(count + 1).padStart(4, "0")}`,
        title: `Support: ${ticket.title}`,
        description: sanitizeOperationsText(ticket.description),
        category: QaIssueCategory.BACKEND_ERROR,
        severity: QaIssueSeverity.CRITICAL,
        status: QaIssueStatus.REPORTED,
        environment: QaEnvironment.PRODUCTION,
        reportedByUserId: this.requireActorId(),
        affectedModule: "Post-Go-Live Support",
        regressionRequired: true,
        firstDetectedAt: new Date()
      }
    });
    await this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { linkedQaIssueId: issue.id }
    });
    return issue.id;
  }

  async findAll(query: OperationsListQueryDto) {
    if (!this.canViewTickets()) throw new ForbiddenException("You do not have permission to view support tickets");
    const actorId = this.requireActorId();
    const canManage = this.canManageSupport();
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const skip = (page - 1) * pageSize;

    const where: Prisma.SupportTicketWhereInput = {
      ...this.tenantWhere(),
      ...(query.category ? { category: query.category as never } : {}),
      ...(query.priority ? { priority: query.priority as never } : {}),
      ...(query.severity ? { severity: query.severity as never } : {}),
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.assignedTo ? { assignedToUserId: query.assignedTo } : {}),
      ...(query.reportedBy ? { reportedByUserId: query.reportedBy } : {}),
      ...(query.module?.trim() ? { affectedModule: { contains: query.module.trim(), mode: "insensitive" } } : {}),
      ...(!canManage ? { reportedByUserId: actorId } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: "insensitive" } },
              { ticketNo: { contains: query.search.trim(), mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      this.prisma.supportTicket.count({ where })
    ]);

    return { items: items.map((i) => this.mapTicket(i as unknown as Record<string, unknown>)), meta: createPaginationMeta(page, pageSize, total) };
  }

  async findOne(id: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    const { actorId } = this.ctx();
    if (!this.canManageSupport() && ticket.reportedByUserId !== actorId) {
      throw new ForbiddenException("You do not have permission to view this ticket");
    }
    return this.mapTicket(ticket as unknown as Record<string, unknown>);
  }

  async create(dto: CreateSupportTicketDto) {
    if (!this.canCreateSupport()) throw new ForbiddenException("You do not have permission to create support tickets");
    const tenantId = this.requireTenantId();
    const actorId = this.requireActorId();
    const ticketNo = await this.nextTicketNo(tenantId);
    const severity = dto.severity ?? SupportTicketSeverity.MEDIUM;
    const priority = mapPriorityToSla(dto.priority ?? "MEDIUM", severity);
    const sla = computeSlaDueDates(priority);
    const isSensitive = containsSecretPatterns(dto.description);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        tenantId,
        ticketNo,
        title: dto.title.trim(),
        description: sanitizeOperationsText(dto.description),
        category: dto.category,
        priority,
        severity,
        slaPriority: priority,
        status: SupportTicketStatus.OPEN,
        reportedByUserId: actorId,
        affectedModule: dto.affectedModule?.trim() || null,
        affectedPage: dto.affectedPage?.trim() || null,
        affectedRole: dto.affectedRole?.trim() || null,
        environment: dto.environment ?? "PRODUCTION",
        businessImpact: dto.businessImpact ? sanitizeOperationsText(dto.businessImpact) : null,
        isSensitive,
        firstResponseDueAt: sla.firstResponseDueAt,
        resolutionDueAt: sla.resolutionDueAt
      }
    });

    await writeAuditTrail(this.prisma, {
      entity: "SupportTicket",
      entityId: ticket.id,
      action: AuditAction.CREATE,
      module: "post-go-live",
      metadata: { event: "support_ticket_created", category: dto.category }
    });

    if (severity === SupportTicketSeverity.CRITICAL && ticket.environment === "PRODUCTION") {
      await this.maybeCreateQaIssue(ticket);
    }

    return this.mapTicket(ticket as unknown as Record<string, unknown>);
  }

  async update(id: string, dto: UpdateSupportTicketDto) {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to manage support tickets");
    const existing = await this.prisma.supportTicket.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Ticket not found");

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: sanitizeOperationsText(dto.description) } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority, slaPriority: dto.priority } : {}),
        ...(dto.workaround !== undefined ? { workaround: sanitizeOperationsText(dto.workaround) } : {}),
        ...(dto.rootCause !== undefined ? { rootCause: sanitizeOperationsText(dto.rootCause) } : {})
      }
    });
    await this.audit("support_ticket_status_changed", id, existing as object, updated as object);
    return this.mapTicket(updated as unknown as Record<string, unknown>);
  }

  async acknowledge(id: string) {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to manage support tickets");
    const existing = await this.prisma.supportTicket.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Ticket not found");

    const now = new Date();
    const firstResponseBreached = existing.firstResponseDueAt ? now > existing.firstResponseDueAt : false;
    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: SupportTicketStatus.ACKNOWLEDGED,
        firstResponseAt: now,
        firstResponseBreached: firstResponseBreached || existing.firstResponseBreached
      }
    });
    await this.audit("support_ticket_acknowledged", id, existing as object, updated as object);
    if (firstResponseBreached) await this.escalateTicket(id, "First response SLA breached");
    return this.mapTicket(updated as unknown as Record<string, unknown>);
  }

  async assign(id: string, dto: AssignTicketDto) {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to manage support tickets");
    const existing = await this.prisma.supportTicket.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Ticket not found");

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        assignedToUserId: dto.assignedToUserId,
        status: SupportTicketStatus.ASSIGNED
      }
    });
    await this.audit("support_ticket_assigned", id, existing as object, updated as object, dto.reason);
    return this.mapTicket(updated as unknown as Record<string, unknown>);
  }

  async changeStatus(id: string, dto: TicketStatusDto) {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to manage support tickets");
    const existing = await this.prisma.supportTicket.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Ticket not found");
    if (dto.status === SupportTicketStatus.CLOSED) {
      throw new BadRequestException("Use the close endpoint with a resolution note");
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: { status: dto.status }
    });
    await this.audit("support_ticket_status_changed", id, existing as object, updated as object, dto.reason);
    return this.mapTicket(updated as unknown as Record<string, unknown>);
  }

  async resolve(id: string, dto: ResolveTicketDto) {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to manage support tickets");
    const existing = await this.prisma.supportTicket.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Ticket not found");

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: SupportTicketStatus.RESOLVED,
        resolutionNote: sanitizeOperationsText(dto.resolutionNote),
        rootCause: dto.rootCause ? sanitizeOperationsText(dto.rootCause) : existing.rootCause,
        workaround: dto.workaround ? sanitizeOperationsText(dto.workaround) : existing.workaround,
        resolvedAt: new Date()
      }
    });
    await this.audit("support_ticket_resolved", id, existing as object, updated as object, dto.resolutionNote);
    return this.mapTicket(updated as unknown as Record<string, unknown>);
  }

  async close(id: string, dto: CloseTicketDto) {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to manage support tickets");
    const existing = await this.prisma.supportTicket.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Ticket not found");
    if (existing.severity === SupportTicketSeverity.CRITICAL && !dto.resolutionNote?.trim()) {
      throw new BadRequestException("Critical production tickets require a resolution note to close");
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: SupportTicketStatus.CLOSED,
        resolutionNote: sanitizeOperationsText(dto.resolutionNote),
        closedAt: new Date(),
        resolvedAt: existing.resolvedAt ?? new Date()
      }
    });
    await this.audit("support_ticket_closed", id, existing as object, updated as object, dto.resolutionNote);
    return this.mapTicket(updated as unknown as Record<string, unknown>);
  }

  async reopen(id: string, dto: ReopenTicketDto) {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to manage support tickets");
    const existing = await this.prisma.supportTicket.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Ticket not found");

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: SupportTicketStatus.REOPENED,
        closedAt: null,
        resolvedAt: null
      }
    });
    await this.audit("support_ticket_reopened", id, existing as object, updated as object, dto.reason);
    return this.mapTicket(updated as unknown as Record<string, unknown>);
  }

  async getSlaDashboard() {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to view SLA dashboard");
    await this.recalculateSlaBreaches();
    const tenantId = this.requireTenantId();
    const base = tenantId ? { tenantId } : {};
    const openStatuses = {
      status: {
        notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.DUPLICATE] as SupportTicketStatus[]
      }
    };

    const [breaches, nearBreach, tickets, byPriority, byCategory] = await Promise.all([
      this.prisma.supportTicket.count({
        where: { ...base, OR: [{ firstResponseBreached: true }, { resolutionBreached: true }], ...openStatuses }
      }),
      this.prisma.supportTicket.count({
        where: {
          ...base,
          ...openStatuses,
          resolutionBreached: false,
          resolutionDueAt: { lte: new Date(Date.now() + 2 * 60 * 60_000) }
        }
      }),
      this.prisma.supportTicket.findMany({ where: { ...base, ...openStatuses }, take: 200 }),
      this.prisma.supportTicket.groupBy({ by: ["priority"], where: { ...base, ...openStatuses }, _count: true }),
      this.prisma.supportTicket.groupBy({ by: ["category"], where: { ...base, ...openStatuses }, _count: true })
    ]);

    const withResponse = tickets.filter((t) => t.firstResponseAt);
    const withResolution = tickets.filter((t) => t.resolvedAt);
    const avgFirstResponseMs =
      withResponse.length > 0
        ? withResponse.reduce((sum, t) => sum + (t.firstResponseAt!.getTime() - t.createdAt.getTime()), 0) /
          withResponse.length
        : 0;
    const avgResolutionMs =
      withResolution.length > 0
        ? withResolution.reduce((sum, t) => sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()), 0) /
          withResolution.length
        : 0;

    return {
      openSlaBreaches: breaches,
      ticketsNearBreach: nearBreach,
      avgFirstResponseMinutes: Math.round(avgFirstResponseMs / 60_000),
      avgResolutionMinutes: Math.round(avgResolutionMs / 60_000),
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count })),
      byCategory: byCategory.map((r) => ({ category: r.category, count: r._count }))
    };
  }

  async getSlaBreaches() {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to view SLA breaches");
    const items = await this.prisma.supportTicket.findMany({
      where: {
        ...this.tenantWhere(),
        OR: [{ firstResponseBreached: true }, { resolutionBreached: true }],
        status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.DUPLICATE] }
      },
      orderBy: { createdAt: "desc" }
    });
    return items.map((i) => this.mapTicket(i as unknown as Record<string, unknown>));
  }

  async listEscalationMatrix() {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to view escalation matrix");
    await this.ensureEscalationDefaults();
    return this.prisma.escalationRule.findMany({
      where: { ...this.tenantWhere(), active: true },
      orderBy: { escalationLevel: "asc" }
    });
  }

  async createEscalationRule(dto: CreateEscalationRuleDto) {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to manage escalation");
    const tenantId = this.requireTenantId();
    return this.prisma.escalationRule.create({
      data: {
        tenantId,
        category: dto.category ?? null,
        severity: dto.severity ?? null,
        escalationLevel: dto.escalationLevel,
        responsibleRole: dto.responsibleRole,
        responsibleUserId: dto.responsibleUserId ?? null,
        responseTimeMinutes: dto.responseTimeMinutes ?? null,
        escalationAfterMinutes: dto.escalationAfterMinutes,
        notificationMethod: dto.notificationMethod ?? "SYSTEM"
      }
    });
  }

  async updateEscalationRule(id: string, dto: UpdateEscalationRuleDto) {
    if (!this.canManageSupport()) throw new ForbiddenException("You do not have permission to manage escalation");
    const existing = await this.prisma.escalationRule.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Escalation rule not found");
    return this.prisma.escalationRule.update({
      where: { id },
      data: {
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.escalationAfterMinutes !== undefined ? { escalationAfterMinutes: dto.escalationAfterMinutes } : {}),
        ...(dto.responsibleRole !== undefined ? { responsibleRole: dto.responsibleRole } : {})
      }
    });
  }
}
