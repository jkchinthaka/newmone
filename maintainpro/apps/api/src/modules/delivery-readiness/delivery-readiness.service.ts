import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AuditAction,
  DeliveryChecklistCategory,
  DeliveryItemStatus,
  DeliveryReadinessVerdict,
  Prisma,
  QaIssueSeverity,
  QaIssueStatus,
  RoleName
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { createPaginationMeta } from "../../common/utils/pagination-meta";
import { clampPage, clampPageSize } from "../../common/utils/pagination.util";
import { PrismaService } from "../../database/prisma.service";
import {
  DELIVERY_CATEGORY_CATALOG,
  FINAL_QA_CHECKLIST_ITEMS,
  isBlockingStatus,
  isPassingStatus
} from "./delivery.constants";
import type {
  CreateDeliveryChecklistDto,
  CreateDeliveryItemDto,
  DeliveryAcceptRiskDto,
  DeliveryCompleteItemDto,
  DeliveryFailItemDto,
  DeliveryListQueryDto,
  DeliverySignOffDto,
  UpdateDeliveryChecklistDto,
  UpdateDeliveryItemDto
} from "./dto/delivery.dto";

const MASTER_CHECKLIST_TITLE = "MaintainPro Client Delivery Readiness";

@Injectable()
export class DeliveryReadinessService {
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

  private requireActorId(): string {
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

  canManage(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("delivery.manage");
  }

  canView(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("delivery.view") || permissions.includes("delivery.manage");
  }

  canAcceptRisk(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("delivery.accept_risk") || actorRole === RoleName.MANAGER;
  }

  canSignOff(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("delivery.sign_off") || actorRole === RoleName.MANAGER;
  }

  canExport(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("delivery.export");
  }

  private tenantWhere() {
    const tenantId = this.requireTenantId();
    return tenantId ? { tenantId } : {};
  }

  private async audit(
    event: string,
    entityId: string,
    beforeData?: Prisma.InputJsonValue,
    afterData?: Prisma.InputJsonValue,
    reason?: string
  ) {
    await writeAuditTrail(this.prisma, {
      entity: "DeliveryChecklistItem",
      entityId,
      action: AuditAction.UPDATE,
      module: "delivery-readiness",
      reason,
      metadata: { event } as Prisma.InputJsonValue,
      beforeData,
      afterData
    });
  }

  private async nextChecklistNo(tenantId: string | null): Promise<string> {
    const count = await this.prisma.deliveryChecklist.count({
      where: tenantId ? { tenantId } : {}
    });
    return `DR-${String(count + 1).padStart(4, "0")}`;
  }

  async ensureBootstrap(): Promise<{ masterChecklistId: string }> {
    const tenantId = this.requireTenantId();
    const where = tenantId ? { tenantId } : {};

    let master = await this.prisma.deliveryChecklist.findFirst({
      where: { ...where, title: MASTER_CHECKLIST_TITLE }
    });

    if (!master) {
      const checklistNo = await this.nextChecklistNo(tenantId);
      master = await this.prisma.deliveryChecklist.create({
        data: {
          tenantId,
          checklistNo,
          title: MASTER_CHECKLIST_TITLE,
          category: DeliveryChecklistCategory.REQUIREMENTS,
          description: "Master client delivery readiness checklist for MaintainPro handover.",
          status: DeliveryItemStatus.NOT_STARTED,
          requiredForDelivery: true
        }
      });

      await writeAuditTrail(this.prisma, {
        entity: "DeliveryChecklist",
        entityId: master.id,
        action: AuditAction.CREATE,
        module: "delivery-readiness",
        metadata: { event: "delivery_checklist_created" }
      });
    }

    const existingCount = await this.prisma.deliveryChecklistItem.count({
      where: { checklistId: master.id }
    });

    if (existingCount === 0) {
      const rows: Prisma.DeliveryChecklistItemCreateManyInput[] = [];
      for (const category of DELIVERY_CATEGORY_CATALOG) {
        for (const item of category.items) {
          rows.push({
            checklistId: master.id,
            tenantId,
            title: item.title,
            description: item.description,
            category: category.key,
            status: DeliveryItemStatus.NOT_STARTED,
            blocker: item.blocker ?? false,
            requiredForDelivery: item.requiredForDelivery ?? true,
            signOffRequired: item.signOffRequired ?? category.signOffRequired
          });
        }
      }
      await this.prisma.deliveryChecklistItem.createMany({ data: rows });
    }

    return { masterChecklistId: master.id };
  }

  getCategories() {
    return DELIVERY_CATEGORY_CATALOG.map((c) => ({
      key: c.key,
      label: c.label,
      description: c.description,
      signOffRequired: c.signOffRequired,
      itemCount: c.items.length
    }));
  }

  async getDashboard() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view delivery readiness");
    await this.ensureBootstrap();

    const tenantId = this.requireTenantId();
    const base = tenantId ? { tenantId } : {};
    const items = await this.prisma.deliveryChecklistItem.findMany({ where: base });

    const passed = items.filter((i) => i.status === DeliveryItemStatus.PASS).length;
    const failed = items.filter((i) => i.status === DeliveryItemStatus.FAIL).length;
    const blocked = items.filter((i) => i.status === DeliveryItemStatus.BLOCKED).length;
    const acceptedRisks = items.filter((i) => i.status === DeliveryItemStatus.ACCEPTED_RISK).length;
    const total = items.length;
    const completionPercentage = total > 0 ? Math.round((passed / total) * 100) : 0;

    const verdict = await this.computeVerdict(items);

    const byCategory = DELIVERY_CATEGORY_CATALOG.map((cat) => {
      const catItems = items.filter((i) => i.category === cat.key);
      const catPassed = catItems.filter((i) => isPassingStatus(i.status)).length;
      return {
        category: cat.key,
        label: cat.label,
        total: catItems.length,
        passed: catPassed,
        failed: catItems.filter((i) => i.status === DeliveryItemStatus.FAIL).length,
        blocked: catItems.filter((i) => i.status === DeliveryItemStatus.BLOCKED).length
      };
    });

    return {
      total,
      passed,
      failed,
      blocked,
      acceptedRisks,
      inProgress: items.filter((i) => i.status === DeliveryItemStatus.IN_PROGRESS).length,
      notStarted: items.filter((i) => i.status === DeliveryItemStatus.NOT_STARTED).length,
      completionPercentage,
      currentVerdict: verdict,
      byCategory,
      finalQaChecklist: FINAL_QA_CHECKLIST_ITEMS,
      categories: this.getCategories()
    };
  }

  private async countOpenQaCritical(tenantId: string | null): Promise<number> {
    return this.prisma.qaIssue.count({
      where: {
        ...(tenantId ? { tenantId } : {}),
        severity: QaIssueSeverity.CRITICAL,
        status: { notIn: [QaIssueStatus.CLOSED, QaIssueStatus.ACCEPTED_RISK] }
      }
    });
  }

  async computeVerdict(
    items?: Array<{
      status: DeliveryItemStatus;
      category: DeliveryChecklistCategory;
      blocker: boolean;
      requiredForDelivery: boolean;
    }>
  ): Promise<DeliveryReadinessVerdict> {
    const tenantId = this.requireTenantId();
    const list =
      items ??
      (await this.prisma.deliveryChecklistItem.findMany({
        where: tenantId ? { tenantId } : {}
      }));

    const openQaCritical = await this.countOpenQaCritical(tenantId);
    if (openQaCritical > 0) return DeliveryReadinessVerdict.NOT_READY;

    const criticalBlockers = list.filter(
      (i) =>
        i.requiredForDelivery &&
        i.blocker &&
        isBlockingStatus(i.status) &&
        i.status !== DeliveryItemStatus.ACCEPTED_RISK
    );
    if (criticalBlockers.length > 0) return DeliveryReadinessVerdict.NOT_READY;

    const securityItems = list.filter((i) => i.category === DeliveryChecklistCategory.SECURITY && i.requiredForDelivery);
    const securityIncomplete = securityItems.some((i) => !isPassingStatus(i.status));
    if (securityIncomplete) return DeliveryReadinessVerdict.NOT_READY;

    const backupItems = list.filter((i) => i.category === DeliveryChecklistCategory.BACKUP_RECOVERY && i.requiredForDelivery);
    const backupIncomplete = backupItems.some((i) => !isPassingStatus(i.status));
    if (backupIncomplete) return DeliveryReadinessVerdict.NOT_READY;

    const roleItems = list.filter((i) => i.category === DeliveryChecklistCategory.USER_ROLES && i.blocker);
    const roleIncomplete = roleItems.some((i) => !isPassingStatus(i.status));
    if (roleIncomplete) return DeliveryReadinessVerdict.NOT_READY;

    const docItems = list.filter((i) => i.category === DeliveryChecklistCategory.DOCUMENTATION && i.requiredForDelivery);
    const docIncomplete = docItems.some((i) => !isPassingStatus(i.status));

    const failedCount = list.filter((i) => i.status === DeliveryItemStatus.FAIL).length;
    const acceptedCount = list.filter((i) => i.status === DeliveryItemStatus.ACCEPTED_RISK).length;

    const allRequiredPass = list
      .filter((i) => i.requiredForDelivery)
      .every((i) => isPassingStatus(i.status));

    if (allRequiredPass) {
      if (docIncomplete) return DeliveryReadinessVerdict.CLIENT_DELIVERY_READY;
      return DeliveryReadinessVerdict.FULL_COMPANY_LIVE_READY;
    }

    if (failedCount > 0) return DeliveryReadinessVerdict.DEPARTMENT_ROLLOUT_READY;
    if (acceptedCount > 0) return DeliveryReadinessVerdict.PILOT_READY;

    return DeliveryReadinessVerdict.DEPARTMENT_ROLLOUT_READY;
  }

  async findAllChecklists(query: DeliveryListQueryDto) {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view delivery readiness");
    await this.ensureBootstrap();

    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const skip = (page - 1) * pageSize;

    const where: Prisma.DeliveryChecklistWhereInput = {
      ...this.tenantWhere(),
      ...(query.category ? { category: query.category as DeliveryChecklistCategory } : {}),
      ...(query.status ? { status: query.status as DeliveryItemStatus } : {}),
      ...(query.owner ? { ownerUserId: query.owner } : {}),
      ...(query.requiredForDelivery === "true" ? { requiredForDelivery: true } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
            }
          }
        : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.deliveryChecklist.findMany({
        where,
        include: { items: { orderBy: [{ category: "asc" }, { title: "asc" }] } },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      this.prisma.deliveryChecklist.count({ where })
    ]);

    return { items, meta: createPaginationMeta(page, pageSize, total) };
  }

  async findOneChecklist(id: string) {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view delivery readiness");
    const checklist = await this.prisma.deliveryChecklist.findFirst({
      where: { id, ...this.tenantWhere() },
      include: { items: { orderBy: [{ category: "asc" }, { title: "asc" }] } }
    });
    if (!checklist) throw new NotFoundException("Checklist not found");
    return checklist;
  }

  async createChecklist(dto: CreateDeliveryChecklistDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage delivery readiness");
    const tenantId = this.requireTenantId();
    const checklistNo = await this.nextChecklistNo(tenantId);

    const checklist = await this.prisma.deliveryChecklist.create({
      data: {
        tenantId,
        checklistNo,
        title: dto.title.trim(),
        category: dto.category,
        description: dto.description?.trim() || null,
        priority: dto.priority ?? "MEDIUM",
        requiredForDelivery: dto.requiredForDelivery ?? true,
        status: DeliveryItemStatus.NOT_STARTED
      },
      include: { items: true }
    });

    await writeAuditTrail(this.prisma, {
      entity: "DeliveryChecklist",
      entityId: checklist.id,
      action: AuditAction.CREATE,
      module: "delivery-readiness",
      metadata: { event: "delivery_checklist_created", category: dto.category }
    });

    return checklist;
  }

  async updateChecklist(id: string, dto: UpdateDeliveryChecklistDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage delivery readiness");
    const existing = await this.prisma.deliveryChecklist.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Checklist not found");

    const updated = await this.prisma.deliveryChecklist.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.ownerUserId !== undefined ? { ownerUserId: dto.ownerUserId } : {}),
        ...(dto.evidence !== undefined ? { evidence: dto.evidence?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {})
      },
      include: { items: true }
    });

    await writeAuditTrail(this.prisma, {
      entity: "DeliveryChecklist",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "delivery-readiness",
      metadata: { event: "delivery_checklist_updated" },
      beforeData: existing as object,
      afterData: updated as object
    });

    return updated;
  }

  async addItem(checklistId: string, dto: CreateDeliveryItemDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage delivery readiness");
    const checklist = await this.prisma.deliveryChecklist.findFirst({
      where: { id: checklistId, ...this.tenantWhere() }
    });
    if (!checklist) throw new NotFoundException("Checklist not found");

    const tenantId = this.requireTenantId();
    const item = await this.prisma.deliveryChecklistItem.create({
      data: {
        checklistId,
        tenantId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category,
        blocker: dto.blocker ?? false,
        requiredForDelivery: dto.requiredForDelivery ?? true,
        signOffRequired: dto.signOffRequired ?? false,
        status: DeliveryItemStatus.NOT_STARTED
      }
    });

    await this.audit("delivery_checklist_updated", item.id, undefined, item as object);
    return item;
  }

  async updateItem(id: string, dto: UpdateDeliveryItemDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage delivery readiness");
    const existing = await this.prisma.deliveryChecklistItem.findFirst({
      where: { id, ...this.tenantWhere() }
    });
    if (!existing) throw new NotFoundException("Checklist item not found");

    if (
      dto.status === DeliveryItemStatus.ACCEPTED_RISK &&
      existing.status !== DeliveryItemStatus.ACCEPTED_RISK
    ) {
      throw new BadRequestException("Use the accept-risk endpoint with manager approval");
    }

    const actorId = this.requireActorId();
    const updated = await this.prisma.deliveryChecklistItem.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.evidence !== undefined ? { evidence: dto.evidence?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.testedRole !== undefined ? { testedRole: dto.testedRole?.trim() || null } : {}),
        ...(dto.testedEnvironment !== undefined
          ? { testedEnvironment: dto.testedEnvironment?.trim() || null }
          : {}),
        ...(dto.deviceSize !== undefined ? { deviceSize: dto.deviceSize?.trim() || null } : {}),
        ...(dto.responseTimeMs !== undefined ? { responseTimeMs: dto.responseTimeMs } : {}),
        ...(dto.usabilityRating !== undefined ? { usabilityRating: dto.usabilityRating } : {}),
        ...(dto.status === DeliveryItemStatus.PASS ||
        dto.status === DeliveryItemStatus.FAIL ||
        dto.status === DeliveryItemStatus.BLOCKED
          ? { testedByUserId: actorId, completedAt: new Date() }
          : {})
      }
    });

    const event =
      dto.status === DeliveryItemStatus.PASS
        ? "delivery_item_passed"
        : dto.status === DeliveryItemStatus.FAIL
          ? "delivery_item_failed"
          : dto.status === DeliveryItemStatus.BLOCKED
            ? "delivery_item_blocked"
            : "delivery_checklist_updated";

    await this.audit(event, id, existing as object, updated as object, dto.reason);
    return updated;
  }

  async completeItem(id: string, dto: DeliveryCompleteItemDto) {
    return this.updateItem(id, {
      status: DeliveryItemStatus.PASS,
      evidence: dto.evidence,
      notes: dto.notes,
      testedRole: dto.testedRole,
      testedEnvironment: dto.testedEnvironment,
      deviceSize: dto.deviceSize,
      responseTimeMs: dto.responseTimeMs,
      usabilityRating: dto.usabilityRating
    });
  }

  async failItem(id: string, dto: DeliveryFailItemDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage delivery readiness");
    const existing = await this.prisma.deliveryChecklistItem.findFirst({
      where: { id, ...this.tenantWhere() }
    });
    if (!existing) throw new NotFoundException("Checklist item not found");

    const actorId = this.requireActorId();
    const updated = await this.prisma.deliveryChecklistItem.update({
      where: { id },
      data: {
        status: dto.blocker ? DeliveryItemStatus.BLOCKED : DeliveryItemStatus.FAIL,
        blocker: dto.blocker ?? existing.blocker,
        evidence: dto.evidence?.trim() || existing.evidence,
        notes: dto.reason.trim(),
        testedByUserId: actorId,
        completedAt: new Date()
      }
    });

    await this.audit(
      dto.blocker ? "delivery_item_blocked" : "delivery_item_failed",
      id,
      existing as object,
      updated as object,
      dto.reason
    );
    return updated;
  }

  async acceptRisk(id: string, dto: DeliveryAcceptRiskDto) {
    if (!this.canAcceptRisk()) {
      throw new ForbiddenException("Manager or admin approval is required to accept delivery risk");
    }
    const actorId = this.requireActorId();
    const existing = await this.prisma.deliveryChecklistItem.findFirst({
      where: { id, ...this.tenantWhere() }
    });
    if (!existing) throw new NotFoundException("Checklist item not found");

    const updated = await this.prisma.deliveryChecklistItem.update({
      where: { id },
      data: {
        status: DeliveryItemStatus.ACCEPTED_RISK,
        acceptedRiskReason: dto.reason.trim(),
        acceptedByUserId: actorId,
        completedAt: new Date()
      }
    });

    await this.audit("delivery_risk_accepted", id, existing as object, updated as object, dto.reason);
    return updated;
  }

  async getFinalReport() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view delivery readiness");
    await this.ensureBootstrap();

    const tenantId = this.requireTenantId();
    const items = await this.prisma.deliveryChecklistItem.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: [{ category: "asc" }, { title: "asc" }]
    });

    const verdict = await this.computeVerdict(items);
    const openBlockers = items.filter(
      (i) => i.requiredForDelivery && i.blocker && isBlockingStatus(i.status)
    );
    const acceptedRisks = items.filter((i) => i.status === DeliveryItemStatus.ACCEPTED_RISK);
    const categorySummary = DELIVERY_CATEGORY_CATALOG.map((cat) => {
      const catItems = items.filter((i) => i.category === cat.key);
      return {
        category: cat.key,
        label: cat.label,
        total: catItems.length,
        passed: catItems.filter((i) => i.status === DeliveryItemStatus.PASS).length,
        failed: catItems.filter((i) => i.status === DeliveryItemStatus.FAIL).length,
        blocked: catItems.filter((i) => i.status === DeliveryItemStatus.BLOCKED).length,
        acceptedRisks: catItems.filter((i) => i.status === DeliveryItemStatus.ACCEPTED_RISK).length,
        complete: catItems.every((i) => isPassingStatus(i.status))
      };
    });

    const securityStatus = categorySummary.find((c) => c.category === "SECURITY");
    const backupStatus = categorySummary.find((c) => c.category === "BACKUP_RECOVERY");
    const documentationStatus = categorySummary.find((c) => c.category === "DOCUMENTATION");
    const openQaCritical = await this.countOpenQaCritical(tenantId);

    await writeAuditTrail(this.prisma, {
      entity: "DeliveryReadiness",
      entityId: "final-report",
      action: AuditAction.UPDATE,
      module: "delivery-readiness",
      metadata: { event: "delivery_verdict_generated", verdict }
    });

    return {
      summary: {
        total: items.length,
        passed: items.filter((i) => i.status === DeliveryItemStatus.PASS).length,
        failed: items.filter((i) => i.status === DeliveryItemStatus.FAIL).length,
        blocked: items.filter((i) => i.status === DeliveryItemStatus.BLOCKED).length,
        acceptedRisks: acceptedRisks.length,
        openQaCritical
      },
      categorySummary,
      openBlockers: openBlockers.map((i) => ({
        id: i.id,
        title: i.title,
        category: i.category,
        status: i.status
      })),
      acceptedRisks: acceptedRisks.map((i) => ({
        id: i.id,
        title: i.title,
        reason: i.acceptedRiskReason
      })),
      securityStatus,
      backupStatus,
      documentationStatus,
      finalQaChecklist: FINAL_QA_CHECKLIST_ITEMS,
      verdict,
      generatedAt: new Date().toISOString()
    };
  }

  private async assertCanSignOff() {
    const tenantId = this.requireTenantId();
    const items = await this.prisma.deliveryChecklistItem.findMany({
      where: tenantId ? { tenantId } : {}
    });
    const verdict = await this.computeVerdict(items);
    if (verdict === DeliveryReadinessVerdict.NOT_READY) {
      throw new BadRequestException(
        "Final sign-off blocked: critical blockers, security, backup, or open QA critical issues remain"
      );
    }

    const blockers = items.filter(
      (i) =>
        i.requiredForDelivery &&
        i.blocker &&
        isBlockingStatus(i.status) &&
        i.status !== DeliveryItemStatus.ACCEPTED_RISK
    );
    if (blockers.length > 0) {
      throw new BadRequestException("Final sign-off blocked while critical checklist items are failed or blocked");
    }
  }

  async signOff(dto: DeliverySignOffDto) {
    if (!this.canSignOff()) {
      throw new ForbiddenException("You do not have permission to sign off delivery readiness");
    }
    await this.assertCanSignOff();

    const actorId = this.requireActorId();
    const { actorRole } = this.ctx();
    const tenantId = this.requireTenantId();
    const items = await this.prisma.deliveryChecklistItem.findMany({
      where: tenantId ? { tenantId } : {}
    });
    const verdict = dto.readinessVerdict ?? (await this.computeVerdict(items));

    if (verdict === DeliveryReadinessVerdict.NOT_READY) {
      throw new BadRequestException("Cannot sign off with NOT_READY verdict while critical blockers exist");
    }

    const record = await this.prisma.deliverySignOff.create({
      data: {
        tenantId,
        readinessVerdict: verdict,
        signedByUserId: actorId,
        role: actorRole,
        department: dto.department?.trim() || null,
        notes: dto.notes?.trim() || dto.reason?.trim() || null,
        acceptedRisks: dto.acceptedRisks?.trim() || null
      }
    });

    await writeAuditTrail(this.prisma, {
      entity: "DeliverySignOff",
      entityId: record.id,
      action: AuditAction.CREATE,
      module: "delivery-readiness",
      reason: dto.reason,
      metadata: { event: "delivery_signoff_created", verdict }
    });

    return record;
  }

  async exportReport() {
    if (!this.canExport() && !this.canView()) {
      throw new ForbiddenException("You do not have permission to export delivery readiness reports");
    }
    const report = await this.getFinalReport();
    const { masterChecklistId } = await this.ensureBootstrap();
    const checklist = await this.findOneChecklist(masterChecklistId);

    await writeAuditTrail(this.prisma, {
      entity: "DeliveryReadiness",
      entityId: "export",
      action: AuditAction.UPDATE,
      module: "delivery-readiness",
      metadata: { event: "delivery_report_exported", verdict: report.verdict }
    });

    return {
      ...report,
      exportedAt: new Date().toISOString(),
      checklist
    };
  }

  async listItems(query: DeliveryListQueryDto) {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view delivery readiness");
    await this.ensureBootstrap();

    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const skip = (page - 1) * pageSize;

    const where: Prisma.DeliveryChecklistItemWhereInput = {
      ...this.tenantWhere(),
      ...(query.category ? { category: query.category as DeliveryChecklistCategory } : {}),
      ...(query.status ? { status: query.status as DeliveryItemStatus } : {}),
      ...(query.blocker === "true" ? { blocker: true } : {}),
      ...(query.requiredForDelivery === "true" ? { requiredForDelivery: true } : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.deliveryChecklistItem.findMany({
        where,
        orderBy: [{ category: "asc" }, { title: "asc" }],
        skip,
        take: pageSize
      }),
      this.prisma.deliveryChecklistItem.count({ where })
    ]);

    return { items, meta: createPaginationMeta(page, pageSize, total) };
  }
}
