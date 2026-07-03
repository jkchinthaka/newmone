import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, ChangeRequestStatus, Prisma, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { createPaginationMeta } from "../../common/utils/pagination-meta";
import { clampPage, clampPageSize } from "../../common/utils/pagination.util";
import { PrismaService } from "../../database/prisma.service";
import { sanitizeOperationsText } from "./operations-sanitize.util";
import type {
  ApproveChangeRequestDto,
  ChangeRequestStatusDto,
  CreateChangeRequestDto,
  OperationsListQueryDto,
  RejectChangeRequestDto
} from "./dto/operations.dto";

@Injectable()
export class ChangeRequestsService {
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
    return permissions.includes("change_request.manage");
  }

  canCreate() {
    const { permissions } = this.ctx();
    return this.canManage() || permissions.includes("change_request.create");
  }

  canApprove() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN || actorRole === RoleName.MANAGER) return true;
    return permissions.includes("change_request.approve");
  }

  private async nextNo(tenantId: string | null) {
    const count = await this.prisma.changeRequest.count({ where: tenantId ? { tenantId } : {} });
    return `CR-${String(count + 1).padStart(4, "0")}`;
  }

  async findAll(query: OperationsListQueryDto) {
    const tenantId = this.requireTenantId();
    const actorId = this.requireActorId();
    const canManage = this.canManage();
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const where: Prisma.ChangeRequestWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(query.status ? { status: query.status as ChangeRequestStatus } : {}),
      ...(!canManage ? { requestedByUserId: actorId } : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.changeRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.changeRequest.count({ where })
    ]);
    return { items, meta: createPaginationMeta(page, pageSize, total) };
  }

  async findOne(id: string) {
    const tenantId = this.requireTenantId();
    const cr = await this.prisma.changeRequest.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!cr) throw new NotFoundException("Change request not found");
    const { actorId } = this.ctx();
    if (!this.canManage() && cr.requestedByUserId !== actorId) {
      throw new ForbiddenException("You do not have permission to view this change request");
    }
    return cr;
  }

  async create(dto: CreateChangeRequestDto) {
    if (!this.canCreate()) throw new ForbiddenException("You do not have permission to create change requests");
    const tenantId = this.requireTenantId();
    const actorId = this.requireActorId();
    const cr = await this.prisma.changeRequest.create({
      data: {
        tenantId,
        crNo: await this.nextNo(tenantId),
        title: dto.title.trim(),
        description: sanitizeOperationsText(dto.description),
        requestedByUserId: actorId,
        department: dto.department?.trim() || null,
        affectedModule: dto.affectedModule?.trim() || null,
        businessReason: dto.businessReason ? sanitizeOperationsText(dto.businessReason) : null,
        priority: dto.priority ?? "MEDIUM",
        impactLevel: dto.impactLevel ?? "MEDIUM",
        estimatedEffort: dto.estimatedEffort?.trim() || null,
        estimatedCost: dto.estimatedCost ?? null,
        linkedTicketId: dto.linkedTicketId ?? null,
        status: ChangeRequestStatus.REQUESTED
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "ChangeRequest",
      entityId: cr.id,
      action: AuditAction.CREATE,
      module: "post-go-live",
      metadata: { event: "change_request_created" }
    });
    return cr;
  }

  async approve(id: string, dto: ApproveChangeRequestDto) {
    if (!this.canApprove()) throw new ForbiddenException("Manager or admin approval is required");
    const tenantId = this.requireTenantId();
    const actorId = this.requireActorId();
    const existing = await this.prisma.changeRequest.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Change request not found");
    if (existing.requestedByUserId === actorId && !this.canManage()) {
      throw new ForbiddenException("You cannot approve your own change request");
    }
    const updated = await this.prisma.changeRequest.update({
      where: { id },
      data: {
        status: ChangeRequestStatus.APPROVED,
        approvedByUserId: actorId,
        approvalNote: dto.approvalNote ? sanitizeOperationsText(dto.approvalNote) : null
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "ChangeRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      metadata: { event: "change_request_approved" },
      beforeData: existing as object,
      afterData: updated as object
    });
    return updated;
  }

  async reject(id: string, dto: RejectChangeRequestDto) {
    if (!this.canApprove()) throw new ForbiddenException("Manager or admin approval is required");
    const tenantId = this.requireTenantId();
    const existing = await this.prisma.changeRequest.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Change request not found");
    const updated = await this.prisma.changeRequest.update({
      where: { id },
      data: {
        status: ChangeRequestStatus.REJECTED,
        rejectionReason: sanitizeOperationsText(dto.rejectionReason)
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "ChangeRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      reason: dto.rejectionReason,
      metadata: { event: "change_request_rejected" }
    });
    return updated;
  }

  async changeStatus(id: string, dto: ChangeRequestStatusDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage change requests");
    const tenantId = this.requireTenantId();
    const existing = await this.prisma.changeRequest.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Change request not found");
    if (dto.status === ChangeRequestStatus.RELEASED && existing.status !== ChangeRequestStatus.SCHEDULED_FOR_RELEASE) {
      throw new BadRequestException("Change must be scheduled for release before marking released");
    }
    const updated = await this.prisma.changeRequest.update({ where: { id }, data: { status: dto.status } });
    await writeAuditTrail(this.prisma, {
      entity: "ChangeRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      reason: dto.reason,
      metadata: { event: "change_request_status_changed", to: dto.status }
    });
    return updated;
  }

  async pendingCount() {
    const tenantId = this.requireTenantId();
    return this.prisma.changeRequest.count({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: { in: [ChangeRequestStatus.REQUESTED, ChangeRequestStatus.UNDER_REVIEW, ChangeRequestStatus.APPROVED] }
      }
    });
  }
}
