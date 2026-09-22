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
import { resolveJobDomain } from "../../common/utils/job-domain.util";
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
  RequesterRespondDto,
  TriageMaintenanceRequestDto
} from "./dto/maintenance-request.dto";
import {
  PRODUCTION_IMPACT_VALUES,
  REPORTED_URGENCY_VALUES,
  SAFETY_IMPACT_VALUES
} from "./dto/maintenance-request.dto";
import {
  assertValidTransition,
  DEFAULT_PROBLEM_CATEGORIES,
  humanRequestStatus,
  isActiveRequestStatus,
  mapRejectionTypeToResolution
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

    const idempotencyKey = dto.idempotencyKey?.trim() || null;
    if (idempotencyKey) {
      const existing = await this.prisma.maintenanceRequest.findFirst({
        where: { tenantId: tid, idempotencyKey }
      });
      if (existing) {
        return this.findOne(tid, existing.id, actor, { forceAll: true });
      }
    }

    const placement = await this.resolvePlacement(tid, {
      assetId: dto.assetId,
      vehicleId: dto.vehicleId,
      siteId: dto.siteId,
      functionalLocationId: dto.functionalLocationId,
      departmentId: dto.departmentId,
      domainId: dto.domainId,
      targetUnresolved: dto.targetUnresolved === true,
      approximateLocation: dto.approximateLocation
    });

    const snapshot = await this.buildContextSnapshot(tid, placement);

    let assetDomainCode: string | null | undefined;
    if (placement.domainId) {
      const domain = await this.prisma.assetDomain.findFirst({
        where: { id: placement.domainId, tenantId: tid },
        select: { code: true }
      });
      assetDomainCode = domain?.code;
    }

    // Do not silently classify unresolved targets as SERVICE.
    const jobDomain = placement.targetUnresolved
      ? null
      : resolveJobDomain({
          jobDomain: dto.jobDomain,
          vehicleId: placement.vehicleId,
          assetId: placement.assetId,
          assetDomainCode
        });

    const reportedUrgency = this.normalizeReportedUrgency(dto.reportedUrgency, dto.isEmergency);
    const safetyImpact = this.normalizeSafetyImpact(dto.safetyImpact);
    const productionImpact = this.normalizeProductionImpact(
      dto.productionImpact,
      dto.affectsOperation
    );
    const affectsOperation =
      productionImpact === "STOPPED" || productionImpact === "REDUCED" || Boolean(dto.affectsOperation);

    // Official priority is a triage decision — default MEDIUM until reviewer sets it.
    const priority = Priority.MEDIUM;

    const originalSubmission = {
      capturedAt: new Date().toISOString(),
      description: dto.description.trim(),
      reportedUrgency,
      safetyImpact,
      productionImpact,
      approximateLocation: placement.approximateLocation,
      targetUnresolved: placement.targetUnresolved,
      assetId: placement.assetId,
      vehicleId: placement.vehicleId,
      functionalLocationId: placement.functionalLocationId,
      siteId: placement.siteId,
      problemCategoryId: dto.problemCategoryId ?? null,
      problemCategoryLabel: dto.problemCategoryLabel?.trim() || null
    };

    let created;
    try {
      created = await this.createWithNumberRetry(tid, {
        reportedById: actor.sub,
        assetId: placement.assetId,
        vehicleId: placement.vehicleId,
        siteId: placement.siteId,
        functionalLocationId: placement.functionalLocationId,
        departmentId: placement.departmentId,
        domainId: placement.domainId,
        jobDomain,
        targetUnresolved: placement.targetUnresolved,
        approximateLocation: placement.approximateLocation,
        problemCategoryId: dto.problemCategoryId ?? null,
        problemCategoryLabel: dto.problemCategoryLabel?.trim() || null,
        description: dto.description.trim(),
        priority,
        requestedPriority: null,
        reportedUrgency,
        safetyImpact,
        productionImpact,
        affectsOperation,
        businessImpact: dto.businessImpact?.trim() || productionImpact,
        isEmergency: reportedUrgency === "VERY_URGENT" || Boolean(dto.isEmergency),
        failureNoticedAt: dto.failureNoticedAt ? new Date(dto.failureNoticedAt) : null,
        contextSnapshot: JSON.stringify(snapshot),
        originalSubmission: JSON.stringify(originalSubmission),
        idempotencyKey
      });
    } catch (error) {
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await this.prisma.maintenanceRequest.findFirst({
          where: { tenantId: tid, idempotencyKey }
        });
        if (raced) {
          return this.findOne(tid, raced.id, actor, { forceAll: true });
        }
      }
      throw error;
    }

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
          MaintenanceRequestStatus.NEEDS_INFORMATION,
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
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.domainId) where.domainId = query.domainId;
    if (query.jobDomain) where.jobDomain = query.jobDomain.trim().toUpperCase();

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { requestNumber: { contains: q } },
        { description: { contains: q } },
        { problemCategoryLabel: { contains: q } }
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

    const history = (row.history ?? [])
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
      originalSubmission: this.parseJsonField(row.originalSubmission),
      contextSnapshot: this.parseJsonField(row.contextSnapshot),
      locationPath,
      history,
      workOrder: row.workOrder,
      evidence: row.evidenceAttachments,
      duplicateOf: row.duplicateOf,
      rejectionReasonType: row.rejectionReasonType,
      rejectionReason: row.rejectionReason,
      cancellationReason: row.cancellationReason,
      reportedById: row.reportedById,
      resolutionCode: row.resolutionCode
    };
  }

  async startReview(tenantId: string | null, id: string, actor: Actor) {
    this.assertTriage(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    this.assertNotSelfGoverned(actor, current, "start review");
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
    this.assertNotSelfGoverned(actor, current, "triage");
    if (
      current.status !== MaintenanceRequestStatus.NEW &&
      current.status !== MaintenanceRequestStatus.UNDER_REVIEW &&
      current.status !== MaintenanceRequestStatus.APPROVED
    ) {
      throw new BadRequestException("Request cannot be triaged in its current status");
    }

    if (
      dto.priority &&
      dto.priority !== current.priority &&
      (current.status === MaintenanceRequestStatus.UNDER_REVIEW ||
        current.status === MaintenanceRequestStatus.APPROVED) &&
      !dto.reason?.trim()
    ) {
      throw new BadRequestException(
        "A reason is required when changing the official priority after review has started"
      );
    }

    const clearingUnresolved = dto.targetUnresolved === false;
    const placement = await this.resolvePlacement(tid, {
      assetId: dto.assetId !== undefined ? dto.assetId : current.assetId ?? undefined,
      vehicleId: dto.vehicleId !== undefined ? dto.vehicleId : current.vehicleId ?? undefined,
      siteId: dto.siteId !== undefined ? dto.siteId : current.siteId ?? undefined,
      functionalLocationId:
        dto.functionalLocationId !== undefined
          ? dto.functionalLocationId
          : current.functionalLocationId ?? undefined,
      domainId: dto.domainId !== undefined ? dto.domainId : current.domainId ?? undefined,
      targetUnresolved:
        dto.targetUnresolved !== undefined
          ? dto.targetUnresolved
          : clearingUnresolved
            ? false
            : current.targetUnresolved,
      approximateLocation: current.approximateLocation ?? undefined,
      allowKeepUnresolved: true
    });

    let assetDomainCode: string | null | undefined;
    if (placement.domainId) {
      const domain = await this.prisma.assetDomain.findFirst({
        where: { id: placement.domainId, tenantId: tid },
        select: { code: true }
      });
      assetDomainCode = domain?.code;
    }
    const jobDomain = placement.targetUnresolved
      ? null
      : resolveJobDomain({
          jobDomain: dto.jobDomain ?? current.jobDomain,
          vehicleId: placement.vehicleId,
          assetId: placement.assetId,
          assetDomainCode
        });

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        assetId: placement.assetId,
        vehicleId: placement.vehicleId,
        siteId: placement.siteId,
        functionalLocationId: placement.functionalLocationId,
        domainId: placement.domainId,
        jobDomain,
        targetUnresolved: placement.targetUnresolved,
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
        previousPriority: current.priority,
        assetId: placement.assetId,
        vehicleId: placement.vehicleId,
        functionalLocationId: placement.functionalLocationId,
        jobDomain,
        targetUnresolved: placement.targetUnresolved
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
        vehicleId: current.vehicleId,
        functionalLocationId: current.functionalLocationId,
        targetUnresolved: current.targetUnresolved
      } as never,
      afterData: {
        priority: updated.priority,
        assetId: updated.assetId,
        vehicleId: updated.vehicleId,
        functionalLocationId: updated.functionalLocationId,
        targetUnresolved: updated.targetUnresolved,
        jobDomain: updated.jobDomain
      } as never
    });

    return this.findOne(tid, id, actor, { forceAll: true });
  }

  async approve(tenantId: string | null, id: string, actor: Actor) {
    this.assertApprove(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    this.assertNotSelfGoverned(actor, current, "accept");
    assertValidTransition(current.status, MaintenanceRequestStatus.APPROVED);
    this.assertCanonicalTargetResolved(current);

    let assetDomainCode: string | null | undefined;
    if (current.domainId) {
      const domain = await this.prisma.assetDomain.findFirst({
        where: { id: current.domainId, tenantId: tid },
        select: { code: true }
      });
      assetDomainCode = domain?.code;
    }
    const jobDomain = resolveJobDomain({
      jobDomain: current.jobDomain,
      vehicleId: current.vehicleId,
      assetId: current.assetId,
      assetDomainCode
    });

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.APPROVED,
        approvedAt: new Date(),
        triageOwnerId: actor.sub,
        jobDomain,
        targetUnresolved: false
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: MaintenanceRequestStatus.APPROVED,
      action: "APPROVED",
      actorId: actor.sub,
      metadata: {
        jobDomain,
        assetId: current.assetId,
        vehicleId: current.vehicleId,
        functionalLocationId: current.functionalLocationId,
        priority: current.priority
      },
      isInternal: false
    });
    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "maintenance-requests",
      actor: actor as never,
      afterData: { status: updated.status, jobDomain } as never
    });

    void this.notifyRequester(tid, current.reportedById, {
      title: `Request ${current.requestNumber} accepted`,
      message: "Your maintenance request was accepted and may be converted to a work order.",
      dedupeKey: `mr-accepted:${id}`
    });

    return this.findOne(tid, id, actor, { forceAll: true });
  }

  async requestInformation(
    tenantId: string | null,
    id: string,
    actor: Actor,
    dto: { question: string; publicNote?: string }
  ) {
    this.assertTriage(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    assertValidTransition(current.status, MaintenanceRequestStatus.NEEDS_INFORMATION);
    const question = dto.question?.trim();
    if (!question || question.length < 3) {
      throw new BadRequestException("A clear question for the requester is required (min 3 characters).");
    }

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.NEEDS_INFORMATION,
        publicUpdateNote: dto.publicNote?.trim() || question,
        triageNotes: current.triageNotes
          ? `${current.triageNotes}\n[Needs info] ${question}`
          : `[Needs info] ${question}`,
        triageOwnerId: actor.sub
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: MaintenanceRequestStatus.NEEDS_INFORMATION,
      action: "NEEDS_INFORMATION",
      actorId: actor.sub,
      reason: question,
      isInternal: false
    });
    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "maintenance-requests",
      actor: actor as never,
      reason: question,
      beforeData: { status: current.status } as never,
      afterData: { status: updated.status } as never
    });

    void this.notifyRequester(tid, current.reportedById, {
      title: `More information needed for ${current.requestNumber}`,
      message: question,
      dedupeKey: `mr-needs-info:${id}:${updated.updatedAt?.toISOString?.() ?? Date.now()}`
    });

    return this.findOne(tid, id, actor, { forceAll: true });
  }

  /**
   * Requester-authored response to NEEDS_INFORMATION.
   * Supervisors must not use this path to invent a requester reply.
   */
  async respondToInformationRequest(
    tenantId: string | null,
    id: string,
    actor: Actor,
    dto: RequesterRespondDto
  ) {
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    if (current.reportedById !== actor.sub) {
      throw new ForbiddenException("Only the request owner can submit the requester response");
    }
    if (current.status !== MaintenanceRequestStatus.NEEDS_INFORMATION) {
      throw new BadRequestException("Request is not awaiting requester information");
    }
    const response = dto.response?.trim();
    if (!response || response.length < 3) {
      throw new BadRequestException("A response is required (min 3 characters)");
    }
    assertValidTransition(current.status, MaintenanceRequestStatus.UNDER_REVIEW);

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.UNDER_REVIEW,
        publicUpdateNote: response,
        reviewedAt: new Date()
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: MaintenanceRequestStatus.UNDER_REVIEW,
      action: "REQUESTER_RESPONDED",
      actorId: actor.sub,
      reason: response,
      isInternal: false
    });
    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "maintenance-requests",
      actor: actor as never,
      reason: response,
      beforeData: { status: current.status } as never,
      afterData: { status: updated.status } as never
    });

    if (dto.evidenceIds?.length) {
      await this.attachEvidence(tid, id, actor.sub, dto.evidenceIds);
    }

    if (current.triageOwnerId) {
      void this.notifyRequester(tid, current.triageOwnerId, {
        title: `Response received for ${current.requestNumber}`,
        message: "The requester replied to your information request.",
        dedupeKey: `mr-requester-responded:${id}:${updated.updatedAt?.toISOString?.() ?? Date.now()}`
      });
    }

    return this.findOne(tid, id, actor, { forceAll: true });
  }

  async resumeReview(tenantId: string | null, id: string, actor: Actor, dto?: { note?: string }) {
    this.assertTriage(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    this.assertNotSelfGoverned(actor, current, "resume review");
    if (current.status !== MaintenanceRequestStatus.NEEDS_INFORMATION) {
      throw new BadRequestException("Only requests awaiting information can resume review.");
    }
    assertValidTransition(current.status, MaintenanceRequestStatus.UNDER_REVIEW);

    const note = dto?.note?.trim();
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.UNDER_REVIEW,
        triageOwnerId: actor.sub,
        reviewedAt: new Date()
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: MaintenanceRequestStatus.UNDER_REVIEW,
      action: "RESUME_REVIEW",
      actorId: actor.sub,
      reason: note,
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

  async reject(
    tenantId: string | null,
    id: string,
    actor: Actor,
    dto: RejectMaintenanceRequestDto
  ) {
    this.assertApprove(actor);
    const tid = requireTenantId(tenantId);
    const current = await this.requireRequest(tid, id);
    assertValidTransition(current.status, MaintenanceRequestStatus.CLOSED);

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
        status: MaintenanceRequestStatus.CLOSED,
        rejectedAt: new Date(),
        rejectionReasonType: dto.reasonType,
        rejectionReason: reason,
        resolutionCode: mapRejectionTypeToResolution(dto.reasonType)
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: MaintenanceRequestStatus.CLOSED,
      action: "CLOSED",
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
      afterData: {
        status: updated.status,
        resolutionCode: updated.resolutionCode,
        rejectionReasonType: dto.reasonType
      } as never
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
    assertValidTransition(current.status, MaintenanceRequestStatus.CLOSED);

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.CLOSED,
        rejectedAt: new Date(),
        rejectionReasonType: RequestRejectionReasonType.DUPLICATE,
        rejectionReason: dto.reason.trim(),
        resolutionCode: "DUPLICATE",
        duplicateOfId: canonical.id
      }
    });

    await this.appendHistory(tid, id, {
      fromStatus: current.status,
      toStatus: MaintenanceRequestStatus.CLOSED,
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
   * Conversion is concurrency-safe: claim the request row inside a transaction,
   * then create the Work Order in the same transaction so losers never leave orphans.
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
    this.assertNotSelfGoverned(actor, current, "convert to work order");

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
      throw new BadRequestException("Only accepted (APPROVED) requests can convert to a Work Order");
    }
    this.assertCanonicalTargetResolved(current);

    let assetDomainCode: string | null | undefined;
    if (current.domainId) {
      const domain = await this.prisma.assetDomain.findFirst({
        where: { id: current.domainId, tenantId: tid },
        select: { code: true }
      });
      assetDomainCode = domain?.code;
    }
    const jobDomain = resolveJobDomain({
      jobDomain: current.jobDomain,
      vehicleId: current.vehicleId,
      assetId: current.assetId,
      assetDomainCode
    });

    const title =
      dto.title?.trim() ||
      `MR ${current.requestNumber}: ${(current.problemCategoryLabel || "Maintenance").slice(0, 80)}`;

    const result = await this.prisma.$transaction(
      async (tx) => {
      const claimed = await tx.maintenanceRequest.updateMany({
        where: {
          id,
          tenantId: tid,
          status: MaintenanceRequestStatus.APPROVED,
          workOrderId: null
        },
        data: {
          version: { increment: 1 }
        }
      });

      if (claimed.count === 0) {
        const again = await tx.maintenanceRequest.findFirst({
          where: { id, tenantId: tid }
        });
        if (again?.workOrderId) {
          const existingWo = await tx.workOrder.findFirst({
            where: { id: again.workOrderId, tenantId: tid }
          });
          return { alreadyConverted: true as const, workOrder: existingWo, linked: null };
        }
        throw new BadRequestException(
          "Request could not be claimed for conversion (status changed or already converting)"
        );
      }

      const wo = await this.workOrders.create(
        {
          title,
          description: current.description,
          priority: current.priority,
          type: current.isEmergency ? WorkOrderType.EMERGENCY : WorkOrderType.CORRECTIVE,
          assetId: current.assetId ?? undefined,
          vehicleId: current.vehicleId ?? undefined,
          siteId: current.siteId ?? undefined,
          functionalLocationId: current.functionalLocationId ?? undefined,
          createdById: actor.sub,
          isTriage: false,
          reportedAt: current.reportedAt?.toISOString?.() ?? undefined,
          failedAt: current.failureNoticedAt?.toISOString?.() ?? undefined,
          jobDomain,
          domainId: current.domainId ?? undefined,
          idempotencyKey: dto.idempotencyKey?.trim() || `mr-convert:${id}`
        },
        actor as never,
        { tx }
      );

      const linked = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceRequestStatus.CONVERTED_TO_WO,
          workOrderId: wo.id,
          convertedAt: new Date(),
          jobDomain
        }
      });

      await tx.maintenanceRequestHistory.create({
        data: {
          tenantId: tid,
          requestId: id,
          fromStatus: MaintenanceRequestStatus.APPROVED,
          toStatus: MaintenanceRequestStatus.CONVERTED_TO_WO,
          action: "CONVERTED_TO_WO",
          actorId: actor.sub,
          metadata: JSON.stringify({
            workOrderId: wo.id,
            woNumber: wo.woNumber,
            jobDomain,
            vehicleId: current.vehicleId,
            assetId: current.assetId
          }),
          isInternal: false
        }
      });

      // Link request evidence to the WO where still unlinked
      await tx.evidenceAttachment.updateMany({
        where: {
          tenantId: tid,
          maintenanceRequestId: id,
          workOrderId: null,
          deletedAt: null
        },
        data: { workOrderId: wo.id }
      });

      return { alreadyConverted: false as const, workOrder: wo, linked };
      },
      {
        // Concurrent converters may wait on the row lock while the winner creates the WO.
        maxWait: 15_000,
        timeout: 30_000
      }
    );

    if (result.alreadyConverted) {
      return {
        request: await this.findOne(tid, id, actor, { forceAll: true }),
        workOrder: result.workOrder,
        alreadyConverted: true
      };
    }

    await writeAuditTrail(this.prisma, {
      entity: "MaintenanceRequest",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "maintenance-requests",
      actor: actor as never,
      afterData: {
        status: MaintenanceRequestStatus.CONVERTED_TO_WO,
        workOrderId: result.workOrder?.id
      } as never
    });

    void this.notifyRequester(tid, current.reportedById, {
      title: `Request ${current.requestNumber} converted`,
      message: `Work order ${result.workOrder?.woNumber ?? ""} was created from your request.`,
      dedupeKey: `mr-converted:${id}`
    });

    return {
      request: await this.findOne(tid, id, actor, { forceAll: true }),
      workOrder: result.workOrder,
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
      vehicleId?: string | null;
      siteId?: string | null;
      functionalLocationId?: string | null;
      departmentId?: string | null;
      domainId?: string | null;
      targetUnresolved?: boolean;
      approximateLocation?: string | null;
      allowKeepUnresolved?: boolean;
    }
  ) {
    let assetId = input.assetId ?? null;
    let vehicleId = input.vehicleId ?? null;
    let siteId = input.siteId ?? null;
    let functionalLocationId = input.functionalLocationId ?? null;
    let departmentId = input.departmentId ?? null;
    let domainId = input.domainId ?? null;
    const approximateLocation = input.approximateLocation?.trim() || null;
    let targetUnresolved = input.targetUnresolved === true;

    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: vehicleId, tenantId },
        select: {
          id: true,
          assetId: true,
          registrationNo: true,
          assetTag: true,
          make: true,
          vehicleModel: true,
          departmentId: true,
          tenantId: true
        }
      });
      if (!vehicle) throw new BadRequestException("Vehicle not found for this organization");
      // Prefer explicit assetId; otherwise inherit Vehicle→Asset extension when present
      assetId = assetId ?? vehicle.assetId ?? null;
      departmentId = departmentId ?? vehicle.departmentId ?? null;
      targetUnresolved = false;
    }

    if (!assetId && !functionalLocationId && !vehicleId) {
      if (targetUnresolved || input.allowKeepUnresolved) {
        if (!siteId) {
          throw new BadRequestException(
            "Site is required when the maintenance target is not yet known"
          );
        }
        if (!approximateLocation && targetUnresolved) {
          throw new BadRequestException(
            "Approximate area/location is required when the target is not known"
          );
        }
        targetUnresolved = true;
      } else {
        throw new BadRequestException(
          "Select a machine, vehicle, or functional location — or mark the target as not sure"
        );
      }
    } else {
      targetUnresolved = false;
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

      if (input.siteId && asset.siteId && input.siteId !== asset.siteId && !input.functionalLocationId) {
        throw new BadRequestException("Site does not match the selected asset placement");
      }
    }

    if (!targetUnresolved) {
      await this.assetRegistry.validateSiteAndLocation(tenantId, siteId, functionalLocationId, {
        requireActive: true
      });
    } else if (siteId) {
      const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId } });
      if (!site) throw new BadRequestException("Site not found for this organization");
    }

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

    return {
      assetId,
      vehicleId,
      siteId,
      functionalLocationId,
      departmentId,
      domainId,
      targetUnresolved,
      approximateLocation
    };
  }

  private async buildContextSnapshot(
    tenantId: string,
    placement: {
      assetId: string | null;
      vehicleId: string | null;
      siteId: string | null;
      functionalLocationId: string | null;
      departmentId: string | null;
      domainId: string | null;
      targetUnresolved: boolean;
      approximateLocation: string | null;
    }
  ) {
    const [asset, vehicle, site, department, domain, locationPath] = await Promise.all([
      placement.assetId
        ? this.prisma.asset.findFirst({
            where: { id: placement.assetId, tenantId },
            select: { id: true, assetTag: true, name: true, serialNumber: true }
          })
        : null,
      placement.vehicleId
        ? this.prisma.vehicle.findFirst({
            where: { id: placement.vehicleId, tenantId },
            select: {
              id: true,
              registrationNo: true,
              assetTag: true,
              make: true,
              vehicleModel: true
            }
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
      assetSerial: asset?.serialNumber ?? null,
      vehicleRegistration: vehicle?.registrationNo ?? null,
      vehicleCode: vehicle?.assetTag ?? null,
      vehicleName: vehicle
        ? `${vehicle.make} ${vehicle.vehicleModel}`.trim()
        : null,
      siteCode: site?.code ?? null,
      siteName: site?.name ?? null,
      functionalLocationId: placement.functionalLocationId,
      locationPath: locationPath?.path ?? null,
      approximateLocation: placement.approximateLocation,
      targetUnresolved: placement.targetUnresolved,
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
        metadata:
          input.metadata != null ? JSON.stringify(input.metadata) : undefined,
        isInternal: input.isInternal ?? false
      }
    });
  }

  private parseJsonField(value: unknown): Record<string, unknown> | null {
    if (value == null) return null;
    if (typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
    return null;
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
      vehicle: {
        select: {
          id: true,
          registrationNo: true,
          assetTag: true,
          make: true,
          vehicleModel: true
        }
      },
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
      reportedUrgency?: string | null;
      safetyImpact?: string | null;
      productionImpact?: string | null;
      targetUnresolved?: boolean;
      approximateLocation?: string | null;
      jobDomain?: string | null;
      originalSubmission?: unknown;
      asset?: { id: string; assetTag: string; name: string } | null;
      vehicle?: {
        id: string;
        registrationNo: string;
        assetTag: string | null;
        make: string;
        vehicleModel: string;
      } | null;
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
      reportedUrgency: row.reportedUrgency ?? null,
      safetyImpact: row.safetyImpact ?? null,
      productionImpact: row.productionImpact ?? null,
      targetUnresolved: Boolean(row.targetUnresolved),
      approximateLocation: row.approximateLocation ?? null,
      jobDomain: row.jobDomain ?? null,
      reportedAt: row.reportedAt,
      createdAt: row.createdAt,
      publicUpdateNote: row.publicUpdateNote,
      workOrderId: row.workOrderId,
      asset: row.asset ?? null,
      vehicle: row.vehicle
        ? {
            id: row.vehicle.id,
            registrationNo: row.vehicle.registrationNo,
            code: row.vehicle.assetTag,
            name: `${row.vehicle.make} ${row.vehicle.vehicleModel}`.trim()
          }
        : null,
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

  private normalizeReportedUrgency(
    value: string | null | undefined,
    isEmergency?: boolean
  ): string {
    const normalized = String(value ?? "").trim().toUpperCase();
    if ((REPORTED_URGENCY_VALUES as readonly string[]).includes(normalized)) {
      return normalized;
    }
    if (isEmergency) return "VERY_URGENT";
    return "NORMAL";
  }

  private normalizeSafetyImpact(value: string | null | undefined): string {
    const normalized = String(value ?? "").trim().toUpperCase();
    if ((SAFETY_IMPACT_VALUES as readonly string[]).includes(normalized)) {
      return normalized;
    }
    return "NOT_SURE";
  }

  private normalizeProductionImpact(
    value: string | null | undefined,
    affectsOperation?: boolean
  ): string {
    const normalized = String(value ?? "").trim().toUpperCase();
    if ((PRODUCTION_IMPACT_VALUES as readonly string[]).includes(normalized)) {
      return normalized;
    }
    if (affectsOperation) return "STOPPED";
    return "NOT_SURE";
  }

  private assertCanonicalTargetResolved(request: {
    targetUnresolved?: boolean | null;
    assetId?: string | null;
    vehicleId?: string | null;
    functionalLocationId?: string | null;
  }) {
    if (request.targetUnresolved) {
      throw new BadRequestException(
        "Confirm a canonical machine, vehicle, or functional location before accepting or converting"
      );
    }
    if (!request.assetId && !request.vehicleId && !request.functionalLocationId) {
      throw new BadRequestException(
        "A confirmed asset, vehicle, or functional location is required"
      );
    }
  }

  private assertNotSelfGoverned(
    actor: Actor,
    request: { reportedById: string; requestNumber?: string },
    action: string
  ) {
    if (request.reportedById === actor.sub) {
      throw new ForbiddenException(
        `Segregation of duties: you cannot ${action} a request you reported`
      );
    }
  }

  private async notifyRequester(
    _tenantId: string,
    userId: string,
    input: { title: string; message: string; dedupeKey: string }
  ) {
    try {
      await this.notifications.createNotification({
        userId,
        type: "SYSTEM_ALERT" as never,
        title: input.title,
        message: input.message,
        priority: "INFO" as never,
        referenceType: "MaintenanceRequest",
        dedupeKey: input.dedupeKey
      });
    } catch {
      // Notification failures must not block primary business transactions
    }
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
