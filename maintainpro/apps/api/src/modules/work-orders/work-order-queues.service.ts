import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  RoleName,
  VendorInvoiceStatus,
  WorkOrderApprovalStatus,
  WorkOrderStatus,
  WorkOrderVerificationStatus,
  WorkOrderPartLineStatus,
  WorkOrderType,
  Priority,
  QrVerificationStatus,
  EvidenceVerificationStatus,
  EvidenceAttachmentStatus
} from "@prisma/client";

import {
  calculateWorkOrderRiskScore,
  resolveRiskSeverity,
  type RiskSeverity,
  type WorkOrderRiskFactors
} from "../../common/utils/maintenance-risk-score";
import { pendingQuantity } from "../../common/utils/work-order-parts-governance";
import { evaluateEvidenceRequirements } from "../../common/utils/work-order-evidence-governance";
import {
  ACTIVE_OPERATIONAL_STATUSES,
  isSupervisorVerificationPending,
  isWorkOrderOverdue,
  overdueDayCount,
  priorityWeight,
  resolveDefaultQueueForRole,
  roleCanAccessQueue,
  severityWeight,
  SMART_VIEW_KEYS,
  SMART_VIEW_LABELS,
  TERMINAL_STATUSES,
  type SmartViewKey,
  type WorkOrderActionRequiredItem,
  type WorkOrderActionRequiredType,
  type WorkOrderQueueKey,
  WORK_ORDER_QUEUE_KEYS,
  WORK_ORDER_QUEUE_LABELS
} from "../../common/utils/work-order-queues";
import { PrismaService } from "../../database/prisma.service";
import { MaintenanceReportsService } from "../reports/maintenance-reports.service";
import { WorkOrderCategoryReportsService } from "../reports/work-order-category-reports.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

export type WorkOrderQueueQuery = {
  queue?: string;
  search?: string;
  query?: string;
  smartView?: string;
  dateFrom?: string;
  dateTo?: string;
  dueFrom?: string;
  dueTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  status?: string;
  priority?: string;
  departmentId?: string;
  branchId?: string;
  assetId?: string;
  vehicleId?: string;
  employeeId?: string;
  requesterId?: string;
  type?: string;
  categoryId?: string;
  taxonomyCategoryId?: string;
  taxonomyTypeId?: string;
  taxonomyIssueId?: string;
  triageOnly?: string | boolean;
  riskSeverity?: RiskSeverity;
  evidenceStatus?: string;
  partsStatus?: string;
  verificationStatus?: string;
  overdueOnly?: string | boolean;
  highRiskOnly?: string | boolean;
  myAssignedOnly?: string | boolean;
  page?: string | number;
  pageSize?: string | number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
};

const listInclude = {
  asset: { include: { departmentRef: { select: { id: true, name: true } } } },
  vehicle: true,
  technician: { include: { role: true } },
  createdBy: { include: { role: true } },
  parts: { include: { part: true } },
  partIssues: { select: { id: true }, take: 5 },
  assignees: {
    include: {
      employee: { select: { id: true, fullName: true, branchName: true, linkedUserId: true } }
    }
  },
  evidenceAttachments: {
    where: { deletedAt: null, status: { not: "DELETED" } },
    select: { id: true, evidenceType: true, status: true, verificationStatus: true }
  },
  vendorRepairCase: {
    select: {
      id: true,
      status: true,
      invoices: { select: { status: true }, take: 3 }
    }
  }
} satisfies Prisma.WorkOrderInclude;

type WorkOrderRow = Prisma.WorkOrderGetPayload<{ include: typeof listInclude }>;

function readQueueCountTimeoutMs() {
  return Number(process.env.WORK_ORDER_QUEUE_COUNT_TIMEOUT_MS ?? 2_500);
}

function readQueueSummaryEndpointTimeoutMs() {
  return Number(process.env.WORK_ORDER_QUEUE_SUMMARY_ENDPOINT_TIMEOUT_MS ?? 8_000);
}

export type WorkOrderQueueListItem = WorkOrderRow & {
  riskScore: number;
  riskSeverity: RiskSeverity;
  actionRequired: WorkOrderActionRequiredItem[];
  partsStatus: string;
  evidenceStatus: string;
  overdueDays: number;
  primaryAssigneeName?: string | null;
};

const TECHNICIAN_ROLES = new Set<RoleName>([RoleName.TECHNICIAN, RoleName.MECHANIC]);
const ADMIN_ROLES = new Set<RoleName>([RoleName.SUPER_ADMIN, RoleName.ADMIN]);
const MANAGER_ROLES = new Set<RoleName>([
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER,
  RoleName.FLEET_MANAGER,
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN
]);

type EnrichedQueueRow = Awaited<ReturnType<WorkOrderQueuesService["enrichRow"]>>;

export type WorkOrderQueueSummaryWarning = {
  queue: string;
  message: string;
};

export type WorkOrderQueueSummaryResponse = {
  queues: Array<{
    key: WorkOrderQueueKey;
    label: string;
    count: number;
    severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }>;
  defaultQueue: WorkOrderQueueKey;
  summary: {
    actionRequired: number;
    myTasks: number;
    waitingParts: number;
    waitingEvidence: number;
    supervisorVerification: number;
    highRisk: number;
    overdue: number;
    triage: number;
  };
  warnings?: WorkOrderQueueSummaryWarning[];
  lastUpdated: string;
};

export type WorkOrderQueueDiagnostics = {
  implementation: string;
  commit: string | null;
  nodeEnv: string | null;
};

@Injectable()
export class WorkOrderQueuesService {
  static readonly QUEUES_SUMMARY_IMPLEMENTATION = "queues-lightweight-v2";

  private readonly logger = new Logger(WorkOrderQueuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly maintenanceReports: MaintenanceReportsService,
    private readonly categoryReports: WorkOrderCategoryReportsService
  ) {}

  getSmartViews(actor: Actor) {
    const role = actor.role as RoleName;
    const views = SMART_VIEW_KEYS.filter((key) => {
      if (key === "high-risk" || key === "supervisor-verification") {
        return !TECHNICIAN_ROLES.has(role);
      }
      if (key === "parts-pending-return" || key === "waiting-parts") {
        return true;
      }
      return true;
    }).map((key) => ({
      key,
      label: SMART_VIEW_LABELS[key],
      queueKey: this.smartViewToQueue(key)
    }));

    return {
      views,
      defaultQueue: resolveDefaultQueueForRole(role),
      generatedAt: new Date().toISOString()
    };
  }

  async getQueueSummary(actor: Actor): Promise<WorkOrderQueueSummaryResponse> {
    const startedAt = Date.now();
    const role = actor.role as RoleName;
    const accessible = WORK_ORDER_QUEUE_KEYS.filter((key) => roleCanAccessQueue(role, key));

    this.logger.log(
      `work-order queues summary started user=${actor.sub} tenant=${actor.tenantId ?? "none"} impl=${WorkOrderQueuesService.QUEUES_SUMMARY_IMPLEMENTATION}`
    );

    const fallback = this.buildTimeoutFallback(accessible, role);
    const result = await this.withQueueSummaryTimeout(
      this.buildLightweightQueueSummary(actor, accessible, role),
      fallback,
      readQueueSummaryEndpointTimeoutMs()
    );

    const usedFallback = Boolean(result.warnings?.some((warning) => warning.queue === "all"));
    this.logger.log(
      `work-order queues summary completed in ${Date.now() - startedAt}ms tenant=${actor.tenantId ?? "none"} fallback=${usedFallback}`
    );

    return result;
  }

  getQueueDiagnostics(): WorkOrderQueueDiagnostics {
    return {
      implementation: WorkOrderQueuesService.QUEUES_SUMMARY_IMPLEMENTATION,
      commit: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? process.env.RENDER_GIT_COMMIT_SHA ?? null,
      nodeEnv: process.env.NODE_ENV ?? null
    };
  }

  private async withQueueSummaryTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((resolve) => {
          timer = setTimeout(() => resolve(fallback), timeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async buildLightweightQueueSummary(
    actor: Actor,
    accessible: WorkOrderQueueKey[],
    role: RoleName
  ): Promise<WorkOrderQueueSummaryResponse> {
    const warnings: WorkOrderQueueSummaryWarning[] = [];
    const now = new Date();

    const countDefinitions: Partial<
      Record<
        WorkOrderQueueKey,
        {
          where: Prisma.WorkOrderWhereInput;
          severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        }
      >
    > = {
      "action-required": { where: this.actionRequiredWhere(now), severity: "HIGH" },
      "my-tasks": { where: this.mergeWhere(this.nonTerminalWhere(), this.myTasksWhere(actor)) },
      "open-requests": { where: { status: WorkOrderStatus.OPEN } },
      "approved-planned": {
        where: { approvalStatus: WorkOrderApprovalStatus.APPROVED, status: WorkOrderStatus.OPEN }
      },
      assigned: { where: this.assignedWhere() },
      "in-progress": {
        where: { status: { in: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD] } }
      },
      "waiting-parts": { where: this.waitingPartsWhere() },
      "waiting-evidence": { where: this.waitingEvidenceWhere() },
      "technician-completed": { where: { status: WorkOrderStatus.TECHNICIAN_COMPLETED } },
      "supervisor-verification": { where: this.supervisorVerificationWhere() },
      "rework-required": { where: { status: WorkOrderStatus.REWORK_REQUIRED } },
      overdue: { where: this.overdueWhere(now), severity: "HIGH" },
      "high-risk": { where: this.highRiskWhere(now), severity: "CRITICAL" },
      "finance-vendor-pending": { where: this.financeVendorPendingWhere() },
      triage: { where: this.mergeWhere(this.nonTerminalWhere(), { isTriage: true }) },
      completed: { where: { status: WorkOrderStatus.COMPLETED } },
      cancelled: { where: { status: WorkOrderStatus.CANCELLED } },
      all: { where: {} }
    };

    const queueResults = await Promise.all(
      accessible.map((key) => {
        const definition = countDefinitions[key] ?? { where: {} };
        return this.safeCount(key, warnings, () => this.countScoped(actor, definition.where), definition.severity);
      })
    );

    const countByKey = new Map(queueResults.map((entry) => [entry.key, entry.count]));

    return {
      queues: queueResults,
      defaultQueue: resolveDefaultQueueForRole(role),
      summary: {
        actionRequired: countByKey.get("action-required") ?? 0,
        myTasks: countByKey.get("my-tasks") ?? 0,
        waitingParts: countByKey.get("waiting-parts") ?? 0,
        waitingEvidence: countByKey.get("waiting-evidence") ?? 0,
        supervisorVerification: countByKey.get("supervisor-verification") ?? 0,
        highRisk: countByKey.get("high-risk") ?? 0,
        overdue: countByKey.get("overdue") ?? 0,
        triage: countByKey.get("triage") ?? 0
      },
      ...(warnings.length > 0 ? { warnings } : {}),
      lastUpdated: new Date().toISOString()
    };
  }

  private buildTimeoutFallback(
    accessible: WorkOrderQueueKey[],
    role: RoleName
  ): WorkOrderQueueSummaryResponse {
    return this.buildEmptyQueueSummary(accessible, role, [
      { queue: "all", message: "Queue summary timed out" }
    ]);
  }

  private async countScoped(actor: Actor, extra: Prisma.WorkOrderWhereInput): Promise<number> {
    return this.prisma.workOrder.count({
      where: this.mergeWhere(this.buildScopedBaseWhere(actor), extra)
    });
  }

  private buildScopedBaseWhere(actor: Actor): Prisma.WorkOrderWhereInput {
    return this.buildPrismaWhere(actor, {});
  }

  private mergeWhere(...parts: Prisma.WorkOrderWhereInput[]): Prisma.WorkOrderWhereInput {
    const filtered = parts.filter((part) => Object.keys(part).length > 0);
    if (filtered.length === 0) return {};
    if (filtered.length === 1) return filtered[0];
    return { AND: filtered };
  }

  private nonTerminalWhere(): Prisma.WorkOrderWhereInput {
    return { status: { notIn: TERMINAL_STATUSES } };
  }

  private myTasksWhere(actor: Actor): Prisma.WorkOrderWhereInput {
    return {
      OR: [
        { technicianId: actor.sub },
        { assignees: { some: { employee: { linkedUserId: actor.sub } } } }
      ]
    };
  }

  private overdueWhere(now = new Date()): Prisma.WorkOrderWhereInput {
    return {
      OR: [
        { status: WorkOrderStatus.OVERDUE },
        {
          dueDate: { lt: now },
          status: { notIn: TERMINAL_STATUSES }
        }
      ]
    };
  }

  private assignedWhere(): Prisma.WorkOrderWhereInput {
    return this.mergeWhere(this.nonTerminalWhere(), {
      status: { in: ACTIVE_OPERATIONAL_STATUSES },
      OR: [{ technicianId: { not: null } }, { assignees: { some: {} } }]
    });
  }

  private supervisorVerificationWhere(): Prisma.WorkOrderWhereInput {
    return {
      status: WorkOrderStatus.TECHNICIAN_COMPLETED,
      verificationStatus: WorkOrderVerificationStatus.PENDING
    };
  }

  private waitingPartsWhere(): Prisma.WorkOrderWhereInput {
    return this.mergeWhere(this.nonTerminalWhere(), {
      OR: [
        { parts: { some: { lineStatus: WorkOrderPartLineStatus.REQUESTED } } },
        { parts: { some: { pendingReturnQuantity: { gt: 0 } } } },
        {
          parts: {
            some: {
              lineStatus: WorkOrderPartLineStatus.APPROVED,
              issuedQuantity: 0,
              requestedQuantity: { gt: 0 }
            }
          }
        },
        { partIssues: { some: {} } }
      ]
    });
  }

  private waitingEvidenceWhere(): Prisma.WorkOrderWhereInput {
    const activeEvidenceFilter = { deletedAt: null, status: { not: EvidenceAttachmentStatus.DELETED } };
    return this.mergeWhere(this.nonTerminalWhere(), {
      OR: [
        {
          evidenceAttachments: {
            some: {
              ...activeEvidenceFilter,
              verificationStatus: EvidenceVerificationStatus.REJECTED
            }
          }
        },
        {
          type: { in: [WorkOrderType.CORRECTIVE, WorkOrderType.EMERGENCY, WorkOrderType.INSPECTION] },
          status: {
            in: [
              WorkOrderStatus.IN_PROGRESS,
              WorkOrderStatus.TECHNICIAN_COMPLETED,
              WorkOrderStatus.REWORK_REQUIRED,
              WorkOrderStatus.ON_HOLD
            ]
          },
          evidenceAttachments: { none: activeEvidenceFilter }
        }
      ]
    });
  }

  private highRiskWhere(now = new Date()): Prisma.WorkOrderWhereInput {
    return this.mergeWhere(this.nonTerminalWhere(), {
      OR: [
        { priority: Priority.CRITICAL },
        { status: WorkOrderStatus.OVERDUE },
        { slaBreached: true },
        { priority: Priority.HIGH, dueDate: { lt: now } }
      ]
    });
  }

  private financeVendorPendingWhere(): Prisma.WorkOrderWhereInput {
    return {
      vendorRepairCase: {
        invoices: {
          some: {
            status: { in: [VendorInvoiceStatus.SUBMITTED, VendorInvoiceStatus.UNDER_REVIEW] }
          }
        }
      }
    };
  }

  private actionRequiredWhere(now = new Date()): Prisma.WorkOrderWhereInput {
    return this.mergeWhere(this.nonTerminalWhere(), {
      OR: [
        { approvalStatus: WorkOrderApprovalStatus.PENDING },
        this.supervisorVerificationWhere(),
        { isTriage: true },
        ...((this.overdueWhere(now).OR as Prisma.WorkOrderWhereInput[]) ?? []),
        { parts: { some: { lineStatus: WorkOrderPartLineStatus.REQUESTED } } },
        { parts: { some: { pendingReturnQuantity: { gt: 0 } } } },
        {
          parts: {
            some: {
              lineStatus: WorkOrderPartLineStatus.APPROVED,
              issuedQuantity: 0,
              requestedQuantity: { gt: 0 }
            }
          }
        },
        this.financeVendorPendingWhere(),
        { qrVerificationStatus: QrVerificationStatus.MISMATCH },
        { status: WorkOrderStatus.REWORK_REQUIRED }
      ]
    });
  }

  private async safeCount(
    key: WorkOrderQueueKey,
    warnings: WorkOrderQueueSummaryWarning[],
    countFn: () => Promise<number>,
    severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  ): Promise<{
    key: WorkOrderQueueKey;
    label: string;
    count: number;
    severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }> {
    const startedAt = Date.now();
    try {
      const count = await this.withTimeout(countFn(), readQueueCountTimeoutMs());
      this.logger.log(`queue count ${key}=${count} in ${Date.now() - startedAt}ms`);
      return {
        key,
        label: WORK_ORDER_QUEUE_LABELS[key],
        count,
        ...(severity ? { severity } : {})
      };
    } catch (error) {
      this.logger.warn(
        `Queue count failed: ${key}`,
        error instanceof Error ? error.message : String(error)
      );
      warnings.push({ queue: key, message: "Queue count unavailable" });
      return {
        key,
        label: WORK_ORDER_QUEUE_LABELS[key],
        count: 0,
        ...(severity ? { severity } : {})
      };
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async getActionRequired(actor: Actor, query: WorkOrderQueueQuery = {}) {
    return this.listQueue(actor, "action-required", query);
  }

  async getQueue(actor: Actor, queueKey: string, query: WorkOrderQueueQuery = {}) {
    const key = queueKey as WorkOrderQueueKey;
    if (!WORK_ORDER_QUEUE_KEYS.includes(key)) {
      throw new ForbiddenException(`Unknown queue: ${queueKey}`);
    }
    if (!roleCanAccessQueue(actor.role as RoleName, key)) {
      throw new ForbiddenException("You do not have access to this work order queue.");
    }
    return this.listQueue(actor, key, query);
  }

  async search(actor: Actor, query: WorkOrderQueueQuery = {}) {
    const queue = (query.queue as WorkOrderQueueKey | undefined) ?? resolveDefaultQueueForRole(actor.role as RoleName);
    if (query.queue === "all" && TECHNICIAN_ROLES.has(actor.role as RoleName)) {
      throw new ForbiddenException("Technicians cannot access all company work orders.");
    }
    return this.listQueue(actor, queue, query);
  }

  async listWorkOrders(actor: Actor, query: WorkOrderQueueQuery = {}) {
    const queue = (query.queue as WorkOrderQueueKey | undefined) ?? resolveDefaultQueueForRole(actor.role as RoleName);
    if (queue === "all" && TECHNICIAN_ROLES.has(actor.role as RoleName)) {
      throw new ForbiddenException("Technicians cannot access all company work orders.");
    }
    return this.listQueue(actor, queue, query);
  }

  async getCategorySummary(actor: Actor, query: Record<string, string>) {
    return this.categoryReports.getCategorySummary(actor, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      departmentId: query.departmentId,
      branchId: query.branchId,
      categoryId: query.categoryId ?? query.taxonomyCategoryId,
      typeId: query.typeId ?? query.taxonomyTypeId,
      issueId: query.issueId ?? query.taxonomyIssueId,
      status: query.status,
      priority: query.priority,
      riskSeverity: query.riskSeverity
    });
  }

  private smartViewToQueue(view: SmartViewKey): WorkOrderQueueKey {
    switch (view) {
      case "completed-this-month":
        return "completed";
      case "cancelled-this-month":
        return "cancelled";
      case "parts-pending-return":
        return "waiting-parts";
      case "supervisor-verification":
        return "supervisor-verification";
      case "action-required":
        return "action-required";
      case "triage":
        return "triage";
      case "created-today":
      case "updated-today":
        return "all";
      default:
        return view as WorkOrderQueueKey;
    }
  }

  private buildEmptyQueueSummary(
    accessible: WorkOrderQueueKey[],
    role: RoleName,
    warnings: WorkOrderQueueSummaryWarning[]
  ): WorkOrderQueueSummaryResponse {
    return {
      queues: accessible.map((key) => ({ key, label: WORK_ORDER_QUEUE_LABELS[key], count: 0 })),
      defaultQueue: resolveDefaultQueueForRole(role),
      summary: {
        actionRequired: 0,
        myTasks: 0,
        waitingParts: 0,
        waitingEvidence: 0,
        supervisorVerification: 0,
        highRisk: 0,
        overdue: 0,
        triage: 0
      },
      warnings,
      lastUpdated: new Date().toISOString()
    };
  }

  private async safeEnrichRows(
    rows: WorkOrderRow[],
    tenantId: string | undefined,
    warnings: WorkOrderQueueSummaryWarning[],
    mode: "summary" | "full" = "full"
  ): Promise<EnrichedQueueRow[]> {
    const enriched: EnrichedQueueRow[] = [];
    for (const row of rows) {
      try {
        enriched.push(mode === "summary" ? this.enrichRowLight(row) : await this.enrichRow(row, tenantId));
      } catch (error) {
        this.logger.warn(`Skipping work order ${row.id} in queue enrichment`, error instanceof Error ? error.message : String(error));
        warnings.push({ queue: row.id, message: "Work order skipped during queue calculation" });
      }
    }
    return enriched;
  }

  private enrichRowLight(row: WorkOrderRow): EnrichedQueueRow {
    const factors: WorkOrderRiskFactors = {
      overdue: isWorkOrderOverdue(row),
      requiredEvidenceMissing: this.resolveEvidenceStatus(row) === "Missing",
      highCostPartIssue: row.parts.some((line) => line.issuedQuantity * line.unitCost >= 10_000)
    };
    const riskScore = calculateWorkOrderRiskScore(factors);
    const riskSeverity = resolveRiskSeverity(riskScore);
    const actionRequired = this.resolveActionRequired(row, factors, riskScore, riskSeverity);
    const partsStatus = this.resolvePartsStatus(row);
    const evidenceStatus = this.resolveEvidenceStatus(row);
    const overdueDays = isWorkOrderOverdue(row) ? overdueDayCount(row.dueDate ?? null, new Date()) : 0;
    const primaryAssignee = row.assignees.find((item) => item.isPrimary) ?? row.assignees[0];

    return {
      row,
      factors,
      riskScore,
      riskSeverity,
      actionRequired,
      partsStatus,
      evidenceStatus,
      overdueDays,
      primaryAssigneeName: primaryAssignee?.employee?.fullName ?? null
    };
  }

  private async listQueue(actor: Actor, queue: WorkOrderQueueKey, query: WorkOrderQueueQuery) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25)));
    const tenantId = actor.tenantId;

    const baseWhere = this.buildPrismaWhere(actor, query);
    const where = this.applyQueueDbWhere(baseWhere, queue, actor);
    const usesPostFilter = this.queueRequiresPostEnrichmentFilter(queue, query);

    if (!usesPostFilter) {
      const orderBy = this.buildPrismaOrderBy(query);
      const [total, rows] = await Promise.all([
        this.prisma.workOrder.count({ where }),
        this.prisma.workOrder.findMany({
          where,
          include: listInclude,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize
        })
      ]);

      const enriched = await this.safeEnrichRows(rows, tenantId ?? undefined, []);
      const pageRows = enriched.map((row) => this.toListItem(row));
      const summary = await this.buildListSummary(actor, baseWhere);

      return this.buildListResponse({
        pageRows,
        total,
        page,
        pageSize,
        queue,
        query,
        summary
      });
    }

    const fetchCap = queue === "all" || queue === "completed" || queue === "cancelled" ? 2000 : 1000;
    const rows = await this.prisma.workOrder.findMany({
      where,
      include: listInclude,
      orderBy: { updatedAt: "desc" },
      take: fetchCap
    });

    const enriched = await this.safeEnrichRows(rows, tenantId ?? undefined, []);
    let filtered = enriched.filter((row) => this.matchesQueue(row, queue, actor, query));

    if (query.overdueOnly === true || query.overdueOnly === "true") {
      filtered = filtered.filter((row) => row.overdueDays > 0 || row.row.status === WorkOrderStatus.OVERDUE);
    }
    if (query.highRiskOnly === true || query.highRiskOnly === "true") {
      filtered = filtered.filter((row) => row.riskSeverity === "HIGH" || row.riskSeverity === "CRITICAL");
    }
    if (query.riskSeverity) {
      filtered = filtered.filter((row) => row.riskSeverity === query.riskSeverity);
    }
    if (query.partsStatus) {
      filtered = filtered.filter((row) => row.partsStatus === query.partsStatus);
    }
    if (query.evidenceStatus) {
      filtered = filtered.filter((row) => row.evidenceStatus === query.evidenceStatus);
    }

    filtered.sort((a, b) => this.compareRows(a, b, query));

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize).map((row) => this.toListItem(row));
    const summary = await this.buildListSummary(actor, baseWhere);

    return this.buildListResponse({
      pageRows,
      total,
      page,
      pageSize,
      queue,
      query,
      summary,
      categorySummary: this.computeCategorySummary(filtered),
      warnings:
        total >= fetchCap
          ? [{ queue, message: "Queue list capped for performance; refine filters or search." }]
          : undefined
    });
  }

  private buildListResponse(input: {
    pageRows: WorkOrderQueueListItem[];
    total: number;
    page: number;
    pageSize: number;
    queue: WorkOrderQueueKey;
    query: WorkOrderQueueQuery;
    summary: Awaited<ReturnType<WorkOrderQueuesService["buildListSummary"]>>;
    categorySummary?: ReturnType<WorkOrderQueuesService["computeCategorySummary"]>;
    warnings?: WorkOrderQueueSummaryWarning[];
  }) {
    const totalPages = input.total === 0 ? 0 : Math.ceil(input.total / input.pageSize);
    return {
      data: input.pageRows,
      total: input.total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages,
      queue: input.queue,
      label: WORK_ORDER_QUEUE_LABELS[input.queue],
      lastUpdated: new Date().toISOString(),
      appliedFilters: {
        search: input.query.search ?? input.query.query,
        queue: input.queue,
        categoryId: input.query.categoryId ?? input.query.taxonomyCategoryId,
        taxonomyCategoryId: input.query.taxonomyCategoryId,
        taxonomyTypeId: input.query.taxonomyTypeId,
        taxonomyIssueId: input.query.taxonomyIssueId,
        status: input.query.status,
        priority: input.query.priority,
        triageOnly: input.query.triageOnly === true || input.query.triageOnly === "true",
        overdueOnly: input.query.overdueOnly === true || input.query.overdueOnly === "true",
        highRiskOnly: input.query.highRiskOnly === true || input.query.highRiskOnly === "true",
        smartView: input.query.smartView
      },
      summary: input.summary,
      warnings: input.warnings,
      categorySummary: input.categorySummary
    };
  }

  private async buildListSummary(actor: Actor, baseWhere: Prisma.WorkOrderWhereInput) {
    const tenantWhere = { ...baseWhere };
    const now = new Date();
    const [total, open, assigned, inProgress, overdue, triage] = await Promise.all([
      this.prisma.workOrder.count({ where: tenantWhere }),
      this.prisma.workOrder.count({ where: { ...tenantWhere, status: WorkOrderStatus.OPEN } }),
      this.prisma.workOrder.count({
        where: {
          ...tenantWhere,
          OR: [{ technicianId: { not: null } }, { assignees: { some: { assignmentStatus: { not: "REMOVED" } } } }],
          status: { in: ACTIVE_OPERATIONAL_STATUSES }
        }
      }),
      this.prisma.workOrder.count({
        where: {
          ...tenantWhere,
          status: { in: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD] }
        }
      }),
      this.prisma.workOrder.count({
        where: {
          ...tenantWhere,
          OR: [{ status: WorkOrderStatus.OVERDUE }, { dueDate: { lt: now }, status: { notIn: TERMINAL_STATUSES } }]
        }
      }),
      this.prisma.workOrder.count({ where: { ...tenantWhere, isTriage: true, status: { notIn: TERMINAL_STATUSES } } })
    ]);

    const highRiskWhere = {
      ...tenantWhere,
      status: { notIn: TERMINAL_STATUSES },
      OR: [
        { priority: Priority.CRITICAL },
        { status: WorkOrderStatus.OVERDUE },
        { slaBreached: true },
        { priority: Priority.HIGH, dueDate: { lt: now } }
      ]
    };

    const highRisk = await this.prisma.workOrder.count({ where: highRiskWhere });

    return { total, open, assigned, inProgress, overdue, highRisk, triage };
  }

  private queueRequiresPostEnrichmentFilter(queue: WorkOrderQueueKey, query: WorkOrderQueueQuery): boolean {
    if (query.highRiskOnly === true || query.highRiskOnly === "true") return true;
    if (query.riskSeverity) return true;
    if (query.partsStatus) return true;
    if (query.evidenceStatus) return true;
    return ["action-required", "waiting-evidence", "finance-vendor-pending"].includes(queue);
  }

  private buildPrismaOrderBy(query: WorkOrderQueueQuery): Prisma.WorkOrderOrderByWithRelationInput[] {
    const direction = query.sortDirection === "asc" ? "asc" : "desc";
    switch (query.sortBy) {
      case "dueDate":
        return [{ dueDate: direction }, { updatedAt: "desc" }];
      case "expectedCompletionDate":
        return [{ expectedCompletionDate: direction }, { updatedAt: "desc" }];
      case "priority":
        return [{ priority: direction }, { updatedAt: "desc" }];
      case "status":
        return [{ status: direction }, { updatedAt: "desc" }];
      case "createdAt":
        return [{ createdAt: direction }];
      case "riskScore":
        return [{ priority: "desc" }, { dueDate: "asc" }, { updatedAt: "desc" }];
      case "operational":
      default:
        return [{ priority: "desc" }, { dueDate: "asc" }, { updatedAt: "desc" }];
    }
  }

  private applyQueueDbWhere(
    where: Prisma.WorkOrderWhereInput,
    queue: WorkOrderQueueKey,
    actor: Actor
  ): Prisma.WorkOrderWhereInput {
    const nonTerminal = { status: { notIn: TERMINAL_STATUSES } };
    const now = new Date();

    switch (queue) {
      case "triage":
        return { AND: [where, { isTriage: true }, nonTerminal] };
      case "open-requests":
        return { AND: [where, { status: WorkOrderStatus.OPEN }] };
      case "completed":
        return { AND: [where, { status: WorkOrderStatus.COMPLETED }] };
      case "cancelled":
        return { AND: [where, { status: WorkOrderStatus.CANCELLED }] };
      case "in-progress":
        return { AND: [where, { status: { in: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD] } }] };
      case "rework-required":
        return { AND: [where, { status: WorkOrderStatus.REWORK_REQUIRED }] };
      case "technician-completed":
        return { AND: [where, { status: WorkOrderStatus.TECHNICIAN_COMPLETED }] };
      case "supervisor-verification":
        return {
          AND: [
            where,
            { status: WorkOrderStatus.TECHNICIAN_COMPLETED, verificationStatus: WorkOrderVerificationStatus.PENDING }
          ]
        };
      case "approved-planned":
        return { AND: [where, { approvalStatus: WorkOrderApprovalStatus.APPROVED, status: WorkOrderStatus.OPEN }] };
      case "overdue":
        return {
          AND: [
            where,
            {
              OR: [
                { status: WorkOrderStatus.OVERDUE },
                { dueDate: { lt: now }, status: { notIn: TERMINAL_STATUSES } }
              ]
            }
          ]
        };
      case "my-tasks":
        return {
          AND: [
            where,
            nonTerminal,
            {
              OR: [
                { technicianId: actor.sub },
                { assignees: { some: { employee: { linkedUserId: actor.sub }, assignmentStatus: { not: "REMOVED" } } } }
              ]
            }
          ]
        };
      case "assigned":
        return {
          AND: [
            where,
            nonTerminal,
            {
              OR: [
                { technicianId: { not: null } },
                { assignees: { some: { assignmentStatus: { not: "REMOVED" } } } }
              ]
            }
          ]
        };
      case "waiting-parts":
        return {
          AND: [
            where,
            nonTerminal,
            {
              parts: {
                some: {
                  OR: [
                    { lineStatus: WorkOrderPartLineStatus.REQUESTED },
                    { pendingReturnQuantity: { gt: 0 } },
                    {
                      lineStatus: WorkOrderPartLineStatus.APPROVED,
                      issuedQuantity: 0,
                      requestedQuantity: { gt: 0 }
                    }
                  ]
                }
              }
            }
          ]
        };
      case "high-risk":
        return {
          AND: [
            where,
            nonTerminal,
            {
              OR: [
                { priority: Priority.CRITICAL },
                { status: WorkOrderStatus.OVERDUE },
                { slaBreached: true },
                { priority: Priority.HIGH, dueDate: { lt: now } }
              ]
            }
          ]
        };
      case "action-required":
        return {
          AND: [
            where,
            nonTerminal,
            {
              OR: [
                { approvalStatus: WorkOrderApprovalStatus.PENDING },
                { isTriage: true },
                { status: WorkOrderStatus.REWORK_REQUIRED },
                { status: WorkOrderStatus.OVERDUE },
                {
                  status: WorkOrderStatus.TECHNICIAN_COMPLETED,
                  verificationStatus: WorkOrderVerificationStatus.PENDING
                },
                { parts: { some: { lineStatus: WorkOrderPartLineStatus.REQUESTED } } },
                { parts: { some: { pendingReturnQuantity: { gt: 0 } } } },
                {
                  parts: {
                    some: {
                      lineStatus: WorkOrderPartLineStatus.APPROVED,
                      issuedQuantity: 0,
                      requestedQuantity: { gt: 0 }
                    }
                  }
                }
              ]
            }
          ]
        };
      case "waiting-evidence":
        return {
          AND: [
            where,
            nonTerminal,
            {
              OR: [
                {
                  evidenceAttachments: {
                    some: { verificationStatus: EvidenceVerificationStatus.REJECTED, deletedAt: null }
                  }
                },
                { evidenceAttachments: { none: { deletedAt: null, status: { not: "DELETED" } } } }
              ]
            }
          ]
        };
      case "finance-vendor-pending":
        return {
          AND: [
            where,
            nonTerminal,
            {
              vendorRepairCase: {
                invoices: { some: { status: { in: [VendorInvoiceStatus.SUBMITTED, VendorInvoiceStatus.UNDER_REVIEW] } } }
              }
            }
          ]
        };
      default:
        return where;
    }
  }

  private computeCategorySummary(filtered: Awaited<ReturnType<WorkOrderQueuesService["enrichRow"]>>[]) {
    const map = new Map<
      string,
      {
        categoryId?: string | null;
        categoryName: string;
        total: number;
        open: number;
        inProgress: number;
        overdue: number;
        highRisk: number;
        completed: number;
        cancelled: number;
        triage: number;
        evidenceMissing: number;
        partsPending: number;
        supervisorVerificationPending: number;
      }
    >();

    for (const item of filtered) {
      const row = item.row;
      const key = row.taxonomyCategoryId ?? row.categoryNameSnapshot ?? "Uncategorized";
      const label = row.categoryNameSnapshot ?? "Uncategorized";
      const bucket =
        map.get(key) ??
        ({
          categoryId: row.taxonomyCategoryId,
          categoryName: label,
          total: 0,
          open: 0,
          inProgress: 0,
          overdue: 0,
          highRisk: 0,
          completed: 0,
          cancelled: 0,
          triage: 0,
          evidenceMissing: 0,
          partsPending: 0,
          supervisorVerificationPending: 0
        } as const);
      const next = { ...bucket };
      next.total += 1;
      if (row.isTriage) next.triage += 1;
      if (row.status === WorkOrderStatus.OPEN) next.open += 1;
      if (row.status === WorkOrderStatus.IN_PROGRESS || row.status === WorkOrderStatus.ON_HOLD) next.inProgress += 1;
      if (isWorkOrderOverdue(row)) next.overdue += 1;
      if (item.riskSeverity === "HIGH" || item.riskSeverity === "CRITICAL") next.highRisk += 1;
      if (row.status === WorkOrderStatus.COMPLETED) next.completed += 1;
      if (row.status === WorkOrderStatus.CANCELLED) next.cancelled += 1;
      if (item.evidenceStatus === "Missing" || item.evidenceStatus === "Rejected") next.evidenceMissing += 1;
      if (item.partsStatus !== "None" && item.partsStatus !== "Issued") next.partsPending += 1;
      if (isSupervisorVerificationPending(row.status, row.verificationStatus)) next.supervisorVerificationPending += 1;
      map.set(key, next);
    }

    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  private buildPrismaWhere(actor: Actor, query: WorkOrderQueueQuery): Prisma.WorkOrderWhereInput {
    const where: Prisma.WorkOrderWhereInput = {};
    if (actor.tenantId !== undefined) {
      where.tenantId = actor.tenantId;
    }

    if (query.status && query.status !== "ALL") {
      where.status = query.status as WorkOrderStatus;
    }
    if (query.priority && query.priority !== "ALL") {
      where.priority = query.priority as Prisma.EnumPriorityFilter;
    }
    if (query.assetId) where.assetId = query.assetId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.requesterId) where.createdById = query.requesterId;
    if (query.departmentId) {
      where.asset = { departmentId: query.departmentId };
    }
    if (query.branchId) {
      where.assignees = { some: { employee: { branchName: query.branchId } } };
    }
    if (query.employeeId) {
      where.assignees = { some: { employeeId: query.employeeId, assignmentStatus: { not: "REMOVED" } } };
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo.includes("T") ? query.dateTo : `${query.dateTo}T23:59:59.999Z`) } : {})
      };
    }
    if (query.updatedFrom || query.updatedTo) {
      where.updatedAt = {
        ...(query.updatedFrom ? { gte: new Date(query.updatedFrom) } : {}),
        ...(query.updatedTo ? { lte: new Date(query.updatedTo) } : {})
      };
    }
    if (query.dueFrom || query.dueTo) {
      where.dueDate = {
        ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
        ...(query.dueTo ? { lte: new Date(query.dueTo.includes("T") ? query.dueTo : `${query.dueTo}T23:59:59.999Z`) } : {})
      };
    }
    if (query.verificationStatus) {
      where.verificationStatus = query.verificationStatus as WorkOrderVerificationStatus;
    }
    const categoryId = query.categoryId ?? query.taxonomyCategoryId;
    if (categoryId === "unclassified") {
      where.taxonomyCategoryId = null;
    } else if (categoryId) {
      where.taxonomyCategoryId = categoryId;
    }
    if (query.taxonomyTypeId) where.taxonomyTypeId = query.taxonomyTypeId;
    if (query.taxonomyIssueId) where.taxonomyIssueId = query.taxonomyIssueId;
    if (query.triageOnly === true || query.triageOnly === "true") where.isTriage = true;
    if (query.type) where.type = query.type as Prisma.EnumWorkOrderTypeFilter;

    const searchTerm = (query.search ?? query.query)?.trim();
    if (searchTerm && searchTerm.length >= 2) {
      const searchFilter: Prisma.WorkOrderWhereInput = {
        OR: [
          { woNumber: { contains: searchTerm } },
          { title: { contains: searchTerm } },
          { description: { contains: searchTerm } },
          { categoryNameSnapshot: { contains: searchTerm } },
          { typeNameSnapshot: { contains: searchTerm } },
          { issueNameSnapshot: { contains: searchTerm } },
          { asset: { OR: [{ name: { contains: searchTerm } }, { assetTag: { contains: searchTerm } }] } },
          {
            vehicle: {
              OR: [{ registrationNo: { contains: searchTerm } }, { assetTag: { contains: searchTerm } }]
            }
          },
          {
            assignees: {
              some: { employee: { fullName: { contains: searchTerm } }, assignmentStatus: { not: "REMOVED" } }
            }
          }
        ]
      };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), searchFilter];
    }

    const role = actor.role as RoleName;
    const myAssignedOnly = query.myAssignedOnly === true || query.myAssignedOnly === "true";

    if (TECHNICIAN_ROLES.has(role) || myAssignedOnly) {
      const assignmentScope: Prisma.WorkOrderWhereInput = {
        OR: [
          { technicianId: actor.sub },
          { assignees: { some: { employee: { linkedUserId: actor.sub }, assignmentStatus: { not: "REMOVED" } } } }
        ]
      };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), assignmentScope];
    }

    return where;
  }

  private async enrichRow(row: WorkOrderRow, tenantId?: string) {
    let factors: WorkOrderRiskFactors = {};
    try {
      factors = await this.maintenanceReports.computeWorkOrderRiskFactors(row.id, tenantId);
    } catch (error) {
      this.logger.warn(
        `Risk factor calculation failed for work order ${row.id}`,
        error instanceof Error ? error.message : String(error)
      );
    }

    const riskScore = calculateWorkOrderRiskScore(factors);
    const riskSeverity = resolveRiskSeverity(riskScore);
    const actionRequired = this.resolveActionRequired(row, factors, riskScore, riskSeverity);
    const partsStatus = this.resolvePartsStatus(row);
    const evidenceStatus = this.resolveEvidenceStatus(row);
    const overdueDays = isWorkOrderOverdue(row)
      ? overdueDayCount(row.dueDate ?? null, new Date())
      : 0;
    const primaryAssignee = row.assignees.find((item) => item.isPrimary) ?? row.assignees[0];

    return {
      row,
      factors,
      riskScore,
      riskSeverity,
      actionRequired,
      partsStatus,
      evidenceStatus,
      overdueDays,
      primaryAssigneeName: primaryAssignee?.employee?.fullName ?? null
    };
  }

  private resolveActionRequired(
    row: WorkOrderRow,
    factors: WorkOrderRiskFactors,
    riskScore: number,
    riskSeverity: RiskSeverity
  ): WorkOrderActionRequiredItem[] {
    const items: WorkOrderActionRequiredItem[] = [];
    const push = (type: WorkOrderActionRequiredType, label: string, actorRole?: string, severity: RiskSeverity = "MEDIUM") => {
      items.push({ type, label, actorRole, severity });
    };

    if (row.approvalStatus === "PENDING") {
      push("approval_required", "Work order approval required", "MANAGER", "HIGH");
    }
    if (isSupervisorVerificationPending(row.status, row.verificationStatus)) {
      push("supervisor_verification", "Supervisor verification required", "SUPERVISOR", "HIGH");
    }
    if (factors.requiredEvidenceMissing) {
      push("evidence_missing", "Before/after evidence missing", "TECHNICIAN", "HIGH");
    }
    if (factors.qrMismatch) {
      push("qr_mismatch", "QR verification mismatch", "SUPERVISOR", "HIGH");
    }
    if (row.parts.some((line) => line.lineStatus === WorkOrderPartLineStatus.REQUESTED)) {
      push("parts_pending_approval", "Parts request pending approval", "MANAGER", "MEDIUM");
    }
    if (
      row.parts.some(
        (line) =>
          (line.lineStatus === WorkOrderPartLineStatus.APPROVED || line.approvedQuantity) &&
          line.issuedQuantity === 0 &&
          line.requestedQuantity > 0
      )
    ) {
      push("parts_waiting_issue", "Parts waiting issue", "INVENTORY_KEEPER", "MEDIUM");
    }
    if (row.parts.some((line) => line.pendingReturnQuantity > 0)) {
      push("parts_pending_return", "Parts pending return confirmation", "INVENTORY_KEEPER", "MEDIUM");
    }
    if (factors.overdue || row.status === WorkOrderStatus.OVERDUE) {
      const days = overdueDayCount(row.dueDate, new Date());
      push("overdue", days > 0 ? `Overdue by ${days} day(s)` : "Overdue work order", "SUPERVISOR", "HIGH");
    }
    if (riskScore >= 40) {
      push("high_risk", "High risk work order", "MANAGER", riskSeverity);
    }
    if (row.status === WorkOrderStatus.REWORK_REQUIRED) {
      push("rework_required", "Rework required", "TECHNICIAN", "HIGH");
    }
    if (
      row.vendorRepairCase?.invoices.some(
        (invoice) => invoice.status === VendorInvoiceStatus.SUBMITTED || invoice.status === VendorInvoiceStatus.UNDER_REVIEW
      )
    ) {
      push("finance_vendor_pending", "Finance / vendor approval pending", "MANAGER", "HIGH");
    }
    if (row.isTriage) {
      push("triage_classification", "Triage classification required", "SUPERVISOR", "MEDIUM");
    }

    return items;
  }

  private resolvePartsStatus(row: WorkOrderRow): string {
    if (row.parts.some((line) => line.pendingReturnQuantity > 0)) return "Pending return";
    if (row.parts.some((line) => pendingQuantity(line) > 0 && line.issuedQuantity > 0)) return "Unaccounted";
    if (row.parts.some((line) => line.lineStatus === WorkOrderPartLineStatus.REQUESTED)) return "Approval pending";
    if (
      row.parts.some(
        (line) =>
          (line.lineStatus === WorkOrderPartLineStatus.APPROVED || Boolean(line.approvedQuantity)) &&
          line.issuedQuantity === 0 &&
          line.requestedQuantity > 0
      )
    ) {
      return "Waiting issue";
    }
    if (row.parts.some((line) => line.issuedQuantity > 0)) return "Issued";
    if (row.partIssues.length > 0) return "Parts activity";
    return "None";
  }

  private resolveEvidenceStatus(row: WorkOrderRow): string {
    const checklist = evaluateEvidenceRequirements(
      row.type,
      row.evidenceAttachments.map((item) => ({
        evidenceType: item.evidenceType,
        status: item.status,
        verificationStatus: item.verificationStatus
      }))
    );
    if (row.evidenceAttachments.some((item) => item.verificationStatus === "REJECTED")) return "Rejected";
    if (checklist.required && !checklist.complete) return "Missing";
    if (checklist.complete) return "Complete";
    return checklist.required ? "Required" : "Not required";
  }

  private matchesQueue(
    enriched: Awaited<ReturnType<WorkOrderQueuesService["enrichRow"]>>,
    queue: WorkOrderQueueKey,
    actor: Actor,
    query: WorkOrderQueueQuery
  ): boolean {
    const { row, factors, riskScore, actionRequired } = enriched;
    const assignedToActor =
      row.technicianId === actor.sub || row.assignees.some((item) => item.employee.linkedUserId === actor.sub);

    switch (queue) {
      case "action-required":
        return actionRequired.length > 0 && !TERMINAL_STATUSES.includes(row.status);
      case "my-tasks":
        return assignedToActor && !TERMINAL_STATUSES.includes(row.status);
      case "open-requests":
        return row.status === WorkOrderStatus.OPEN;
      case "approved-planned":
        return row.approvalStatus === "APPROVED" && row.status === WorkOrderStatus.OPEN;
      case "assigned":
        return (
          (Boolean(row.technicianId) || row.assignees.length > 0) &&
          ACTIVE_OPERATIONAL_STATUSES.includes(row.status)
        );
      case "in-progress":
        return row.status === WorkOrderStatus.IN_PROGRESS || row.status === WorkOrderStatus.ON_HOLD;
      case "waiting-parts":
        return enriched.partsStatus !== "None" && !TERMINAL_STATUSES.includes(row.status);
      case "waiting-evidence":
        return enriched.evidenceStatus === "Missing" || enriched.evidenceStatus === "Rejected";
      case "technician-completed":
        return row.status === WorkOrderStatus.TECHNICIAN_COMPLETED;
      case "supervisor-verification":
        return isSupervisorVerificationPending(row.status, row.verificationStatus);
      case "rework-required":
        return row.status === WorkOrderStatus.REWORK_REQUIRED;
      case "overdue":
        return isWorkOrderOverdue(row);
      case "high-risk":
        return riskScore >= 40 && !TERMINAL_STATUSES.includes(row.status);
      case "finance-vendor-pending":
        return actionRequired.some((item) => item.type === "finance_vendor_pending");
      case "triage":
        return row.isTriage && !TERMINAL_STATUSES.includes(row.status);
      case "completed": {
        if (row.status !== WorkOrderStatus.COMPLETED) return false;
        if (query.queue === "completed" && query.dateFrom) return true;
        const view = query.queue;
        if (view === "completed-this-month") {
          const start = new Date();
          start.setDate(1);
          return row.completedDate ? row.completedDate >= start : row.updatedAt >= start;
        }
        return true;
      }
      case "cancelled":
        return row.status === WorkOrderStatus.CANCELLED;
      case "all":
        return true;
      default:
        return false;
    }
  }

  private compareRows(
    a: Awaited<ReturnType<WorkOrderQueuesService["enrichRow"]>>,
    b: Awaited<ReturnType<WorkOrderQueuesService["enrichRow"]>>,
    query: WorkOrderQueueQuery
  ): number {
    const direction = query.sortDirection === "asc" ? 1 : -1;

    if (!query.sortBy || query.sortBy === "operational") {
      const severityDiff = severityWeight(b.riskSeverity) - severityWeight(a.riskSeverity);
      if (severityDiff !== 0) return severityDiff;
      const overdueDiff = b.overdueDays - a.overdueDays;
      if (overdueDiff !== 0) return overdueDiff;
      const priorityDiff = priorityWeight(b.row.priority) - priorityWeight(a.row.priority);
      if (priorityDiff !== 0) return priorityDiff;
      const dueA = a.row.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const dueB = b.row.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (dueA !== dueB) return dueA - dueB;
      return b.row.updatedAt.getTime() - a.row.updatedAt.getTime();
    }

    switch (query.sortBy) {
      case "dueDate": {
        const dueA = a.row.dueDate?.getTime() ?? 0;
        const dueB = b.row.dueDate?.getTime() ?? 0;
        return (dueA - dueB) * direction;
      }
      case "priority":
        return (priorityWeight(a.row.priority) - priorityWeight(b.row.priority)) * direction;
      case "riskScore":
        return (a.riskScore - b.riskScore) * direction;
      case "createdAt":
        return (a.row.createdAt.getTime() - b.row.createdAt.getTime()) * direction;
      case "expectedCompletionDate": {
        const dueA = a.row.expectedCompletionDate?.getTime() ?? a.row.dueDate?.getTime() ?? 0;
        const dueB = b.row.expectedCompletionDate?.getTime() ?? b.row.dueDate?.getTime() ?? 0;
        return (dueA - dueB) * direction;
      }
      default:
        return (a.row.updatedAt.getTime() - b.row.updatedAt.getTime()) * direction;
    }
  }

  private toListItem(enriched: Awaited<ReturnType<WorkOrderQueuesService["enrichRow"]>>): WorkOrderQueueListItem {
    return {
      ...enriched.row,
      riskScore: enriched.riskScore,
      riskSeverity: enriched.riskSeverity,
      actionRequired: enriched.actionRequired,
      partsStatus: enriched.partsStatus,
      evidenceStatus: enriched.evidenceStatus,
      overdueDays: enriched.overdueDays,
      primaryAssigneeName: enriched.primaryAssigneeName
    };
  }
}
