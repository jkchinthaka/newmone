import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AuditAction,
  MaintenanceRequestStatus,
  Prisma,
  Priority,
  RequestRejectionReasonType,
  WorkOrderType
} from "@prisma/client";

import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import { AssetRegistryService } from "../assets/asset-registry.service";
import { NotificationsService } from "../notifications/notifications.service";
import { WorkOrdersService } from "../work-orders/work-orders.service";
import type {
  CancelMaintenanceRequestDto,
  ConvertToWorkOrderDto,
  CreateMaintenanceRequestDto,
  MaintenanceRequestListQueryDto,
  MarkDuplicateDto,
  RejectMaintenanceRequestDto,
  TriageMaintenanceRequestDto
} from "./dto/maintenance-request.dto";
import {
  assertValidTransition,
  DEFAULT_PROBLEM_CATEGORIES,
  humanRequestStatus,
  isActiveRequestStatus
} from "./request-lifecycle";

type Actor = {
  sub: string;
  email?: string;
  role?: string;
  tenantId?: string | null;
  permissions?: string[];
};

@Injectable()
export class MaintenanceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetRegistry: AssetRegistryService,
    private readonly workOrders: WorkOrdersService,
    private readonly notifications: NotificationsService
  ) {}

  async seedProblemCategories(tenantId: string | null) {
    const tid = requireTenantId(tenantId);
    let created = 0;
    for (const cat of DEFAULT_PROBLEM_CATEGORIES) {
      const existing = await this.prisma.requestProblemCategory.findUnique({
        where: { tenantId_code: { tenantId: tid, code: cat.code } }
      });
      if (existing) continue;
      await this.prisma.requestProblemCategory.create({
        data: {
          tenantId: tid,
          code: cat.code,
          name: cat.name,
          sortOrder: cat.sortOrder
        }
      });
      created += 1;
    }
    return { created };
  }

  async listProblemCategories(tenantId: string | null) {
    const tid = requireTenantId(tenantId);
    await this.seedProblemCategories(tid);
    const items = await this.prisma.requestProblemCategory.findMany({
      where: { tenantId: tid, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    return { items };
  }

  async create(tenantId: string | null, actor: Actor, dto: CreateMaintenanceRequestDto) {
    const tid = requireTenantId(tenantId);
    if (!actor.sub) throw new ForbiddenException("Authenticated actor required");

    if (dto.idempotencyKey?.trim()) {
      const existing = await this.prisma.maintenanceRequest.findFirst({
        where: { tenantId: tid, idempotencyKey: dto.idempotencyKey.trim() }
      });
      if (existing) {
        return this.findOne(tid, existing.id, actor, { forceAll: true });
      }
    }

    const placement = await this.resolvePlacement(tid, dto);
    const snapshot = await this.buildContextSnapshot(tid, placement);

    const priority = dto.isEmergency
      ? Priority.HIGH
      : dto.priority ?? Priority.MEDIUM;

    const created = await this.createWithNumberRetry(tid, {
      reportedById: actor.sub,
      assetId: placement.assetId,
      siteId: placement.siteId,
      functionalLocationId: placement.functionalLocationId,
      departmentId: placement.departmentId,
      domainId: placement.domainId,
      problemCategoryId: dto.problemCategoryId ?? null,
      problemCategoryLabel: dto.problemCategoryLabel?.trim() || null,
      description: dto.description.trim(),
      priority,
      requestedPriority: dto.priority ?? null,
      affectsOperation: dto.affectsOperation ?? false,
      businessImpact: dto.businessImpact?.trim() || null,
      isEmergency: dto.isEmergency ?? false,
      failureNoticedAt: dto.failureNoticedAt ? new Date(dto.failureNoticedAt) : null,
      contextSnapshot: snapshot as Prisma.InputJsonValue,
      idempotencyKey: dto.idempotencyKey?.trim() || null
    });

    await this.appendHistory(tid, created.id, {
      fromStatus: null,
      toStatus: MaintenanceRequestStatus.NEW,
      action: "CREATED",
      actorId: actor.sub,
      isInternal: false
    });

    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: created.id,
      action: AuditAction.CREATE,
      module: "maintenance-requests",
      actor: actor as never,
      afterData: { requestNumber: created.requestNumber, status: created.status } as never
    });

    if (dto.evidenceIds?.length) {
      await this.attachEvidence(tid, created.id, actor.sub, dto.evidenceIds);
    }

    // Notification fan-out hooks into existing NotificationsService per-user APIs (Phase 12 owns escalation admin).
    void this.notifyNewRequest(tid, created, actor.sub);

    return this.findOne(tid, created.id, actor, { forceAll: true });
  }

  async list(tenantId: string | null, actor: Actor, query: MaintenanceRequestListQueryDto) {
    const tid = requireTenantId(tenantId);
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const canViewAll = this.canViewAll(actor);

    const where: Prisma.MaintenanceRequestWhereInput = { tenantId: tid };

    if (query.mine || (!canViewAll && !query.triageQueue)) {
      where.reportedById = actor.sub;
    } else if (query.reportedById && canViewAll) {
      where.reportedById = query.reportedById;
    }

    if (query.triageQueue) {
      if (!this.canTriage(actor)) {
        throw new ForbiddenException("Triage permission required");
      }
      where.status = {
        in: [
          MaintenanceRequestStatus.NEW,
          MaintenanceRequestStatus.UNDER_REVIEW,
          MaintenanceRequestStatus.APPROVED
        ]
      };
    } else if (query.status) {
      where.status = query.status as MaintenanceRequestStatus;
    }

    if (query.priority) where.priority = query.priority;
    if (query.siteId) where.siteId = query.siteId;
    if (query.functionalLocationId) where.functionalLocationId = query.functionalLocationId;
    if (query.assetId) where.assetId = query.assetId;
    if (query.domainId) where.domainId = query.domainId;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { requestNumber: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { problemCategoryLabel: { contains: q, mode: "insensitive" } }
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where }),
      this.prisma.maintenanceRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: this.listInclude()
      })
    ]);

    return {
      items: items.map((row) => this.mapListItem(row, actor)),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
    };
  }

  async findOne(
    tenantId: string | null,
    id: string,
    actor: Actor,
    options: { forceAll?: boolean } = {}
  ) {
    const tid = requireTenantId(tenantId);
    const row = await this.prisma.maintenanceRequest.findFirst({
      where: { id, tenantId: tid },
      include: {
        ...this.listInclude(),
        history: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            actor: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        },
        workOrder: {
          select: { id: true, woNumber: true, status: true, priority: true, title: true }
        },
        evidenceAttachments: {
          where: { deletedAt: null },
          take: 20,
          orderBy: { createdAt: "desc" }
        },
        duplicateOf: { select: { id: true, requestNumber: true, status: true } }
      }
    });
    if (!row) throw new NotFoundException("Maintenance request not found");

    const canViewAll = options.forceAll || this.canViewAll(actor) || this.canTriage(actor);
    if (!canViewAll && row.reportedById !== actor.sub) {
      throw new ForbiddenException("You can only view your own requests");
    }

    const locationPath = row.functionalLocationId
      ? await this.assetRegistry.resolveLocationPath(tid, row.functionalLocationId)
      : null;

    const history = row.history
      .filter((h) => canViewAll || !h.isInternal)
      .map((h) => ({
        id: h.id,
        action: h.action,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        toStatusLabel: h.toStatus ? humanRequestStatus(h.toStatus) : null,
        reason: h.reason,
        createdAt: h.createdAt,
        actorName: h.actor
          ? `${h.actor.firstName} ${h.actor.lastName}`.trim() || h.actor.email
          : "System",
        isInternal: canViewAll ? h.isInternal : false
      }));

    return {
      ...this.mapListItem(row, actor),
      triageNotes: canViewAll ? row.triageNotes : undefined,
      businessImpact: row.businessImpact,
      contextSnapshot: row.contextSnapshot,
      locationPath,
      history,
      workOrder: row.workOrder,
      evidence: row.evidenceAttachments,
      duplicateOf: row.duplicateOf,
      rejectionReasonType: row.rejectionReasonType,
      rejectionReason: row.rejectionReason,
      cancellationReason: row.cancellationReason
    };
  }

  async startReview(tenantId: string | null, id: string, actor: Actor) {
    this.assertTriage(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    assertValidTransition(current.status, MaintenanceRequestStatus.UNDER_REVIEW);

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.UNDER_REVIEW,
        reviewedAt: new Date(),
        triageOwnerId: actor.sub
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: MaintenanceRequestStatus.UNDER_REVIEW,
      action: "START_REVIEW",
      actorId: actor.sub,
      isInternal: true
    });
    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "maintenance-requests",
      actor: actor as never,
      beforeData: { status: current.status } as never,
      afterData: { status: updated.status } as never
    });

    return this.findOne(tid, id, actor, { forceAll: true });
  }

  async triage(tenantId: string | null, id: string, actor: Actor, dto: TriageMaintenanceRequestDto) {
    this.assertTriage(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    if (
      current.status !== MaintenanceRequestStatus.NEW &&
      current.status !== MaintenanceRequestStatus.UNDER_REVIEW &&
      current.status !== MaintenanceRequestStatus.APPROVED
    ) {
      throw new BadRequestException("Request cannot be triaged in its current status");
    }

    const placement = await this.resolvePlacement(tid, {
      assetId: dto.assetId ?? current.assetId ?? undefined,
      siteId: dto.siteId ?? current.siteId ?? undefined,
      functionalLocationId:
        dto.functionalLocationId ?? current.functionalLocationId ?? undefined,
      domainId: dto.domainId ?? current.domainId ?? undefined
    });

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        assetId: placement.assetId,
        siteId: placement.siteId,
        functionalLocationId: placement.functionalLocationId,
        domainId: placement.domainId,
        problemCategoryId:
          dto.problemCategoryId !== undefined ? dto.problemCategoryId : undefined,
        priority: dto.priority ?? undefined,
        isEmergency: dto.isEmergency ?? undefined,
        triageNotes: dto.triageNotes?.trim() || undefined,
        publicUpdateNote: dto.publicUpdateNote?.trim() || undefined,
        triageOwnerId: actor.sub,
        status:
          current.status === MaintenanceRequestStatus.NEW
            ? MaintenanceRequestStatus.UNDER_REVIEW
            : current.status,
        reviewedAt: current.reviewedAt ?? new Date()
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: updated.status,
      action: "TRIAGE_UPDATE",
      actorId: actor.sub,
      reason: dto.reason,
      metadata: {
        priority: dto.priority,
        assetId: placement.assetId,
        functionalLocationId: placement.functionalLocationId
      },
      isInternal: true
    });

    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "maintenance-requests",
      actor: actor as never,
      reason: dto.reason,
      beforeData: {
        priority: current.priority,
        assetId: current.assetId,
        functionalLocationId: current.functionalLocationId
      } as never,
      afterData: {
        priority: updated.priority,
        assetId: updated.assetId,
        functionalLocationId: updated.functionalLocationId
      } as never
    });

    return this.findOne(tid, id, actor, { forceAll: true });
  }

  async approve(tenantId: string | null, id: string, actor: Actor) {
    this.assertApprove(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    assertValidTransition(current.status, MaintenanceRequestStatus.APPROVED);

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.APPROVED,
        approvedAt: new Date(),
        triageOwnerId: actor.sub
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: MaintenanceRequestStatus.APPROVED,
      action: "APPROVED",
      actorId: actor.sub,
      isInternal: false
    });
    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "maintenance-requests",
      actor: actor as never,
      afterData: { status: updated.status } as never
    });

    return this.findOne(tid, id, actor, { forceAll: true });
  }

  async reject(
    tenantId: string | null,
    id: string,
    actor: Actor,
    dto: RejectMaintenanceRequestDto
  ) {
    this.assertApprove(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    assertValidTransition(current.status, MaintenanceRequestStatus.REJECTED);

    if (
      dto.reasonType === RequestRejectionReasonType.OTHER &&
      !dto.reason?.trim()
    ) {
      throw new BadRequestException("Rejection reason text is required when type is OTHER");
    }
    const reason = dto.reason?.trim() || dto.reasonType;
    if (!reason) throw new BadRequestException("Rejection reason is required");

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReasonType: dto.reasonType,
        rejectionReason: reason
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: MaintenanceRequestStatus.REJECTED,
      action: "REJECTED",
      actorId: actor.sub,
      reason,
      isInternal: false
    });
    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "maintenance-requests",
      actor: actor as never,
      reason,
      afterData: { status: updated.status, rejectionReasonType: dto.reasonType } as never
    });

    return this.findOne(tid, id, actor, { forceAll: true });
  }

  async cancel(
    tenantId: string | null,
    id: string,
    actor: Actor,
    dto: CancelMaintenanceRequestDto
  ) {
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    assertValidTransition(current.status, MaintenanceRequestStatus.CANCELLED);

    const isOwner = current.reportedById === actor.sub;
    const canCancelAny = this.hasPermission(actor, "maintenance_requests.cancel_any");
    if (!isOwner && !canCancelAny && !this.canTriage(actor)) {
      throw new ForbiddenException("Not allowed to cancel this request");
    }
    if (isOwner && !canCancelAny && current.status !== MaintenanceRequestStatus.NEW) {
      throw new ForbiddenException("Requesters may only cancel requests still in New status");
    }

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: dto.reason.trim()
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: MaintenanceRequestStatus.CANCELLED,
      action: "CANCELLED",
      actorId: actor.sub,
      reason: dto.reason.trim(),
      isInternal: false
    });
    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "maintenance-requests",
      actor: actor as never,
      reason: dto.reason.trim(),
      afterData: { status: updated.status } as never
    });

    return this.findOne(tid, id, actor, { forceAll: true });
  }

  async markDuplicate(
    tenantId: string | null,
    id: string,
    actor: Actor,
    dto: MarkDuplicateDto
  ) {
    this.assertTriage(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    if (dto.canonicalRequestId === id) {
      throw new BadRequestException("Cannot mark a request as duplicate of itself");
    }
    const canonical = await this.requireRequest(tid, dto.canonicalRequestId);
    assertValidTransition(current.status, MaintenanceRequestStatus.REJECTED);

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReasonType: RequestRejectionReasonType.DUPLICATE,
        rejectionReason: dto.reason.trim(),
        duplicateOfId: canonical.id
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: MaintenanceRequestStatus.REJECTED,
      action: "MARKED_DUPLICATE",
      actorId: actor.sub,
      reason: dto.reason.trim(),
      metadata: { canonicalRequestId: canonical.id, canonicalNumber: canonical.requestNumber },
      isInternal: false
    });
    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "maintenance-requests",
      actor: actor as never,
      reason: dto.reason.trim(),
      afterData: {
        status: updated.status,
        duplicateOfId: canonical.id
      } as never
    });

    return this.findOne(tid, id, actor, { forceAll: true });
  }

  async duplicateCandidates(tenantId: string | null, id: string, actor: Actor) {
    this.assertTriage(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const or: Prisma.MaintenanceRequestWhereInput[] = [];
    if (current.assetId) or.push({ assetId: current.assetId });
    if (current.functionalLocationId) {
      or.push({ functionalLocationId: current.functionalLocationId });
    }
    if (or.length === 0) return { items: [] };

    const items = await this.prisma.maintenanceRequest.findMany({
      where: {
        tenantId: tid,
        id: { not: id },
        createdAt: { gte: since },
        status: {
          in: [
            MaintenanceRequestStatus.NEW,
            MaintenanceRequestStatus.UNDER_REVIEW,
            MaintenanceRequestStatus.APPROVED
          ]
        },
        OR: or,
        ...(current.problemCategoryId
          ? { problemCategoryId: current.problemCategoryId }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: this.listInclude()
    });

    return {
      items: items.map((row) => this.mapListItem(row, actor)),
      note: "Possible duplicates — advisory only; do not auto-reject safety-critical reports"
    };
  }

  async repeatHistory(tenantId: string | null, id: string, actor: Actor) {
    this.assertTriage(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    if (!current.assetId && !current.functionalLocationId) {
      return { requests: [], workOrders: [] };
    }

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const requestWhere: Prisma.MaintenanceRequestWhereInput = {
      tenantId: tid,
      id: { not: id },
      createdAt: { gte: since },
      OR: [
        ...(current.assetId ? [{ assetId: current.assetId }] : []),
        ...(current.functionalLocationId
          ? [{ functionalLocationId: current.functionalLocationId }]
          : [])
      ]
    };

    const [requests, workOrders] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where: requestWhere,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          requestNumber: true,
          status: true,
          priority: true,
          description: true,
          createdAt: true,
          convertedAt: true
        }
      }),
      current.assetId
        ? this.prisma.workOrder.findMany({
            where: { tenantId: tid, assetId: current.assetId, createdAt: { gte: since } },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              woNumber: true,
              status: true,
              priority: true,
              title: true,
              createdAt: true
            }
          })
        : Promise.resolve([])
    ]);

    return { requests, workOrders };
  }

  /**
   * Conversion is idempotent: first call creates one WO; retries return the same WO.
   */
  async convertToWorkOrder(
    tenantId: string | null,
    id: string,
    actor: Actor,
    dto: ConvertToWorkOrderDto = {}
  ) {
    this.assertConvert(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);

    if (current.workOrderId) {
      const existing = await this.prisma.workOrder.findFirst({
        where: { id: current.workOrderId, tenantId: tid }
      });
      return {
        request: await this.findOne(tid, id, actor, { forceAll: true }),
        workOrder: existing,
        alreadyConverted: true
      };
    }

    if (current.status !== MaintenanceRequestStatus.APPROVED) {
      throw new BadRequestException("Only APPROVED requests can convert to a Work Order");
    }
    if (!current.assetId && !current.functionalLocationId) {
      throw new BadRequestException("Request must have an asset or functional location to convert");
    }

    const title =
      dto.title?.trim() ||
      `MR ${current.requestNumber}: ${(current.problemCategoryLabel || "Maintenance").slice(0, 80)}`;

    const wo = await this.workOrders.create(
      {
        title,
        description: current.description,
        priority: current.priority,
        type: current.isEmergency ? WorkOrderType.EMERGENCY : WorkOrderType.CORRECTIVE,
        assetId: current.assetId ?? undefined,
        siteId: current.siteId ?? undefined,
        functionalLocationId: current.functionalLocationId ?? undefined,
        createdById: actor.sub,
        isTriage: false,
        reportedAt: current.reportedAt?.toISOString?.() ?? undefined,
        failedAt: current.failureNoticedAt?.toISOString?.() ?? undefined
      },
      actor as never
    );

    // Ensure Phase 5 location fields remain attached (create already sets them when provided)
    const linked = await this.prisma.workOrder.update({
      where: { id: wo.id },
      data: {
        siteId: current.siteId ?? wo.siteId,
        functionalLocationId: current.functionalLocationId ?? wo.functionalLocationId
      }
    });

    try {
      await this.prisma.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceRequestStatus.CONVERTED_TO_WO,
          workOrderId: linked.id,
          convertedAt: new Date()
        }
      });
    } catch (error) {
      // Race: another conversion won — return that WO
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const again = await this.requireRequest(tid, id);
        return {
          request: await this.findOne(tid, id, actor, { forceAll: true }),
          workOrder: again.workOrderId
            ? await this.prisma.workOrder.findFirst({ where: { id: again.workOrderId } })
            : linked,
          alreadyConverted: true
        };
      }
      throw error;
    }

    await this.appendHistory(tid, id, {
      fromStatus: MaintenanceRequestStatus.APPROVED,
      toStatus: MaintenanceRequestStatus.CONVERTED_TO_WO,
      action: "CONVERTED_TO_WO",
      actorId: actor.sub,
      metadata: { workOrderId: linked.id, woNumber: linked.woNumber },
      isInternal: false
    });
    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "maintenance-requests",
      actor: actor as never,
      afterData: {
        status: MaintenanceRequestStatus.CONVERTED_TO_WO,
        workOrderId: linked.id
      } as never
    });

    return {
      request: await this.findOne(tid, id, actor, { forceAll: true }),
      workOrder: linked,
      alreadyConverted: false
    };
  }

  async history(tenantId: string | null, id: string, actor: Actor) {
    const detail = await this.findOne(tenantId, id, actor);
    return { items: detail.history };
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private async resolvePlacement(
    tenantId: string,
    input: {
      assetId?: string | null;
      siteId?: string | null;
      functionalLocationId?: string | null;
      departmentId?: string | null;
      domainId?: string | null;
    }
  ) {
    let assetId = input.assetId ?? null;
    let siteId = input.siteId ?? null;
    let functionalLocationId = input.functionalLocationId ?? null;
    let departmentId = input.departmentId ?? null;
    let domainId = input.domainId ?? null;

    if (!assetId && !functionalLocationId) {
      throw new BadRequestException(
        "At least one of assetId or functionalLocationId is required"
      );
    }

    if (assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: assetId, tenantId },
        select: {
          id: true,
          siteId: true,
          functionalLocationId: true,
          departmentId: true,
          domainId: true,
          tenantId: true
        }
      });
      if (!asset) throw new BadRequestException("Asset not found for this organization");
      siteId = siteId ?? asset.siteId;
      functionalLocationId = functionalLocationId ?? asset.functionalLocationId;
      departmentId = departmentId ?? asset.departmentId;
      domainId = domainId ?? asset.domainId;

      // Block contradictions unless FL omitted (derived from asset)
      if (
        input.functionalLocationId &&
        asset.functionalLocationId &&
        input.functionalLocationId !== asset.functionalLocationId
      ) {
        // Allow triage correction: only when explicitly provided AND different — validated same site below
      }
      if (input.siteId && asset.siteId && input.siteId !== asset.siteId && !input.functionalLocationId) {
        throw new BadRequestException("Site does not match the selected asset placement");
      }
    }

    await this.assetRegistry.validateSiteAndLocation(tenantId, siteId, functionalLocationId, {
      requireActive: true
    });

    if (departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: departmentId, tenantId }
      });
      if (!dept) throw new BadRequestException("Department not found for this organization");
    }
    if (domainId) {
      const domain = await this.prisma.assetDomain.findFirst({
        where: { id: domainId, tenantId }
      });
      if (!domain) throw new BadRequestException("Domain not found for this organization");
    }

    return { assetId, siteId, functionalLocationId, departmentId, domainId };
  }

  private async buildContextSnapshot(
    tenantId: string,
    placement: {
      assetId: string | null;
      siteId: string | null;
      functionalLocationId: string | null;
      departmentId: string | null;
      domainId: string | null;
    }
  ) {
    const [asset, site, department, domain, locationPath] = await Promise.all([
      placement.assetId
        ? this.prisma.asset.findFirst({
            where: { id: placement.assetId, tenantId },
            select: { id: true, assetTag: true, name: true }
          })
        : null,
      placement.siteId
        ? this.prisma.site.findFirst({
            where: { id: placement.siteId, tenantId },
            select: { id: true, code: true, name: true }
          })
        : null,
      placement.departmentId
        ? this.prisma.department.findFirst({
            where: { id: placement.departmentId, tenantId },
            select: { id: true, code: true, name: true }
          })
        : null,
      placement.domainId
        ? this.prisma.assetDomain.findFirst({
            where: { id: placement.domainId, tenantId },
            select: { id: true, code: true, name: true }
          })
        : null,
      this.assetRegistry.resolveLocationPath(tenantId, placement.functionalLocationId)
    ]);

    return {
      capturedAt: new Date().toISOString(),
      assetTag: asset?.assetTag ?? null,
      assetName: asset?.name ?? null,
      siteCode: site?.code ?? null,
      siteName: site?.name ?? null,
      functionalLocationId: placement.functionalLocationId,
      locationPath: locationPath?.path ?? null,
      domainCode: domain?.code ?? null,
      domainName: domain?.name ?? null,
      departmentCode: department?.code ?? null,
      departmentName: department?.name ?? null
    };
  }

  private async createWithNumberRetry(
    tenantId: string,
    data: Omit<Prisma.MaintenanceRequestUncheckedCreateInput, "tenantId" | "requestNumber" | "status">
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const requestNumber = await this.nextRequestNumber(tenantId);
      try {
        return await this.prisma.maintenanceRequest.create({
          data: {
            ...data,
            tenantId,
            requestNumber,
            status: MaintenanceRequestStatus.NEW
          }
        });
      } catch (error) {
        lastError = error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new BadRequestException("Unable to allocate a unique request number");
  }

  /** Prefer max existing sequence + retry on unique conflict — not bare count()+1 alone */
  private async nextRequestNumber(tenantId: string) {
    const year = new Date().getFullYear();
    const prefix = `MR-${year}-`;
    const latest = await this.prisma.maintenanceRequest.findFirst({
      where: { tenantId, requestNumber: { startsWith: prefix } },
      orderBy: { requestNumber: "desc" },
      select: { requestNumber: true }
    });
    let seq = 1;
    if (latest?.requestNumber) {
      const part = latest.requestNumber.slice(prefix.length);
      const parsed = Number.parseInt(part, 10);
      if (Number.isFinite(parsed)) seq = parsed + 1;
    }
    return `${prefix}${String(seq).padStart(5, "0")}`;
  }

  private async appendHistory(
    tenantId: string,
    requestId: string,
    input: {
      fromStatus: MaintenanceRequestStatus | null;
      toStatus: MaintenanceRequestStatus | null;
      action: string;
      actorId?: string;
      reason?: string;
      metadata?: Record<string, unknown>;
      isInternal?: boolean;
    }
  ) {
    await this.prisma.maintenanceRequestHistory.create({
      data: {
        tenantId,
        requestId,
        fromStatus: input.fromStatus ?? undefined,
        toStatus: input.toStatus ?? undefined,
        action: input.action,
        actorId: input.actorId,
        reason: input.reason,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        isInternal: input.isInternal ?? false
      }
    });
  }

  private async attachEvidence(
    tenantId: string,
    requestId: string,
    actorId: string,
    evidenceIds: string[]
  ) {
    for (const evidenceId of evidenceIds) {
      const evidence = await this.prisma.evidenceAttachment.findFirst({
        where: { id: evidenceId, tenantId, uploadedById: actorId, deletedAt: null }
      });
      if (!evidence) {
        throw new BadRequestException(`Evidence not found or not owned: ${evidenceId}`);
      }
      await this.prisma.evidenceAttachment.update({
        where: { id: evidenceId },
        data: { maintenanceRequestId: requestId }
      });
    }
  }

  private async notifyNewRequest(
    _tenantId: string,
    request: { id: string; requestNumber: string; priority: Priority; isEmergency: boolean },
    reporterId: string
  ) {
    try {
      await this.notifications.createNotification({
        userId: reporterId,
        type: "SYSTEM_ALERT" as never,
        title: `Request ${request.requestNumber} submitted`,
        message: "Your maintenance request was received and is awaiting review.",
        priority:
          request.priority === Priority.CRITICAL || request.isEmergency
            ? ("CRITICAL" as never)
            : ("INFO" as never),
        referenceId: request.id,
        referenceType: "MaintenanceRequest",
        dedupeKey: `mr-created:${request.id}`
      });
    } catch {
      // Notification failures must not block request creation
    }
  }

  private async requireRequest(tenantId: string, id: string) {
    const row = await this.prisma.maintenanceRequest.findFirst({
      where: { id, tenantId }
    });
    if (!row) throw new NotFoundException("Maintenance request not found");
    return row;
  }

  private listInclude() {
    return {
      asset: { select: { id: true, assetTag: true, name: true } },
      site: { select: { id: true, code: true, name: true } },
      functionalLocation: { select: { id: true, code: true, name: true } },
      domain: { select: { id: true, code: true, name: true } },
      problemCategory: { select: { id: true, code: true, name: true } },
      reportedBy: {
        select: { id: true, firstName: true, lastName: true, email: true }
      }
    } as const;
  }

  private mapListItem(
    row: {
      id: string;
      requestNumber: string;
      status: MaintenanceRequestStatus;
      priority: Priority;
      description: string;
      affectsOperation: boolean;
      isEmergency: boolean;
      reportedAt: Date;
      createdAt: Date;
      publicUpdateNote: string | null;
      workOrderId: string | null;
      asset?: { id: string; assetTag: string; name: string } | null;
      site?: { id: string; code: string; name: string } | null;
      functionalLocation?: { id: string; code: string; name: string } | null;
      domain?: { id: string; code: string; name: string } | null;
      problemCategory?: { id: string; code: string; name: string } | null;
      problemCategoryLabel?: string | null;
      reportedBy?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
    },
    _actor: Actor
  ) {
    return {
      id: row.id,
      requestNumber: row.requestNumber,
      status: row.status,
      statusLabel: humanRequestStatus(row.status),
      priority: row.priority,
      description: row.description,
      affectsOperation: row.affectsOperation,
      isEmergency: row.isEmergency,
      reportedAt: row.reportedAt,
      createdAt: row.createdAt,
      publicUpdateNote: row.publicUpdateNote,
      workOrderId: row.workOrderId,
      asset: row.asset ?? null,
      site: row.site ?? null,
      functionalLocation: row.functionalLocation ?? null,
      domain: row.domain ?? null,
      problemCategory: row.problemCategory ?? null,
      problemCategoryLabel: row.problemCategoryLabel ?? row.problemCategory?.name ?? null,
      reportedBy: row.reportedBy
        ? {
            id: row.reportedBy.id,
            name:
              `${row.reportedBy.firstName} ${row.reportedBy.lastName}`.trim() ||
              row.reportedBy.email
          }
        : null,
      isActive: isActiveRequestStatus(row.status)
    };
  }

  private hasPermission(actor: Actor, key: string) {
    const role = String(actor.role ?? "").toUpperCase();
    if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
    return (actor.permissions ?? []).includes(key);
  }

  private canViewAll(actor: Actor) {
    return (
      this.hasPermission(actor, "maintenance_requests.view_all") ||
      this.canTriage(actor) ||
      ["MANAGER", "SUPERVISOR", "ASSET_MANAGER", "FACILITY_MANAGER", "BUILDING_SUPERVISOR"].includes(
        String(actor.role ?? "").toUpperCase()
      )
    );
  }

  private canTriage(actor: Actor) {
    return (
      this.hasPermission(actor, "maintenance_requests.triage") ||
      ["MANAGER", "SUPERVISOR", "ASSET_MANAGER", "FACILITY_MANAGER", "BUILDING_SUPERVISOR"].includes(
        String(actor.role ?? "").toUpperCase()
      )
    );
  }

  private assertTriage(actor: Actor) {
    if (!this.canTriage(actor)) throw new ForbiddenException("Triage permission required");
  }

  private assertApprove(actor: Actor) {
    if (
      !this.hasPermission(actor, "maintenance_requests.approve") &&
      !this.hasPermission(actor, "maintenance_requests.reject") &&
      !this.canTriage(actor)
    ) {
      throw new ForbiddenException("Approve/reject permission required");
    }
  }

  private assertConvert(actor: Actor) {
    if (
      !this.hasPermission(actor, "maintenance_requests.convert") &&
      !this.canTriage(actor)
    ) {
      throw new ForbiddenException("Convert permission required");
    }
  }
}
