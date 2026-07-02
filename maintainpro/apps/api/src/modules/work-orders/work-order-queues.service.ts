import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  RoleName,
  VendorInvoiceStatus,
  WorkOrderStatus,
  WorkOrderVerificationStatus,
  WorkOrderPartLineStatus
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
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  priority?: string;
  departmentId?: string;
  branchId?: string;
  assetId?: string;
  vehicleId?: string;
  employeeId?: string;
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
  queues: Array<{ key: WorkOrderQueueKey; label: string; count: number }>;
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

@Injectable()
export class WorkOrderQueuesService {
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
    const role = actor.role as RoleName;
    const accessible = WORK_ORDER_QUEUE_KEYS.filter((key) => roleCanAccessQueue(role, key));
    const warnings: WorkOrderQueueSummaryWarning[] = [];
    const tenantId = actor.tenantId;

    let enriched: EnrichedQueueRow[] = [];
    try {
      const where = this.buildPrismaWhere(actor, {});
      const rows = await this.prisma.workOrder.findMany({
        where,
        include: listInclude,
        orderBy: { updatedAt: "desc" },
        take: 1500
      });
      enriched = await this.safeEnrichRows(rows, tenantId ?? undefined, warnings);
    } catch (error) {
      this.logger.error("Failed to load work orders for queue summary", error instanceof Error ? error.stack : String(error));
      warnings.push({ queue: "*", message: "Queue data temporarily unavailable" });
      return this.buildEmptyQueueSummary(accessible, role, warnings);
    }

    const counts = accessible.map((key) =>
      this.safeQueueCount(key, warnings, () =>
        enriched.filter((row) => this.matchesQueue(row, key, actor, {})).length
      )
    );

    return {
      queues: counts,
      defaultQueue: resolveDefaultQueueForRole(role),
      summary: this.computeOperationalSummary(enriched, actor),
      ...(warnings.length > 0 ? { warnings } : {}),
      lastUpdated: new Date().toISOString()
    };
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
      default:
        return view as WorkOrderQueueKey;
    }
  }

  private safeQueueCount(
    key: WorkOrderQueueKey,
    warnings: WorkOrderQueueSummaryWarning[],
    counter: () => number
  ): { key: WorkOrderQueueKey; label: string; count: number } {
    try {
      return { key, label: WORK_ORDER_QUEUE_LABELS[key], count: counter() };
    } catch (error) {
      this.logger.warn(`Queue count failed for ${key}`, error instanceof Error ? error.message : String(error));
      warnings.push({ queue: key, message: "Queue count unavailable" });
      return { key, label: WORK_ORDER_QUEUE_LABELS[key], count: 0 };
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

  private computeOperationalSummary(enriched: EnrichedQueueRow[], actor: Actor) {
    const countFor = (key: WorkOrderQueueKey) =>
      enriched.filter((row) => this.matchesQueue(row, key, actor, {})).length;

    return {
      actionRequired: countFor("action-required"),
      myTasks: countFor("my-tasks"),
      waitingParts: countFor("waiting-parts"),
      waitingEvidence: countFor("waiting-evidence"),
      supervisorVerification: countFor("supervisor-verification"),
      highRisk: countFor("high-risk"),
      overdue: countFor("overdue"),
      triage: countFor("triage")
    };
  }

  private async safeEnrichRows(
    rows: WorkOrderRow[],
    tenantId: string | undefined,
    warnings: WorkOrderQueueSummaryWarning[]
  ): Promise<EnrichedQueueRow[]> {
    const enriched: EnrichedQueueRow[] = [];
    for (const row of rows) {
      try {
        enriched.push(await this.enrichRow(row, tenantId));
      } catch (error) {
        this.logger.warn(`Skipping work order ${row.id} in queue enrichment`, error instanceof Error ? error.message : String(error));
        warnings.push({ queue: row.id, message: "Work order skipped during queue calculation" });
      }
    }
    return enriched;
  }

  private async listQueue(actor: Actor, queue: WorkOrderQueueKey, query: WorkOrderQueueQuery) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25)));
    const tenantId = actor.tenantId;

    const where = this.buildPrismaWhere(actor, query);
    const rows = await this.prisma.workOrder.findMany({
      where,
      include: listInclude,
      orderBy: { updatedAt: "desc" },
      take: queue === "all" || queue === "completed" || queue === "cancelled" ? 2000 : 1000
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

    filtered.sort((a, b) => this.compareRows(a, b, query));

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize).map((row) => this.toListItem(row));

    return {
      data: pageRows,
      total,
      page,
      pageSize,
      queue,
      label: WORK_ORDER_QUEUE_LABELS[queue],
      lastUpdated: new Date().toISOString(),
      appliedFilters: {
        categoryId: query.categoryId ?? query.taxonomyCategoryId,
        typeId: query.taxonomyTypeId,
        issueId: query.taxonomyIssueId,
        status: query.status,
        priority: query.priority,
        triageOnly: query.triageOnly === true || query.triageOnly === "true"
      },
      categorySummary: this.computeCategorySummary(filtered)
    };
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
    if (query.departmentId) {
      where.asset = { departmentId: query.departmentId };
    }
    if (query.branchId) {
      where.assignees = { some: { employee: { branchName: query.branchId } } };
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {})
      };
    }
    if (query.verificationStatus) {
      where.verificationStatus = query.verificationStatus as WorkOrderVerificationStatus;
    }
    const categoryId = query.categoryId ?? query.taxonomyCategoryId;
    if (categoryId) where.taxonomyCategoryId = categoryId;
    if (query.taxonomyTypeId) where.taxonomyTypeId = query.taxonomyTypeId;
    if (query.taxonomyIssueId) where.taxonomyIssueId = query.taxonomyIssueId;
    if (query.triageOnly === true || query.triageOnly === "true") where.isTriage = true;
    if (query.type) where.type = query.type as Prisma.EnumWorkOrderTypeFilter;

    const role = actor.role as RoleName;
    const myAssignedOnly = query.myAssignedOnly === true || query.myAssignedOnly === "true";

    if (TECHNICIAN_ROLES.has(role) || myAssignedOnly) {
      where.OR = [
        { technicianId: actor.sub },
        { assignees: { some: { employee: { linkedUserId: actor.sub } } } }
      ];
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
