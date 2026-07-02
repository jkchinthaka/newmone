import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import {
  AuditAction,
  Prisma,
  VendorInvoiceStatus,
  VendorQuotationStatus,
  VendorRepairStatus,
  RoleName,
  EvidenceVerificationStatus,
  QrVerificationStatus,
  WorkOrderAssigneeStatus,
  WorkOrderStatus,
  WorkOrderVerificationStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import {
  calculateWorkOrderRiskScore,
  cardSeverityFromCount,
  resolveRiskSeverity,
  RISK_SCORE_DISCLAIMER,
  type WorkOrderRiskFactors
} from "../../common/utils/maintenance-risk-score";
import { pendingQuantity } from "../../common/utils/work-order-parts-governance";
import {
  evaluateEvidenceRequirements,
  requiresQrVerification
} from "../../common/utils/work-order-evidence-governance";
import { isHighCostVendorRepair, VENDOR_APPROVAL_MANAGER_MAX } from "../../common/utils/vendor-repair-governance";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { WorkforcePlanningService } from "../workforce/workforce-planning.service";
import {
  MAINTENANCE_EXCEPTION_LABELS,
  type MaintenanceExceptionCard,
  type MaintenanceExceptionRow,
  type MaintenanceExceptionType,
  type MaintenanceReportQuery
} from "./maintenance-reports.types";
import type { ReportQuery } from "./reports.service";

const PART_APPROVAL_HIGH_THRESHOLD = Number(process.env.PART_APPROVAL_HIGH_THRESHOLD ?? 50_000);
const WORK_ORDER_HIGH_COST_THRESHOLD = Number(process.env.WORK_ORDER_HIGH_COST_THRESHOLD ?? 25_000);

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

const BLOCKED_ROLES = new Set<RoleName>([RoleName.TECHNICIAN, RoleName.MECHANIC, RoleName.DRIVER]);
const FULL_ACCESS_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER
]);
const PARTS_ACCESS_ROLES = new Set<RoleName>([...FULL_ACCESS_ROLES, RoleName.INVENTORY_KEEPER, RoleName.SUPERVISOR]);

const ACTIVE_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.TECHNICIAN_COMPLETED,
  WorkOrderStatus.REWORK_REQUIRED,
  WorkOrderStatus.OVERDUE
];

const workOrderDetailInclude = {
  asset: { select: { name: true, location: true, departmentRef: { select: { name: true } } } },
  vehicle: { select: { registrationNo: true } },
  assignees: {
    where: { assignmentStatus: { not: WorkOrderAssigneeStatus.REMOVED } },
    include: { employee: { select: { fullName: true, branchName: true } } },
    take: 5
  }
} satisfies Prisma.WorkOrderInclude;

@Injectable()
export class MaintenanceReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workforcePlanning: WorkforcePlanningService
  ) {}

  private resolveTenantId(actor?: Actor) {
    return actor?.tenantId ?? undefined;
  }

  private assertActor(actor?: Actor): Actor {
    if (!actor?.sub || !actor.role) {
      throw new ForbiddenException("Authenticated user required.");
    }
    return actor;
  }

  assertReportAccess(actor: Actor | undefined, scope: "full" | "parts" | "cost" = "full") {
    const user = this.assertActor(actor);
    if (BLOCKED_ROLES.has(user.role as RoleName)) {
      throw new ForbiddenException("Management maintenance reports are not available for technician accounts.");
    }
    if (scope === "parts" && PARTS_ACCESS_ROLES.has(user.role as RoleName)) {
      return user;
    }
    if (scope === "cost" && FULL_ACCESS_ROLES.has(user.role as RoleName)) {
      return user;
    }
    if (scope === "full" && (FULL_ACCESS_ROLES.has(user.role as RoleName) || user.role === RoleName.SUPERVISOR)) {
      return user;
    }
    if (scope === "parts" && user.role === RoleName.INVENTORY_KEEPER) {
      return user;
    }
    throw new ForbiddenException("You do not have permission to view this maintenance report.");
  }

  private resolveDateRange(query: MaintenanceReportQuery) {
    const end = query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : new Date();
    const start = query.startDate ? new Date(`${query.startDate}T00:00:00.000Z`) : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException("Invalid date range.");
    }
    return { start, end };
  }

  private baseWorkOrderWhere(actor: Actor, query: MaintenanceReportQuery): Prisma.WorkOrderWhereInput {
    const tenantId = this.resolveTenantId(actor);
    const { start, end } = this.resolveDateRange(query);
    return {
      ...(tenantId !== undefined ? { tenantId } : {}),
      createdAt: { gte: start, lte: end },
      ...(query.assetId?.trim() ? { assetId: query.assetId.trim() } : {}),
      ...(query.vehicleId?.trim() ? { vehicleId: query.vehicleId.trim() } : {}),
      ...(query.status?.trim() ? { status: query.status.trim() as WorkOrderStatus } : {}),
      ...(query.departmentId?.trim()
        ? { asset: { departmentId: query.departmentId.trim() } }
        : {}),
      ...(query.branch?.trim() ? { asset: { location: { equals: query.branch.trim(), mode: "insensitive" } } } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { woNumber: { contains: query.search.trim(), mode: "insensitive" } },
              { title: { contains: query.search.trim(), mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private mapWorkOrderRow(
    wo: Prisma.WorkOrderGetPayload<{ include: typeof workOrderDetailInclude }>,
    exceptionType: string,
    exceptionReason: string,
    riskScore: number
  ): MaintenanceExceptionRow {
    const primaryAssignee = wo.assignees.find((a) => a.isPrimary) ?? wo.assignees[0];
    return {
      workOrderId: wo.id,
      woNumber: wo.woNumber,
      title: wo.title,
      assetName: wo.asset?.name ?? null,
      vehicleLabel: wo.vehicle?.registrationNo ?? null,
      departmentName: wo.asset?.departmentRef?.name ?? null,
      branchName: primaryAssignee?.employee.branchName ?? wo.asset?.location ?? null,
      status: wo.status,
      priority: wo.priority,
      assignedEmployee: primaryAssignee?.employee.fullName ?? null,
      exceptionType,
      exceptionReason,
      costImpact: wo.actualCost ?? wo.estimatedCost ?? null,
      createdAt: wo.createdAt.toISOString(),
      dueDate: wo.dueDate?.toISOString() ?? null,
      actionOwner: primaryAssignee?.employee.fullName ?? null,
      riskScore,
      riskSeverity: resolveRiskSeverity(riskScore)
    };
  }

  private async fetchVendorRepairExceptionRows(
    actor: Actor,
    query: MaintenanceReportQuery,
    exceptionType: MaintenanceExceptionType,
    reason: string,
    _predicate: (row: {
      emergencyOverride: boolean;
      status: VendorRepairStatus;
      quotations: Array<{ status: VendorQuotationStatus; quotedAmount: number }>;
      invoices: Array<{ status: VendorInvoiceStatus; totalAmount: number }>;
      supplier: { blacklisted: boolean } | null;
      workOrder: { verificationStatus: WorkOrderVerificationStatus };
    }) => boolean,
    page: number,
    pageSize: number,
    start: Date,
    end: Date
  ): Promise<{ total: number; rows: MaintenanceExceptionRow[] }> {
    const tenantId = this.resolveTenantId(actor);
    const tenantFilter = tenantId !== undefined ? { tenantId } : {};
    const cases = await this.prisma.vendorRepairCase.findMany({
      where: { ...tenantFilter, createdAt: { gte: start, lte: end } },
      include: {
        supplier: { select: { blacklisted: true } },
        quotations: { select: { status: true, quotedAmount: true }, orderBy: { createdAt: "desc" } },
        invoices: { select: { status: true, totalAmount: true }, orderBy: { createdAt: "desc" } },
        workOrder: { include: workOrderDetailInclude }
      },
      orderBy: { updatedAt: "desc" },
      take: 500
    });

    const matched = cases.filter(_predicate);
    const pageItems = matched.slice((page - 1) * pageSize, page * pageSize);
    const rows = await Promise.all(
      pageItems.map(async (vendorCase) => {
        const factors = await this.computeWorkOrderRiskFactors(vendorCase.workOrderId, tenantId);
        const score = calculateWorkOrderRiskScore(factors);
        return this.mapWorkOrderRow(vendorCase.workOrder, exceptionType, reason, score);
      })
    );
    return { total: matched.length, rows };
  }

  private isOverdue(
    wo: { status: WorkOrderStatus; dueDate?: Date | null; completedDate?: Date | null },
    now = new Date()
  ) {
    if (wo.status === WorkOrderStatus.COMPLETED || wo.status === WorkOrderStatus.CANCELLED) {
      return false;
    }
    if (!wo.dueDate) return wo.status === WorkOrderStatus.OVERDUE;
    return wo.dueDate.getTime() < now.getTime();
  }

  async computeWorkOrderRiskFactors(workOrderId: string, tenantId?: string): Promise<WorkOrderRiskFactors> {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, ...(tenantId !== undefined ? { tenantId } : {}) },
      include: {
        evidenceAttachments: {
          where: { deletedAt: null, status: { not: "DELETED" } },
          select: { id: true, evidenceType: true, status: true, verificationStatus: true, syncStatus: true }
        },
        parts: true,
        partIssues: { select: { id: true }, take: 1 },
        assignees: { where: { leaveOverride: true }, take: 1 }
      }
    });
    if (!wo) {
      return {};
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let repeatedBreakdown = false;
    if (wo.assetId) {
      const assetCount = await this.prisma.workOrder.count({
        where: {
          assetId: wo.assetId,
          type: { in: ["CORRECTIVE", "EMERGENCY"] },
          createdAt: { gte: thirtyDaysAgo },
          ...(tenantId !== undefined ? { tenantId } : {})
        }
      });
      repeatedBreakdown = assetCount >= 3;
    }

    const hasUnaccountedParts = wo.parts.some(
      (line) => line.issuedQuantity > 0 && pendingQuantity(line) > 0
    );
    const highCostPart = wo.parts.some((line) => line.issuedQuantity * line.unitCost >= PART_APPROVAL_HIGH_THRESHOLD);
    const pendingReturn = wo.parts.some((line) => line.pendingReturnQuantity > 0);

    const evidenceChecklist = evaluateEvidenceRequirements(
      wo.type,
      wo.evidenceAttachments.map((item) => ({
        evidenceType: item.evidenceType,
        status: item.status,
        verificationStatus: item.verificationStatus
      }))
    );
    const uploadedEvidence = wo.evidenceAttachments.filter((item) => item.status === "UPLOADED");

    const vendorCase = await this.prisma.vendorRepairCase.findUnique({
      where: { workOrderId },
      include: {
        supplier: { select: { blacklisted: true } },
        quotations: { select: { status: true, quotedAmount: true, submittedById: true, approvedById: true } },
        invoices: { select: { status: true, totalAmount: true, submittedById: true, financeApprovedById: true } }
      }
    });

    let repeatedVendorRepair = false;
    if (vendorCase && wo.assetId) {
      const count = await this.prisma.vendorRepairCase.count({
        where: {
          workOrder: { assetId: wo.assetId },
          ...(tenantId !== undefined ? { tenantId } : {}),
          createdAt: { gte: thirtyDaysAgo }
        }
      });
      repeatedVendorRepair = count >= 2;
    }

    const approvedQuotation = vendorCase?.quotations.find((q) => q.status === VendorQuotationStatus.APPROVED);
    const approvedInvoice = vendorCase?.invoices.find((i) => i.status === VendorInvoiceStatus.APPROVED || i.status === VendorInvoiceStatus.PAID);
    const latestInvoice = vendorCase?.invoices[0];
    const invoiceExceeds =
      Boolean(approvedQuotation && latestInvoice && latestInvoice.totalAmount > approvedQuotation.quotedAmount);

    return {
      completedWithoutEvidence: wo.status === WorkOrderStatus.COMPLETED && uploadedEvidence.length === 0,
      requiredEvidenceMissing:
        evidenceChecklist.required &&
        !evidenceChecklist.complete &&
        ACTIVE_STATUSES.includes(wo.status),
      qrMismatch: wo.qrVerificationStatus === QrVerificationStatus.MISMATCH,
      qrOverride: wo.qrVerificationStatus === QrVerificationStatus.OVERRIDDEN,
      evidenceRejected: wo.evidenceAttachments.some(
        (item) => item.verificationStatus === EvidenceVerificationStatus.REJECTED
      ),
      offlineSyncFailed: wo.evidenceAttachments.some((item) => item.syncStatus === "FAILED"),
      partsIssuedJobNotCompleted:
        ACTIVE_STATUSES.includes(wo.status) && (wo.parts.length > 0 || wo.partIssues.length > 0),
      pendingReturn,
      highCostPartIssue: highCostPart,
      repeatedBreakdown,
      reopened: Boolean(wo.reopenedAt),
      cancelledAfterPartsIssued: wo.status === WorkOrderStatus.CANCELLED && wo.parts.some((p) => p.issuedQuantity > 0),
      assignedDuringLeave: wo.assignees.length > 0,
      editedAfterCompletion:
        wo.status === WorkOrderStatus.COMPLETED &&
        Boolean(wo.completedDate && wo.updatedAt.getTime() > wo.completedDate.getTime() + 60_000),
      overdue: this.isOverdue(wo),
      invoiceExceedsQuotation: invoiceExceeds,
      blacklistedVendorUsed: Boolean(vendorCase?.supplier?.blacklisted),
      vendorRepairWithoutQuotation:
        Boolean(vendorCase) && !approvedQuotation && !vendorCase?.emergencyOverride && vendorCase?.status !== VendorRepairStatus.CLOSED,
      vendorRepairWithoutInvoice:
        Boolean(vendorCase) && vendorCase?.status === VendorRepairStatus.VENDOR_COMPLETED && !approvedInvoice,
      highCostVendorRepair: Boolean(approvedQuotation && isHighCostVendorRepair(approvedQuotation.quotedAmount)),
      repeatedVendorRepair,
      emergencyVendorOverride: Boolean(vendorCase?.emergencyOverride),
      financeApprovalPending: Boolean(vendorCase?.invoices.some((i) => i.status === VendorInvoiceStatus.SUBMITTED || i.status === VendorInvoiceStatus.UNDER_REVIEW)),
      sameUserVendorApproval: Boolean(
        vendorCase?.quotations.some((q) => q.submittedById && q.approvedById && q.submittedById === q.approvedById)
      )
    };
  }

  async getWorkOrderRiskScore(workOrderId: string, actor?: Actor) {
    const user = this.assertActor(actor);
    const tenantId = this.resolveTenantId(user);
    const factors = await this.computeWorkOrderRiskFactors(workOrderId, tenantId);
    const score = calculateWorkOrderRiskScore(factors);
    return {
      workOrderId,
      score,
      severity: resolveRiskSeverity(score),
      factors,
      disclaimer: RISK_SCORE_DISCLAIMER
    };
  }

  private async countException(type: MaintenanceExceptionType, actor: Actor, query: MaintenanceReportQuery): Promise<number> {
    const tenantId = this.resolveTenantId(actor);
    const tenantFilter = tenantId !== undefined ? { tenantId } : {};
    const { start, end } = this.resolveDateRange(query);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    switch (type) {
      case "completed-without-evidence":
        return this.prisma.workOrder.count({
          where: {
            ...this.baseWorkOrderWhere(actor, query),
            status: WorkOrderStatus.COMPLETED,
            evidenceAttachments: { none: { status: "UPLOADED", deletedAt: null } }
          }
        });
      case "required-evidence-missing": {
        const orders = await this.prisma.workOrder.findMany({
          where: {
            ...tenantFilter,
            status: { in: ACTIVE_STATUSES },
            createdAt: { gte: start, lte: end },
            type: { in: ["CORRECTIVE", "EMERGENCY", "ACCIDENT_REPAIR", "PREVENTIVE", "INSPECTION", "INSTALLATION"] }
          },
          include: {
            evidenceAttachments: {
              where: { deletedAt: null },
              select: { evidenceType: true, status: true, verificationStatus: true }
            }
          },
          take: 300
        });
        return orders.filter((wo) => {
          const checklist = evaluateEvidenceRequirements(
            wo.type,
            wo.evidenceAttachments.map((item) => ({
              evidenceType: item.evidenceType,
              status: item.status,
              verificationStatus: item.verificationStatus
            }))
          );
          return checklist.required && !checklist.complete;
        }).length;
      }
      case "technician-completed-without-evidence":
        return this.prisma.workOrder.count({
          where: {
            ...this.baseWorkOrderWhere(actor, query),
            status: WorkOrderStatus.TECHNICIAN_COMPLETED,
            evidenceAttachments: { none: { status: "UPLOADED", deletedAt: null } }
          }
        });
      case "supervisor-blocked-missing-evidence": {
        const logs = await this.prisma.auditLog.findMany({
          where: {
            ...tenantFilter,
            module: "maintenance",
            createdAt: { gte: start, lte: end }
          },
          select: { metadata: true },
          take: 500
        });
        return logs.filter((log) => {
          const metadata = log.metadata as { event?: string } | null;
          return metadata?.event === "supervisor_verification_blocked_missing_evidence";
        }).length;
      }
      case "qr-mismatch":
        return this.prisma.workOrder.count({
          where: {
            ...this.baseWorkOrderWhere(actor, query),
            qrVerificationStatus: QrVerificationStatus.MISMATCH
          }
        });
      case "qr-override":
        return this.prisma.workOrder.count({
          where: {
            ...this.baseWorkOrderWhere(actor, query),
            qrVerificationStatus: QrVerificationStatus.OVERRIDDEN
          }
        });
      case "evidence-rejected":
        return this.prisma.workOrder.count({
          where: {
            ...this.baseWorkOrderWhere(actor, query),
            evidenceAttachments: {
              some: { verificationStatus: EvidenceVerificationStatus.REJECTED, deletedAt: null }
            }
          }
        });
      case "offline-sync-failed":
        return this.prisma.evidenceAttachment.count({
          where: {
            ...tenantFilter,
            syncStatus: "FAILED",
            createdAt: { gte: start, lte: end }
          }
        });
      case "pending-supervisor-verification":
        return this.prisma.workOrder.count({
          where: {
            ...tenantFilter,
            status: WorkOrderStatus.TECHNICIAN_COMPLETED,
            verificationStatus: WorkOrderVerificationStatus.PENDING,
            createdAt: { gte: start, lte: end }
          }
        });
      case "closed-without-supervisor-verification":
        return this.prisma.workOrder.count({
          where: {
            ...this.baseWorkOrderWhere(actor, query),
            status: WorkOrderStatus.COMPLETED,
            verificationStatus: { in: [WorkOrderVerificationStatus.PENDING, WorkOrderVerificationStatus.NOT_REQUIRED] },
            type: { in: ["CORRECTIVE", "EMERGENCY", "ACCIDENT_REPAIR"] }
          }
        });
      case "parts-issued-not-completed":
        return this.prisma.workOrder.count({
          where: {
            ...tenantFilter,
            status: { in: ACTIVE_STATUSES },
            createdAt: { gte: start, lte: end },
            OR: [{ parts: { some: { issuedQuantity: { gt: 0 } } } }, { partIssues: { some: {} } }]
          }
        });
      case "parts-not-accounted": {
        const lines = await this.prisma.workOrderPart.findMany({
          where: { ...tenantFilter, issuedQuantity: { gt: 0 }, createdAt: { gte: start, lte: end } },
          select: { issuedQuantity: true, usedQuantity: true, returnedQuantity: true, damagedQuantity: true, pendingReturnQuantity: true }
        });
        return lines.filter((line) =>
          pendingQuantity({
            requestedQuantity: 0,
            issuedQuantity: line.issuedQuantity,
            usedQuantity: line.usedQuantity,
            returnedQuantity: line.returnedQuantity,
            damagedQuantity: line.damagedQuantity,
            pendingReturnQuantity: line.pendingReturnQuantity
          }) > 0
        ).length;
      }
      case "pending-part-returns":
        return this.prisma.workOrderPart.count({
          where: { ...tenantFilter, pendingReturnQuantity: { gt: 0 }, createdAt: { gte: start, lte: end } }
        });
      case "duplicate-part-requests": {
        const lines = await this.prisma.workOrderPart.findMany({
          where: { ...tenantFilter, createdAt: { gte: start, lte: end } },
          select: { workOrderId: true, partId: true }
        });
        const seen = new Set<string>();
        let dupes = 0;
        for (const line of lines) {
          const key = `${line.workOrderId}:${line.partId}`;
          if (seen.has(key)) dupes += 1;
          else seen.add(key);
        }
        return dupes;
      }
      case "high-cost-part-issues": {
        const partLines = await this.prisma.workOrderPart.findMany({
          where: { ...tenantFilter, issuedQuantity: { gt: 0 }, createdAt: { gte: start, lte: end } },
          select: { issuedQuantity: true, unitCost: true }
        });
        return partLines.filter((line) => line.issuedQuantity * line.unitCost >= PART_APPROVAL_HIGH_THRESHOLD).length;
      }
      case "repeated-breakdowns": {
        const rows = await this.prisma.workOrder.findMany({
          where: {
            ...tenantFilter,
            assetId: { not: null },
            type: { in: ["CORRECTIVE", "EMERGENCY"] },
            createdAt: { gte: thirtyDaysAgo, lte: end }
          },
          select: { assetId: true }
        });
        const counts = new Map<string, number>();
        for (const row of rows) {
          if (!row.assetId) continue;
          counts.set(row.assetId, (counts.get(row.assetId) ?? 0) + 1);
        }
        return [...counts.values()].filter((c) => c >= 3).length;
      }
      case "reopened-work-orders":
        return this.prisma.workOrder.count({
          where: { ...tenantFilter, reopenedAt: { not: null }, updatedAt: { gte: thirtyDaysAgo, lte: end } }
        });
      case "cancelled-work-orders":
        return this.prisma.workOrder.count({
          where: { ...tenantFilter, status: WorkOrderStatus.CANCELLED, updatedAt: { gte: thirtyDaysAgo, lte: end } }
        });
      case "assigned-during-leave":
        return this.prisma.workOrderAssignee.count({
          where: { ...tenantFilter, leaveOverride: true, assignedAt: { gte: start, lte: end } }
        });
      case "above-daily-capacity": {
        const summary = await this.workforcePlanning.getWorkloadSummary(actor, {});
        return summary.rows.filter((row) => row.workloadPercentage >= 100).length;
      }
      case "overdue-work-orders": {
        const orders = await this.prisma.workOrder.findMany({
          where: {
            ...tenantFilter,
            status: { in: ACTIVE_STATUSES },
            createdAt: { gte: start, lte: end }
          },
          select: { status: true, dueDate: true, completedDate: true }
        });
        return orders.filter((wo) => this.isOverdue(wo)).length;
      }
      case "open-high-risk": {
        const openOrders = await this.prisma.workOrder.findMany({
          where: { ...tenantFilter, status: { in: ACTIVE_STATUSES }, createdAt: { gte: start, lte: end } },
          select: { id: true }
        });
        let highRisk = 0;
        for (const wo of openOrders.slice(0, 200)) {
          const factors = await this.computeWorkOrderRiskFactors(wo.id, tenantId);
          if (calculateWorkOrderRiskScore(factors) >= 40) highRisk += 1;
        }
        return highRisk;
      }
      case "vendor-repair-without-quotation":
        return this.prisma.vendorRepairCase.count({
          where: {
            ...tenantFilter,
            emergencyOverride: false,
            status: { notIn: [VendorRepairStatus.CLOSED, VendorRepairStatus.CANCELLED] },
            quotations: { none: { status: VendorQuotationStatus.APPROVED } },
            createdAt: { gte: start, lte: end }
          }
        });
      case "vendor-repair-without-invoice":
        return this.prisma.vendorRepairCase.count({
          where: {
            ...tenantFilter,
            status: VendorRepairStatus.VENDOR_COMPLETED,
            invoices: { none: { status: { in: [VendorInvoiceStatus.APPROVED, VendorInvoiceStatus.PAID] } } },
            updatedAt: { gte: start, lte: end }
          }
        });
      case "invoice-exceeds-quotation": {
        const cases = await this.prisma.vendorRepairCase.findMany({
          where: { ...tenantFilter, createdAt: { gte: start, lte: end } },
          include: {
            quotations: { where: { status: VendorQuotationStatus.APPROVED }, take: 1 },
            invoices: { orderBy: { createdAt: "desc" }, take: 1 }
          },
          take: 500
        });
        return cases.filter((row) => {
          const approved = row.quotations[0];
          const invoice = row.invoices[0];
          return Boolean(approved && invoice && invoice.totalAmount > approved.quotedAmount);
        }).length;
      }
      case "duplicate-vendor-invoice": {
        const invoices = await this.prisma.vendorInvoice.groupBy({
          by: ["supplierId", "invoiceNo"],
          where: { ...tenantFilter, createdAt: { gte: start, lte: end } },
          _count: { _all: true }
        });
        return invoices.filter((row) => row._count._all > 1).length;
      }
      case "high-cost-vendor-repair":
        return this.prisma.vendorQuotation.count({
          where: {
            ...tenantFilter,
            status: VendorQuotationStatus.APPROVED,
            quotedAmount: { gt: VENDOR_APPROVAL_MANAGER_MAX },
            createdAt: { gte: start, lte: end }
          }
        });
      case "repeated-vendor-repair": {
        const cases = await this.prisma.vendorRepairCase.findMany({
          where: { ...tenantFilter, createdAt: { gte: thirtyDaysAgo, lte: end } },
          select: { workOrder: { select: { assetId: true } } },
          take: 1000
        });
        const counts = new Map<string, number>();
        for (const row of cases) {
          const assetId = row.workOrder.assetId;
          if (!assetId) continue;
          counts.set(assetId, (counts.get(assetId) ?? 0) + 1);
        }
        return [...counts.values()].filter((count) => count >= 2).length;
      }
      case "blacklisted-vendor-used":
        return this.prisma.vendorRepairCase.count({
          where: {
            ...tenantFilter,
            supplier: { blacklisted: true },
            createdAt: { gte: start, lte: end }
          }
        });
      case "finance-approval-pending":
        return this.prisma.vendorInvoice.count({
          where: {
            ...tenantFilter,
            status: { in: [VendorInvoiceStatus.SUBMITTED, VendorInvoiceStatus.UNDER_REVIEW] },
            createdAt: { gte: start, lte: end }
          }
        });
      case "vendor-completed-not-verified":
        return this.prisma.vendorRepairCase.count({
          where: {
            ...tenantFilter,
            status: VendorRepairStatus.VENDOR_COMPLETED,
            workOrder: { verificationStatus: { not: WorkOrderVerificationStatus.VERIFIED } },
            updatedAt: { gte: start, lte: end }
          }
        });
      case "emergency-vendor-override":
        return this.prisma.vendorRepairCase.count({
          where: { ...tenantFilter, emergencyOverride: true, createdAt: { gte: start, lte: end } }
        });
      case "same-user-vendor-approval": {
        const rows = await this.prisma.vendorQuotation.findMany({
          where: {
            ...tenantFilter,
            submittedById: { not: null },
            approvedById: { not: null },
            createdAt: { gte: start, lte: end }
          },
          select: { submittedById: true, approvedById: true },
          take: 500
        });
        return rows.filter((row) => row.submittedById === row.approvedById).length;
      }
      case "parts-issue-without-work-order": {
        const logs = await this.prisma.auditLog.findMany({
          where: {
            ...tenantFilter,
            createdAt: { gte: start, lte: end }
          },
          select: { metadata: true },
          take: 2000
        });
        return logs.filter((log) => {
          const metadata = log.metadata as { event?: string } | null;
          return metadata?.event === "parts_issue_blocked_no_work_order";
        }).length;
      }
      case "maker-checker-violation": {
        const logs = await this.prisma.auditLog.findMany({
          where: {
            ...tenantFilter,
            createdAt: { gte: start, lte: end }
          },
          select: { metadata: true },
          take: 2000
        });
        return logs.filter((log) => {
          const metadata = log.metadata as { event?: string } | null;
          return metadata?.event === "maker_checker_violation_blocked";
        }).length;
      }
      default:
        return 0;
    }
  }

  async getExceptionsSummary(actor: Actor | undefined, query: MaintenanceReportQuery = {}) {
    const user = this.assertReportAccess(actor, "full");
    const generatedAt = new Date().toISOString();
    const types = Object.keys(MAINTENANCE_EXCEPTION_LABELS) as MaintenanceExceptionType[];

    const cards: MaintenanceExceptionCard[] = [];
    for (const type of types) {
      const count = await this.countException(type, user, query);
      cards.push({
        type,
        label: MAINTENANCE_EXCEPTION_LABELS[type],
        count,
        severity: cardSeverityFromCount(type, count),
        lastUpdated: generatedAt
      });
    }

    await this.recordAudit(user, "report_viewed", "maintenance-exceptions", query);

    return {
      title: "Maintenance Exceptions & Fraud Monitoring",
      generatedAt,
      filters: this.resolveDateRange(query),
      cards,
      disclaimer: RISK_SCORE_DISCLAIMER,
      notes: [
        "Counts align with work order governance and parts exception APIs (UAT-009/010).",
        "Risk scores are rule-based operational indicators — not AI fraud detection.",
        "PDF export and vendor invoice gaps remain on the roadmap."
      ]
    };
  }

  async getExceptionDetail(actor: Actor | undefined, type: string, query: MaintenanceReportQuery = {}) {
    const user = this.assertReportAccess(actor, "full");
    const exceptionType = type as MaintenanceExceptionType;
    if (!MAINTENANCE_EXCEPTION_LABELS[exceptionType]) {
      throw new BadRequestException(`Unsupported exception type: ${type}`);
    }

    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25)));
    const tenantId = this.resolveTenantId(user);
    const { start, end } = this.resolveDateRange(query);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let rows: MaintenanceExceptionRow[] = [];

    const fetchWorkOrders = async (where: Prisma.WorkOrderWhereInput, reason: string) => {
      const items = await this.prisma.workOrder.findMany({
        where,
        include: workOrderDetailInclude,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      });
      rows = await Promise.all(
        items.map(async (wo) => {
          const factors = await this.computeWorkOrderRiskFactors(wo.id, tenantId);
          const score = calculateWorkOrderRiskScore(factors);
          return this.mapWorkOrderRow(wo, exceptionType, reason, score);
        })
      );
      return this.prisma.workOrder.count({ where });
    };

    let total = 0;

    switch (exceptionType) {
      case "completed-without-evidence":
        total = await fetchWorkOrders(
          {
            ...this.baseWorkOrderWhere(user, query),
            status: WorkOrderStatus.COMPLETED,
            evidenceAttachments: { none: {} }
          },
          "Work order completed without uploaded evidence."
        );
        break;
      case "pending-supervisor-verification":
        total = await fetchWorkOrders(
          {
            ...(tenantId !== undefined ? { tenantId } : {}),
            status: WorkOrderStatus.TECHNICIAN_COMPLETED,
            verificationStatus: WorkOrderVerificationStatus.PENDING,
            createdAt: { gte: start, lte: end }
          },
          "Technician marked complete — supervisor verification pending."
        );
        break;
      case "parts-issued-not-completed":
        total = await fetchWorkOrders(
          {
            ...(tenantId !== undefined ? { tenantId } : {}),
            status: { in: ACTIVE_STATUSES },
            createdAt: { gte: start, lte: end },
            OR: [{ parts: { some: { issuedQuantity: { gt: 0 } } } }, { partIssues: { some: {} } }]
          },
          "Parts issued while work order is still open."
        );
        break;
      case "overdue-work-orders": {
        const items = await this.prisma.workOrder.findMany({
          where: {
            ...(tenantId !== undefined ? { tenantId } : {}),
            status: { in: ACTIVE_STATUSES },
            createdAt: { gte: start, lte: end }
          },
          include: workOrderDetailInclude,
          orderBy: { dueDate: "asc" },
          take: 500
        });
        const overdue = items.filter((wo) => this.isOverdue(wo));
        total = overdue.length;
        rows = await Promise.all(
          overdue.slice((page - 1) * pageSize, page * pageSize).map(async (wo) => {
            const factors = await this.computeWorkOrderRiskFactors(wo.id, tenantId);
            return this.mapWorkOrderRow(wo, exceptionType, "Work order is past due date.", calculateWorkOrderRiskScore(factors));
          })
        );
        break;
      }
      case "reopened-work-orders":
        total = await fetchWorkOrders(
          {
            ...(tenantId !== undefined ? { tenantId } : {}),
            reopenedAt: { not: null },
            updatedAt: { gte: thirtyDaysAgo, lte: end }
          },
          "Work order was reopened within the last 30 days."
        );
        break;
      case "cancelled-work-orders":
        total = await fetchWorkOrders(
          {
            ...(tenantId !== undefined ? { tenantId } : {}),
            status: WorkOrderStatus.CANCELLED,
            updatedAt: { gte: thirtyDaysAgo, lte: end }
          },
          "Work order cancelled within the last 30 days."
        );
        break;
      case "assigned-during-leave": {
        const assignees = await this.prisma.workOrderAssignee.findMany({
          where: {
            ...(tenantId !== undefined ? { tenantId } : {}),
            leaveOverride: true,
            assignedAt: { gte: start, lte: end }
          },
          include: { workOrder: { include: workOrderDetailInclude }, employee: { select: { fullName: true } } },
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { assignedAt: "desc" }
        });
        total = await this.prisma.workOrderAssignee.count({
          where: {
            ...(tenantId !== undefined ? { tenantId } : {}),
            leaveOverride: true,
            assignedAt: { gte: start, lte: end }
          }
        });
        rows = await Promise.all(
          assignees.map(async (row) => {
            const factors = await this.computeWorkOrderRiskFactors(row.workOrderId, tenantId);
            const mapped = this.mapWorkOrderRow(
              row.workOrder,
              exceptionType,
              `Assigned to ${row.employee.fullName} during approved leave (manager override).`,
              calculateWorkOrderRiskScore(factors)
            );
            mapped.assignedEmployee = row.employee.fullName;
            return mapped;
          })
        );
        break;
      }
      case "qr-mismatch":
        total = await fetchWorkOrders(
          {
            ...this.baseWorkOrderWhere(user, query),
            qrVerificationStatus: QrVerificationStatus.MISMATCH
          },
          "Scanned QR asset/vehicle did not match the work order."
        );
        break;
      case "qr-override":
        total = await fetchWorkOrders(
          {
            ...this.baseWorkOrderWhere(user, query),
            qrVerificationStatus: QrVerificationStatus.OVERRIDDEN
          },
          "QR verification was overridden by a supervisor or manager."
        );
        break;
      case "evidence-rejected":
        total = await fetchWorkOrders(
          {
            ...this.baseWorkOrderWhere(user, query),
            evidenceAttachments: {
              some: { verificationStatus: EvidenceVerificationStatus.REJECTED, deletedAt: null }
            }
          },
          "Supervisor rejected submitted evidence — rework required."
        );
        break;
      case "technician-completed-without-evidence":
        total = await fetchWorkOrders(
          {
            ...this.baseWorkOrderWhere(user, query),
            status: WorkOrderStatus.TECHNICIAN_COMPLETED,
            evidenceAttachments: { none: { status: "UPLOADED", deletedAt: null } }
          },
          "Technician marked complete without uploaded evidence."
        );
        break;
      case "vendor-repair-without-quotation": {
        const result = await this.fetchVendorRepairExceptionRows(
          user,
          query,
          exceptionType,
          "Vendor repair proceeding without an approved quotation.",
          (row) => !row.emergencyOverride && !row.quotations.some((q) => q.status === VendorQuotationStatus.APPROVED),
          page,
          pageSize,
          start,
          end
        );
        total = result.total;
        rows = result.rows;
        break;
      }
      case "vendor-repair-without-invoice": {
        const result = await this.fetchVendorRepairExceptionRows(
          user,
          query,
          exceptionType,
          "Vendor work completed but no approved invoice on file.",
          (row) =>
            row.status === VendorRepairStatus.VENDOR_COMPLETED &&
            !row.invoices.some((i) => i.status === VendorInvoiceStatus.APPROVED || i.status === VendorInvoiceStatus.PAID),
          page,
          pageSize,
          start,
          end
        );
        total = result.total;
        rows = result.rows;
        break;
      }
      case "invoice-exceeds-quotation": {
        const result = await this.fetchVendorRepairExceptionRows(
          user,
          query,
          exceptionType,
          "Invoice total exceeds the approved quotation amount.",
          (row) => {
            const approved = row.quotations.find((q) => q.status === VendorQuotationStatus.APPROVED);
            const invoice = row.invoices[0];
            return Boolean(approved && invoice && invoice.totalAmount > approved.quotedAmount);
          },
          page,
          pageSize,
          start,
          end
        );
        total = result.total;
        rows = result.rows;
        break;
      }
      case "blacklisted-vendor-used": {
        const result = await this.fetchVendorRepairExceptionRows(
          user,
          query,
          exceptionType,
          "A blacklisted vendor was selected for external repair.",
          (row) => Boolean(row.supplier?.blacklisted),
          page,
          pageSize,
          start,
          end
        );
        total = result.total;
        rows = result.rows;
        break;
      }
      case "finance-approval-pending": {
        const result = await this.fetchVendorRepairExceptionRows(
          user,
          query,
          exceptionType,
          "Vendor invoice awaiting finance approval.",
          (row) => row.invoices.some((i) => i.status === VendorInvoiceStatus.SUBMITTED || i.status === VendorInvoiceStatus.UNDER_REVIEW),
          page,
          pageSize,
          start,
          end
        );
        total = result.total;
        rows = result.rows;
        break;
      }
      case "vendor-completed-not-verified": {
        const result = await this.fetchVendorRepairExceptionRows(
          user,
          query,
          exceptionType,
          "Vendor work marked complete but supervisor verification is pending.",
          (row) =>
            row.status === VendorRepairStatus.VENDOR_COMPLETED &&
            row.workOrder.verificationStatus !== WorkOrderVerificationStatus.VERIFIED,
          page,
          pageSize,
          start,
          end
        );
        total = result.total;
        rows = result.rows;
        break;
      }
      case "emergency-vendor-override": {
        const result = await this.fetchVendorRepairExceptionRows(
          user,
          query,
          exceptionType,
          "Emergency vendor repair override was used.",
          (row) => row.emergencyOverride,
          page,
          pageSize,
          start,
          end
        );
        total = result.total;
        rows = result.rows;
        break;
      }
      case "high-cost-vendor-repair": {
        const result = await this.fetchVendorRepairExceptionRows(
          user,
          query,
          exceptionType,
          "High-cost vendor repair exceeds configured manager approval threshold.",
          (row) => row.quotations.some((q) => q.status === VendorQuotationStatus.APPROVED && isHighCostVendorRepair(q.quotedAmount)),
          page,
          pageSize,
          start,
          end
        );
        total = result.total;
        rows = result.rows;
        break;
      }
      default:
        total = await fetchWorkOrders(this.baseWorkOrderWhere(user, query), MAINTENANCE_EXCEPTION_LABELS[exceptionType]);
    }

    if (query.severity) {
      rows = rows.filter((row) => row.riskSeverity === query.severity);
    }

    return {
      type: exceptionType,
      label: MAINTENANCE_EXCEPTION_LABELS[exceptionType],
      generatedAt: new Date().toISOString(),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      rows
    };
  }

  async getKpis(actor: Actor | undefined, query: MaintenanceReportQuery = {}) {
    const user = this.assertReportAccess(actor, "full");
    const tenantId = this.resolveTenantId(user);
    const tenantFilter = tenantId !== undefined ? { tenantId } : {};
    const { start, end } = this.resolveDateRange(query);
    const rangeFilter = { createdAt: { gte: start, lte: end } };

    const [
      total,
      open,
      inProgress,
      technicianCompleted,
      supervisorVerified,
      completed,
      cancelled,
      reopened,
      overdueOrders
    ] = await Promise.all([
      this.prisma.workOrder.count({ where: { ...tenantFilter, ...rangeFilter } }),
      this.prisma.workOrder.count({ where: { ...tenantFilter, ...rangeFilter, status: WorkOrderStatus.OPEN } }),
      this.prisma.workOrder.count({ where: { ...tenantFilter, ...rangeFilter, status: WorkOrderStatus.IN_PROGRESS } }),
      this.prisma.workOrder.count({ where: { ...tenantFilter, ...rangeFilter, status: WorkOrderStatus.TECHNICIAN_COMPLETED } }),
      this.prisma.workOrder.count({
        where: { ...tenantFilter, ...rangeFilter, verificationStatus: WorkOrderVerificationStatus.VERIFIED }
      }),
      this.prisma.workOrder.count({ where: { ...tenantFilter, ...rangeFilter, status: WorkOrderStatus.COMPLETED } }),
      this.prisma.workOrder.count({ where: { ...tenantFilter, ...rangeFilter, status: WorkOrderStatus.CANCELLED } }),
      this.prisma.workOrder.count({ where: { ...tenantFilter, reopenedAt: { not: null }, updatedAt: { gte: start, lte: end } } }),
      this.prisma.workOrder.findMany({
        where: { ...tenantFilter, ...rangeFilter, status: { in: ACTIVE_STATUSES } },
        select: { status: true, dueDate: true, completedDate: true }
      })
    ]);

    const overdue = overdueOrders.filter((wo) => this.isOverdue(wo)).length;
    const completedOrders = await this.prisma.workOrder.findMany({
      where: { ...tenantFilter, ...rangeFilter, status: WorkOrderStatus.COMPLETED, completedDate: { not: null }, startDate: { not: null } },
      select: { startDate: true, completedDate: true, slaBreached: true }
    });

    const avgCompletionHours =
      completedOrders.length > 0
        ? completedOrders.reduce((sum, wo) => {
            const ms = (wo.completedDate!.getTime() - wo.startDate!.getTime()) / 3_600_000;
            return sum + Math.max(0, ms);
          }, 0) / completedOrders.length
        : null;

    const slaBreaches = completedOrders.filter((wo) => wo.slaBreached).length;

    const partLines = await this.prisma.workOrderPart.findMany({
      where: { ...tenantFilter, createdAt: { gte: start, lte: end } }
    });

    const partsKpis = {
      requested: partLines.reduce((s, l) => s + l.requestedQuantity, 0),
      approved: partLines.reduce((s, l) => s + (l.approvedQuantity ?? 0), 0),
      issued: partLines.reduce((s, l) => s + l.issuedQuantity, 0),
      used: partLines.reduce((s, l) => s + l.usedQuantity, 0),
      returned: partLines.reduce((s, l) => s + l.returnedQuantity, 0),
      unaccounted: partLines.filter((l) => l.issuedQuantity > 0 && pendingQuantity(l) > 0).length,
      duplicateRequests: await this.countException("duplicate-part-requests", user, query),
      highCostIssues: partLines.filter((l) => l.issuedQuantity * l.unitCost >= PART_APPROVAL_HIGH_THRESHOLD).length
    };

    return {
      generatedAt: new Date().toISOString(),
      range: { start: start.toISOString(), end: end.toISOString() },
      workOrders: { total, open, inProgress, technicianCompleted, supervisorVerified, completed, cancelled, reopened, overdue, avgCompletionHours, slaBreaches },
      parts: partsKpis
    };
  }

  async getCosts(actor: Actor | undefined, query: MaintenanceReportQuery = {}) {
    const user = this.assertReportAccess(actor, "cost");
    const tenantId = this.resolveTenantId(user);
    const { start, end } = this.resolveDateRange(query);
    const lines = await this.prisma.workOrderPart.findMany({
      where: { ...(tenantId !== undefined ? { tenantId } : {}), createdAt: { gte: start, lte: end } },
      include: { workOrder: { select: { assetId: true, asset: { select: { name: true, departmentRef: { select: { name: true } } } } } } }
    });

    const summary = lines.reduce(
      (acc, line) => {
        acc.requested += line.requestedQuantity * line.unitCost;
        acc.approved += (line.approvedQuantity ?? line.requestedQuantity) * line.unitCost;
        acc.issued += line.issuedQuantity * line.unitCost;
        acc.used += line.usedQuantity * line.unitCost;
        acc.returned += line.returnedQuantity * line.unitCost;
        return acc;
      },
      { requested: 0, approved: 0, issued: 0, used: 0, returned: 0 }
    );

    const highCostWorkOrders = await this.prisma.workOrder.count({
      where: {
        ...(tenantId !== undefined ? { tenantId } : {}),
        createdAt: { gte: start, lte: end },
        OR: [{ actualCost: { gte: WORK_ORDER_HIGH_COST_THRESHOLD } }, { estimatedCost: { gte: WORK_ORDER_HIGH_COST_THRESHOLD } }]
      }
    });

    return {
      generatedAt: new Date().toISOString(),
      ...summary,
      netPartCost: summary.used,
      highCostWorkOrders,
      byAsset: this.groupCostByKey(lines, (l) => l.workOrder.asset?.name ?? "Unassigned asset"),
      byDepartment: this.groupCostByKey(lines, (l) => l.workOrder.asset?.departmentRef?.name ?? "Unassigned department")
    };
  }

  private groupCostByKey(
    lines: Array<{
      usedQuantity: number;
      unitCost: number;
      workOrder: { asset?: { name?: string; departmentRef?: { name?: string } | null } | null };
    }>,
    keyFn: (line: (typeof lines)[number]) => string
  ) {
    const map = new Map<string, number>();
    for (const line of lines) {
      const key = keyFn(line);
      map.set(key, (map.get(key) ?? 0) + line.usedQuantity * line.unitCost);
    }
    return [...map.entries()]
      .map(([label, cost]) => ({ label, cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }

  async getWorkforceReport(actor: Actor | undefined, query: MaintenanceReportQuery = {}) {
    const user = this.assertReportAccess(actor, "full");
    const summary = await this.workforcePlanning.getWorkloadSummary(user, {
      departmentId: query.departmentId,
      branchName: query.branch,
      from: query.startDate,
      to: query.endDate,
      overdueOnly: false
    });

    const assignedDuringLeave = await this.prisma.workOrderAssignee.count({
      where: {
        ...(this.resolveTenantId(user) !== undefined ? { tenantId: this.resolveTenantId(user) } : {}),
        leaveOverride: true
      }
    });

    return {
      generatedAt: new Date().toISOString(),
      assignedDuringLeave,
      aboveCapacity: summary.rows.filter((row) => row.workloadPercentage >= 100).length,
      employees: summary.rows.slice(0, 50)
    };
  }

  async getPartsReport(actor: Actor | undefined, query: MaintenanceReportQuery = {}) {
    const user = this.assertReportAccess(actor, "parts");
    const tenantId = this.resolveTenantId(user);
    const { start, end } = this.resolveDateRange(query);
    const lines = await this.prisma.workOrderPart.findMany({
      where: { ...(tenantId !== undefined ? { tenantId } : {}), createdAt: { gte: start, lte: end } },
      include: { part: { select: { name: true, partNumber: true } }, workOrder: { select: { woNumber: true, title: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100
    });

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        lines: lines.length,
        unaccounted: lines.filter((l) => l.issuedQuantity > 0 && pendingQuantity(l) > 0).length,
        pendingReturns: lines.filter((l) => l.pendingReturnQuantity > 0).length,
        procurementRequired: lines.filter((l) => l.procurementRequired).length
      },
      lines: lines.map((line) => ({
        workOrder: line.workOrder.woNumber,
        title: line.workOrder.title,
        part: line.part.name,
        partNumber: line.part.partNumber,
        requested: line.requestedQuantity,
        issued: line.issuedQuantity,
        used: line.usedQuantity,
        returned: line.returnedQuantity,
        pendingReturn: line.pendingReturnQuantity,
        status: line.lineStatus,
        cost: line.usedQuantity * line.unitCost
      }))
    };
  }

  async getAssetsReport(actor: Actor | undefined, query: MaintenanceReportQuery = {}) {
    const user = this.assertReportAccess(actor, "full");
    const tenantId = this.resolveTenantId(user);
    const { start, end } = this.resolveDateRange(query);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const orders = await this.prisma.workOrder.findMany({
      where: {
        ...(tenantId !== undefined ? { tenantId } : {}),
        assetId: { not: null },
        createdAt: { gte: start, lte: end }
      },
      include: {
        asset: { select: { id: true, name: true } },
        parts: { select: { usedQuantity: true, unitCost: true } }
      }
    });

    const byAsset = new Map<string, { name: string; workOrders: number; partsCost: number; breakdowns: number }>();
    for (const wo of orders) {
      if (!wo.assetId || !wo.asset) continue;
      const current = byAsset.get(wo.assetId) ?? { name: wo.asset.name, workOrders: 0, partsCost: 0, breakdowns: 0 };
      current.workOrders += 1;
      current.partsCost += wo.parts.reduce((s, p) => s + p.usedQuantity * p.unitCost, 0);
      if (["CORRECTIVE", "EMERGENCY"].includes(wo.type) && wo.createdAt >= thirtyDaysAgo) {
        current.breakdowns += 1;
      }
      byAsset.set(wo.assetId, current);
    }

    return {
      generatedAt: new Date().toISOString(),
      assets: [...byAsset.entries()]
        .map(([assetId, data]) => ({
          assetId,
          ...data,
          repeatedBreakdown: data.breakdowns >= 3
        }))
        .sort((a, b) => b.partsCost - a.partsCost)
        .slice(0, 25)
    };
  }

  async exportCsv(actor: Actor | undefined, type: string, query: MaintenanceReportQuery = {}) {
    const user = this.assertReportAccess(actor, "full");
    const detail = await this.getExceptionDetail(user, type, { ...query, page: 1, pageSize: 500 });
    const header = [
      "Work Order",
      "Title",
      "Asset",
      "Status",
      "Priority",
      "Exception",
      "Reason",
      "Cost Impact",
      "Risk Score",
      "Risk Severity",
      "Due Date",
      "Created"
    ];
    const lines = [
      header.join(","),
      ...detail.rows.map((row) =>
        [
          row.woNumber,
          `"${row.title.replace(/"/g, '""')}"`,
          row.assetName ?? "",
          row.status,
          row.priority,
          row.exceptionType,
          `"${row.exceptionReason.replace(/"/g, '""')}"`,
          row.costImpact ?? "",
          row.riskScore,
          row.riskSeverity,
          row.dueDate ?? "",
          row.createdAt
        ].join(",")
      )
    ];

    await this.recordAudit(user, "report_exported", type, query);

    return {
      filename: `maintenance-${type}-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content: lines.join("\n"),
      rowCount: detail.rows.length,
      generatedAt: new Date().toISOString(),
      generatedBy: user.email
    };
  }

  private async recordAudit(actor: Actor, event: string, reportType: string, query: MaintenanceReportQuery) {
    const ctx = requestContext.get();
    await this.prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId ?? ctx?.tenantId ?? null,
        actorId: actor.sub,
        module: "reports",
        entity: "MAINTENANCE_REPORT",
        entityId: reportType,
        action: AuditAction.UPDATE,
        reason: event,
        metadata: {
          event,
          reportType,
          filters: {
            startDate: query.startDate,
            endDate: query.endDate,
            departmentId: query.departmentId,
            exceptionType: query.exceptionType
          }
        } as Prisma.InputJsonValue,
        actorSnapshot: { id: actor.sub, email: actor.email, role: actor.role } as Prisma.InputJsonValue
      }
    });
  }
}
