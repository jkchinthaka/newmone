import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AuditAction,
  Prisma,
  QaEnvironment,
  QaIssueCategory,
  QaIssueSeverity,
  QaIssueStatus,
  QaRegressionResult,
  RoleName
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { createPaginationMeta } from "../../common/utils/pagination-meta";
import { clampPage, clampPageSize } from "../../common/utils/pagination.util";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import {
  categoryRequiresRca,
  isSecurityCategory,
  QA_CATEGORY_CATALOG,
  QA_UAT_PHASES
} from "./qa.constants";
import {
  containsSecretPatterns,
  sanitizeIssueForViewer,
  sanitizeQaText
} from "./qa-sanitize.util";
import type {
  CreateQaIssueDto,
  QaAcceptRiskDto,
  QaAssignDto,
  QaCloseDto,
  QaIssueListQueryDto,
  QaRcaDto,
  QaRegressionTestDto,
  QaReleaseReportQueryDto,
  QaReopenDto,
  QaStatusChangeDto,
  QaTriageDto,
  UpdateQaIssueDto
} from "./dto/qa.dto";

export type ReleaseReadinessVerdict =
  | "NOT_READY"
  | "PILOT_READY"
  | "DEPARTMENT_ROLLOUT_READY"
  | "FULL_COMPANY_LIVE_READY";

@Injectable()
export class QaIssuesService {
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

  canManageQa(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("qa.manage");
  }

  canViewSensitive(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("qa.manage") || permissions.includes("qa.view.sensitive");
  }

  canAcceptRisk(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("qa.accept_risk") || actorRole === RoleName.MANAGER;
  }

  canExport(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("qa.export");
  }

  private async nextIssueNo(tenantId: string | null): Promise<string> {
    const count = await this.prisma.qaIssue.count({
      where: tenantId ? { tenantId } : {}
    });
    return `QA-${String(count + 1).padStart(4, "0")}`;
  }

  private tenantWhere() {
    const tenantId = this.requireTenantId();
    return tenantId ? { tenantId } : {};
  }

  private async audit(
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
    beforeData?: Prisma.InputJsonValue,
    afterData?: Prisma.InputJsonValue,
    reason?: string
  ) {
    await writeAuditTrail(this.prisma, {
      entity: "QaIssue",
      entityId,
      action: AuditAction.UPDATE,
      module: "qa",
      reason,
      metadata: { event: action, ...metadata } as Prisma.InputJsonValue,
      beforeData,
      afterData
    });
  }

  private mapIssue(issue: Record<string, unknown>) {
    const canView = this.canViewSensitive();
    const canManage = this.canManageQa();
    const { actorId } = this.ctx();

    if (!canManage && issue.reportedByUserId !== actorId) {
      if (issue.isSensitive || isSecurityCategory(issue.category as QaIssueCategory)) {
        throw new ForbiddenException("You do not have permission to view this issue");
      }
    }

    return sanitizeIssueForViewer(issue, canView);
  }

  getCategories() {
    return QA_CATEGORY_CATALOG;
  }

  async findAll(query: QaIssueListQueryDto) {
    const tenantId = this.requireTenantId();
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const skip = (page - 1) * pageSize;
    const canManage = this.canManageQa();
    const actorId = this.requireActorId();

    const where: Prisma.QaIssueWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(query.category ? { category: query.category as QaIssueCategory } : {}),
      ...(query.severity ? { severity: query.severity as QaIssueSeverity } : {}),
      ...(query.priority ? { priority: query.priority as Prisma.EnumQaIssuePriorityFilter } : {}),
      ...(query.status ? { status: query.status as QaIssueStatus } : {}),
      ...(query.module?.trim() ? { affectedModule: { contains: query.module.trim(), mode: "insensitive" } } : {}),
      ...(query.environment ? { environment: query.environment as QaEnvironment } : {}),
      ...(query.assignedTo ? { assignedToUserId: query.assignedTo } : {}),
      ...(query.reportedBy ? { reportedByUserId: query.reportedBy } : {}),
      ...(query.uatPhase ? { linkedUatPhase: query.uatPhase } : {}),
      ...(query.knownOnly === "true" || query.knownOnly === "1"
        ? { status: QaIssueStatus.ACCEPTED_RISK }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
            }
          }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: "insensitive" } },
              { issueNo: { contains: query.search.trim(), mode: "insensitive" } },
              { description: { contains: query.search.trim(), mode: "insensitive" } },
              { affectedModule: { contains: query.search.trim(), mode: "insensitive" } }
            ]
          }
        : {}),
      ...(!canManage ? { reportedByUserId: actorId } : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.qaIssue.findMany({
        where,
        include: {
          rcaRecords: { orderBy: { createdAt: "desc" }, take: 1 },
          regressionTests: { orderBy: { testDate: "desc" }, take: 3 }
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize
      }),
      this.prisma.qaIssue.count({ where })
    ]);

    return {
      items: items.map((item) => this.mapIssue(item as unknown as Record<string, unknown>)),
      meta: createPaginationMeta(page, pageSize, total)
    };
  }

  async findOne(id: string) {
    const issue = await this.prisma.qaIssue.findFirst({
      where: { id, ...this.tenantWhere() },
      include: {
        rcaRecords: { orderBy: { createdAt: "desc" } },
        regressionTests: { orderBy: { testDate: "desc" } }
      }
    });
    if (!issue) throw new NotFoundException("Issue not found");
    return this.mapIssue(issue as unknown as Record<string, unknown>);
  }

  async create(dto: CreateQaIssueDto) {
    const tenantId = this.requireTenantId();
    const actorId = this.requireActorId();
    const issueNo = await this.nextIssueNo(tenantId);

    const rawText = [dto.description, dto.reproductionSteps, dto.actualResult].filter(Boolean).join("\n");
    const isSensitive =
      containsSecretPatterns(rawText) ||
      isSecurityCategory(dto.category) ||
      dto.category === "DATABASE_ERROR";

    const issue = await this.prisma.qaIssue.create({
      data: {
        tenantId,
        issueNo,
        title: dto.title.trim(),
        description: sanitizeQaText(dto.description),
        category: dto.category,
        subCategory: dto.subCategory?.trim() || null,
        severity: dto.severity ?? QaIssueSeverity.MEDIUM,
        priority: dto.priority ?? "MEDIUM",
        status: QaIssueStatus.REPORTED,
        affectedModule: dto.affectedModule?.trim() || null,
        affectedPage: dto.affectedPage?.trim() || null,
        affectedApi: dto.affectedApi?.trim() || null,
        environment: dto.environment ?? QaEnvironment.STAGING,
        reportedByUserId: actorId,
        reproductionSteps: sanitizeQaText(dto.reproductionSteps),
        expectedResult: sanitizeQaText(dto.expectedResult),
        actualResult: sanitizeQaText(dto.actualResult),
        businessImpact: sanitizeQaText(dto.businessImpact),
        userImpact: sanitizeQaText(dto.userImpact),
        linkedUatPhase: dto.linkedUatPhase?.trim() || null,
        linkedWorkOrderId: dto.linkedWorkOrderId || null,
        isSensitive,
        regressionRequired:
          dto.severity === QaIssueSeverity.CRITICAL || dto.environment === QaEnvironment.PRODUCTION,
        firstDetectedAt: new Date()
      },
      include: { rcaRecords: true, regressionTests: true }
    });

    await writeAuditTrail(this.prisma, {
      entity: "QaIssue",
      entityId: issue.id,
      action: AuditAction.CREATE,
      module: "qa",
      metadata: { event: "qa_issue_created", category: issue.category, isSensitive }
    });

    return this.mapIssue(issue as unknown as Record<string, unknown>);
  }

  async update(id: string, dto: UpdateQaIssueDto) {
    if (!this.canManageQa()) throw new ForbiddenException("You do not have permission to perform this action");
    const existing = await this.prisma.qaIssue.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Issue not found");

    const data: Prisma.QaIssueUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = sanitizeQaText(dto.description);
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.subCategory !== undefined) data.subCategory = dto.subCategory?.trim() || null;
    if (dto.severity !== undefined) {
      if (dto.severity !== existing.severity && !dto.reason?.trim()) {
        throw new BadRequestException("Severity change requires a reason");
      }
      data.severity = dto.severity;
    }
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.affectedModule !== undefined) data.affectedModule = dto.affectedModule?.trim() || null;
    if (dto.affectedPage !== undefined) data.affectedPage = dto.affectedPage?.trim() || null;
    if (dto.affectedApi !== undefined) data.affectedApi = dto.affectedApi?.trim() || null;
    if (dto.fixSummary !== undefined) data.fixSummary = sanitizeQaText(dto.fixSummary);
    if (dto.workaround !== undefined) data.workaround = sanitizeQaText(dto.workaround);
    if (dto.regressionRisk !== undefined) data.regressionRisk = sanitizeQaText(dto.regressionRisk);
    if (dto.linkedCommitHash !== undefined) data.linkedCommitHash = dto.linkedCommitHash?.trim() || null;
    if (dto.linkedDeployId !== undefined) data.linkedDeployId = dto.linkedDeployId?.trim() || null;
    if (dto.linkedUatPhase !== undefined) data.linkedUatPhase = dto.linkedUatPhase?.trim() || null;

    const updated = await this.prisma.qaIssue.update({
      where: { id },
      data,
      include: { rcaRecords: true, regressionTests: true }
    });

    await this.audit("qa_issue_updated", id, {}, existing as object, updated as object);
    if (dto.severity !== undefined && dto.severity !== existing.severity) {
      await this.audit(
        "qa_issue_severity_changed",
        id,
        { from: existing.severity, to: dto.severity },
        existing as object,
        updated as object,
        dto.reason
      );
    }
    return this.mapIssue(updated as unknown as Record<string, unknown>);
  }

  async triage(id: string, dto: QaTriageDto) {
    if (!this.canManageQa()) throw new ForbiddenException("You do not have permission to perform this action");
    const existing = await this.prisma.qaIssue.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Issue not found");

    const updated = await this.prisma.qaIssue.update({
      where: { id },
      data: {
        status: QaIssueStatus.TRIAGED,
        ...(dto.severity ? { severity: dto.severity } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.ownerDepartment ? { ownerDepartment: dto.ownerDepartment.trim() } : {})
      },
      include: { rcaRecords: true, regressionTests: true }
    });

    await this.audit("qa_issue_triaged", id, { reason: dto.reason }, existing as object, updated as object, dto.reason);
    return this.mapIssue(updated as unknown as Record<string, unknown>);
  }

  async assign(id: string, dto: QaAssignDto) {
    if (!this.canManageQa()) throw new ForbiddenException("You do not have permission to perform this action");
    const existing = await this.prisma.qaIssue.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Issue not found");

    const updated = await this.prisma.qaIssue.update({
      where: { id },
      data: {
        assignedToUserId: dto.assignedToUserId,
        status: existing.status === QaIssueStatus.REPORTED ? QaIssueStatus.IN_PROGRESS : existing.status
      },
      include: { rcaRecords: true, regressionTests: true }
    });

    await this.audit(
      "qa_issue_assigned",
      id,
      { assignedToUserId: dto.assignedToUserId },
      existing as object,
      updated as object,
      dto.reason
    );
    return this.mapIssue(updated as unknown as Record<string, unknown>);
  }

  async changeStatus(id: string, dto: QaStatusChangeDto) {
    if (!this.canManageQa()) throw new ForbiddenException("You do not have permission to perform this action");
    const existing = await this.prisma.qaIssue.findFirst({
      where: { id, ...this.tenantWhere() },
      include: { rcaRecords: true, regressionTests: true }
    });
    if (!existing) throw new NotFoundException("Issue not found");

    if (dto.status === QaIssueStatus.CLOSED) {
      throw new BadRequestException("Use the close endpoint with a resolution note");
    }

    const now = new Date();
    const data: Prisma.QaIssueUpdateInput = { status: dto.status };
    if (dto.status === QaIssueStatus.FIXED) data.fixedAt = now;
    if (dto.status === QaIssueStatus.RETESTING) data.regressionRequired = true;
    if (dto.resolutionNote) data.resolutionNote = sanitizeQaText(dto.resolutionNote);

    const updated = await this.prisma.qaIssue.update({
      where: { id },
      data,
      include: { rcaRecords: true, regressionTests: true }
    });

    await this.audit(
      "qa_issue_status_changed",
      id,
      { from: existing.status, to: dto.status },
      existing as object,
      updated as object,
      dto.reason
    );
    return this.mapIssue(updated as unknown as Record<string, unknown>);
  }

  async addRca(id: string, dto: QaRcaDto) {
    if (!this.canManageQa()) throw new ForbiddenException("You do not have permission to perform this action");
    const actorId = this.requireActorId();
    const issue = await this.prisma.qaIssue.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!issue) throw new NotFoundException("Issue not found");

    const rca = await this.prisma.qaIssueRca.create({
      data: {
        issueId: id,
        rootCauseType: dto.rootCauseType,
        explanation: sanitizeQaText(dto.explanation),
        preventiveAction: sanitizeQaText(dto.preventiveAction),
        ownerUserId: dto.ownerUserId || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        verificationStatus: dto.verificationStatus?.trim() || null,
        createdByUserId: actorId
      }
    });

    await this.prisma.qaIssue.update({
      where: { id },
      data: { rootCause: sanitizeQaText(dto.explanation) }
    });

    await this.audit("qa_issue_rca_added", id, { rcaId: rca.id });
    return this.findOne(id);
  }

  async addRegressionTest(id: string, dto: QaRegressionTestDto) {
    if (!this.canManageQa()) throw new ForbiddenException("You do not have permission to perform this action");
    const actorId = this.requireActorId();
    const issue = await this.prisma.qaIssue.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!issue) throw new NotFoundException("Issue not found");

    await this.prisma.qaRegressionTest.create({
      data: {
        issueId: id,
        testCase: dto.testCase.trim(),
        testedByUserId: actorId,
        testDate: new Date(),
        roleUsed: dto.roleUsed?.trim() || null,
        environment: dto.environment,
        result: dto.result,
        notes: sanitizeQaText(dto.notes),
        reference: dto.reference?.trim() || null
      }
    });

    let nextStatus: QaIssueStatus = issue.status;
    if (dto.result === QaRegressionResult.PASS) {
      nextStatus = QaIssueStatus.PASSED;
    } else {
      nextStatus = QaIssueStatus.REOPENED;
    }

    await this.prisma.qaIssue.update({
      where: { id },
      data: {
        regressionResult: dto.result,
        status: nextStatus,
        ...(dto.result === QaRegressionResult.FAIL ? { fixedAt: null } : {})
      }
    });

    await this.audit("qa_issue_regression_tested", id, { result: dto.result });
    if (dto.result === QaRegressionResult.FAIL) {
      await this.audit("qa_issue_reopened", id, { reason: "Regression test failed" });
    }
    return this.findOne(id);
  }

  private async assertCanClose(issue: {
    id: string;
    severity: QaIssueSeverity;
    environment: QaEnvironment;
    status: QaIssueStatus;
    category: QaIssueCategory;
    rcaRecords: unknown[];
    regressionTests: Array<{ result: QaRegressionResult }>;
    regressionRequired: boolean;
  }) {
    const needsRca = categoryRequiresRca(
      issue.severity,
      issue.environment,
      issue.status === QaIssueStatus.REOPENED
    );
    if (needsRca && issue.rcaRecords.length === 0) {
      throw new BadRequestException("Root cause analysis is required before closing this issue");
    }

    const criticalProd =
      issue.severity === QaIssueSeverity.CRITICAL && issue.environment === QaEnvironment.PRODUCTION;
    const hasPass = issue.regressionTests.some((t) => t.result === QaRegressionResult.PASS);
    if ((criticalProd || issue.regressionRequired) && !hasPass) {
      throw new BadRequestException("Critical production issue cannot close without a PASS regression test");
    }
  }

  async close(id: string, dto: QaCloseDto) {
    if (!this.canManageQa()) throw new ForbiddenException("You do not have permission to perform this action");
    const existing = await this.prisma.qaIssue.findFirst({
      where: { id, ...this.tenantWhere() },
      include: { rcaRecords: true, regressionTests: true }
    });
    if (!existing) throw new NotFoundException("Issue not found");

    await this.assertCanClose(existing);

    const updated = await this.prisma.qaIssue.update({
      where: { id },
      data: {
        status: QaIssueStatus.CLOSED,
        resolutionNote: sanitizeQaText(dto.resolutionNote),
        fixSummary: dto.fixSummary ? sanitizeQaText(dto.fixSummary) : existing.fixSummary,
        closedAt: new Date()
      },
      include: { rcaRecords: true, regressionTests: true }
    });

    await this.audit("qa_issue_closed", id, {}, existing as object, updated as object, dto.resolutionNote);
    return this.mapIssue(updated as unknown as Record<string, unknown>);
  }

  async acceptRisk(id: string, dto: QaAcceptRiskDto) {
    if (!this.canAcceptRisk()) {
      throw new ForbiddenException("Manager or admin approval is required to accept risk");
    }
    const actorId = this.requireActorId();
    const existing = await this.prisma.qaIssue.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Issue not found");

    const updated = await this.prisma.qaIssue.update({
      where: { id },
      data: {
        status: QaIssueStatus.ACCEPTED_RISK,
        acceptedRiskByUserId: actorId,
        acceptedRiskAt: new Date(),
        knownLimitation: sanitizeQaText(dto.knownLimitation),
        futureFixPlan: sanitizeQaText(dto.futureFixPlan),
        riskReviewDate: dto.riskReviewDate ? new Date(dto.riskReviewDate) : null,
        resolutionNote: sanitizeQaText(dto.reason),
        closedAt: new Date()
      },
      include: { rcaRecords: true, regressionTests: true }
    });

    await this.audit("qa_issue_risk_accepted", id, {}, existing as object, updated as object, dto.reason);
    return this.mapIssue(updated as unknown as Record<string, unknown>);
  }

  async reopen(id: string, dto: QaReopenDto) {
    if (!this.canManageQa()) throw new ForbiddenException("You do not have permission to perform this action");
    const existing = await this.prisma.qaIssue.findFirst({ where: { id, ...this.tenantWhere() } });
    if (!existing) throw new NotFoundException("Issue not found");

    const updated = await this.prisma.qaIssue.update({
      where: { id },
      data: {
        status: QaIssueStatus.REOPENED,
        closedAt: null,
        fixedAt: null
      },
      include: { rcaRecords: true, regressionTests: true }
    });

    await this.audit("qa_issue_reopened", id, {}, existing as object, updated as object, dto.reason);
    return this.mapIssue(updated as unknown as Record<string, unknown>);
  }

  async getDashboard() {
    if (!this.canManageQa()) {
      const actorId = this.requireActorId();
      const tenantId = this.requireTenantId();
      const mine = await this.prisma.qaIssue.count({
        where: { ...(tenantId ? { tenantId } : {}), reportedByUserId: actorId, status: { not: QaIssueStatus.CLOSED } }
      });
      return {
        scope: "own",
        myOpenIssues: mine,
        categories: QA_CATEGORY_CATALOG.map((c) => c.key)
      };
    }

    const tenantId = this.requireTenantId();
    const base = tenantId ? { tenantId } : {};
    const openStatuses = {
      status: { notIn: [QaIssueStatus.CLOSED, QaIssueStatus.ACCEPTED_RISK] as QaIssueStatus[] }
    };

    const [
      openCritical,
      openHigh,
      productionIncidents,
      reopened,
      securityIssues,
      deploymentIssues,
      dataQualityIssues,
      byCategory,
      byStatus,
      byModule
    ] = await Promise.all([
      this.prisma.qaIssue.count({ where: { ...base, ...openStatuses, severity: QaIssueSeverity.CRITICAL } }),
      this.prisma.qaIssue.count({ where: { ...base, ...openStatuses, severity: QaIssueSeverity.HIGH } }),
      this.prisma.qaIssue.count({
        where: { ...base, environment: QaEnvironment.PRODUCTION, ...openStatuses }
      }),
      this.prisma.qaIssue.count({ where: { ...base, status: QaIssueStatus.REOPENED } }),
      this.prisma.qaIssue.count({
        where: { ...base, category: { in: ["SECURITY_ERROR", "AUTH_RBAC_ERROR"] }, ...openStatuses }
      }),
      this.prisma.qaIssue.count({ where: { ...base, category: "DEPLOYMENT_ERROR", ...openStatuses } }),
      this.prisma.qaIssue.count({ where: { ...base, category: "DATA_QUALITY_ERROR", ...openStatuses } }),
      this.prisma.qaIssue.groupBy({ by: ["category"], where: { ...base, ...openStatuses }, _count: true }),
      this.prisma.qaIssue.groupBy({ by: ["status"], where: base, _count: true }),
      this.prisma.qaIssue.groupBy({
        by: ["affectedModule"],
        where: { ...base, ...openStatuses, affectedModule: { not: null } },
        _count: true
      })
    ]);

    const regressionFailed = await this.prisma.qaIssue.count({
      where: { ...base, regressionResult: QaRegressionResult.FAIL, ...openStatuses }
    });

    return {
      scope: "tenant",
      openCritical,
      openHigh,
      productionIncidents,
      reopened,
      regressionFailed,
      securityIssues,
      deploymentIssues,
      dataQualityIssues,
      byCategory: byCategory.map((row) => ({ category: row.category, count: row._count })),
      byStatus: byStatus.map((row) => ({ status: row.status, count: row._count })),
      byModule: byModule
        .filter((row) => row.affectedModule)
        .map((row) => ({ module: row.affectedModule, count: row._count })),
      uatPhases: QA_UAT_PHASES
    };
  }

  async releaseQualityReport(query: QaReleaseReportQueryDto) {
    if (!this.canManageQa() && !this.canExport()) {
      throw new ForbiddenException("You do not have permission to view release quality reports");
    }

    const tenantId = this.requireTenantId();
    const where: Prisma.QaIssueWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(query.uatPhase ? { linkedUatPhase: query.uatPhase } : {}),
      ...(query.environment ? { environment: query.environment as QaEnvironment } : {}),
      ...(query.module?.trim()
        ? { affectedModule: { contains: query.module.trim(), mode: "insensitive" } }
        : {}),
      ...(query.severity ? { severity: query.severity as QaIssueSeverity } : {}),
      ...(query.status ? { status: query.status as QaIssueStatus } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
            }
          }
        : {})
    };

    const issues = await this.prisma.qaIssue.findMany({ where });
    const openCriticalProd = issues.filter(
      (i) =>
        i.severity === QaIssueSeverity.CRITICAL &&
        i.environment === QaEnvironment.PRODUCTION &&
        i.status !== QaIssueStatus.CLOSED &&
        i.status !== QaIssueStatus.ACCEPTED_RISK
    ).length;
    const openHighSecurity = issues.filter(
      (i) =>
        (i.category === "SECURITY_ERROR" || i.category === "AUTH_RBAC_ERROR") &&
        (i.severity === QaIssueSeverity.HIGH || i.severity === QaIssueSeverity.CRITICAL) &&
        i.status !== QaIssueStatus.CLOSED &&
        i.status !== QaIssueStatus.ACCEPTED_RISK
    ).length;

    const summary = {
      total: issues.length,
      openCritical: issues.filter(
        (i) => i.severity === QaIssueSeverity.CRITICAL && i.status !== QaIssueStatus.CLOSED && i.status !== QaIssueStatus.ACCEPTED_RISK
      ).length,
      openHigh: issues.filter(
        (i) => i.severity === QaIssueSeverity.HIGH && i.status !== QaIssueStatus.CLOSED && i.status !== QaIssueStatus.ACCEPTED_RISK
      ).length,
      fixed: issues.filter((i) => i.status === QaIssueStatus.CLOSED || i.status === QaIssueStatus.PASSED).length,
      reopened: issues.filter((i) => i.status === QaIssueStatus.REOPENED).length,
      regressionFailed: issues.filter((i) => i.regressionResult === QaRegressionResult.FAIL).length,
      acceptedRisks: issues.filter((i) => i.status === QaIssueStatus.ACCEPTED_RISK).length,
      deploymentIssues: issues.filter((i) => i.category === "DEPLOYMENT_ERROR").length,
      productionIncidents: issues.filter((i) => i.environment === QaEnvironment.PRODUCTION).length
    };

    let verdict: ReleaseReadinessVerdict = "FULL_COMPANY_LIVE_READY";
    if (openCriticalProd > 0 || openHighSecurity > 0) verdict = "NOT_READY";
    else if (summary.openCritical > 0 || summary.openHigh > 2) verdict = "NOT_READY";
    else if (summary.openHigh > 0 || summary.regressionFailed > 0) verdict = "DEPARTMENT_ROLLOUT_READY";
    else if (summary.acceptedRisks > 0) verdict = "PILOT_READY";

    await this.audit("qa_report_exported", "release-quality", { verdict, filters: query });

    return { summary, verdict, filters: query };
  }

  async exportReport(query: QaReleaseReportQueryDto) {
    if (!this.canExport()) throw new ForbiddenException("You do not have permission to export QA reports");
    const report = await this.releaseQualityReport(query);
    const rows = await this.findAll({
      ...query,
      page: "1",
      pageSize: "500"
    });
    return {
      ...report,
      exportedAt: new Date().toISOString(),
      issues: rows.items
    };
  }

  async createFromHealthCheck(input: {
    checkKey: string;
    checkLabel: string;
    message: string;
    category?: QaIssueCategory;
    severity?: QaIssueSeverity;
  }) {
    if (!this.canManageQa()) throw new ForbiddenException("You do not have permission to perform this action");
    return this.create({
      title: `System Health failure: ${input.checkLabel}`,
      description: sanitizeQaText(input.message),
      category: input.category ?? QaIssueCategory.BACKEND_ERROR,
      severity: input.severity ?? QaIssueSeverity.HIGH,
      priority: "HIGH",
      affectedModule: "System Health",
      affectedPage: "/system-health",
      environment: QaEnvironment.PRODUCTION,
      reproductionSteps: `Open System Health and inspect check "${input.checkKey}".`,
      expectedResult: "Check should be operational",
      actualResult: input.message
    });
  }
}
