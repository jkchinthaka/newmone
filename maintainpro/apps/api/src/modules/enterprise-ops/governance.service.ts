import { Injectable } from "@nestjs/common";
import { AppSettingScope } from "@prisma/client";
import {
  AssetCondition,
  EmployeeAvailabilityStatus,
  LeaveRequestStatus,
  POStatus,
  Priority,
  PurchaseOrderWorkflowStatus,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import {
  canAssignTechnician,
  canCommitBudget,
  canStartHazardousWork,
  canUseVendor,
  evaluateSlaClock,
  matchThreeWay,
  mttrMtbf,
  scoreAssetCriticality,
  scoreAssetHealth
} from "../policies/governance-policies";
import { DomainNotificationService } from "./domain-notification.service";
import { DomainEventsService } from "./domain-events.service";
import { OrganizationPolicyService } from "./organization-policy.service";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgPolicy: OrganizationPolicyService,
    private readonly events: DomainEventsService,
    private readonly notifications: DomainNotificationService
  ) {}

  async evaluateWorkOrderSla(workOrder: {
    id: string;
    tenantId?: string | null;
    status: WorkOrderStatus | string;
    priority: Priority | string;
    createdAt: Date;
    slaDeadline?: Date | null;
    slaBreached?: boolean;
  }, options?: { emit?: boolean }) {
    if (!workOrder.tenantId) return null;
    const policy = await this.orgPolicy.getPolicy(workOrder.tenantId);
    const slaHours = slaHoursFor(workOrder.priority as Priority, workOrder.slaDeadline, workOrder.createdAt);
    const clock = evaluateSlaClock({
      tenantId: workOrder.tenantId,
      slaHours,
      createdAt: workOrder.createdAt,
      now: new Date(),
      status: workOrder.status,
      policy
    });
    if (options?.emit !== false) {
      if (clock.stage === "WARNING") {
        await this.notifications.emit({
          type: "WORK_ORDER_SLA_WARNING",
          tenantId: workOrder.tenantId,
          entityType: "WorkOrder",
          entityId: workOrder.id,
          severity: "WARNING",
          metadata: { consumedPct: clock.consumedPct }
        });
      }
      if (clock.stage === "BREACH" || clock.stage === "ESCALATED") {
        await this.notifications.emit({
          type: "WORK_ORDER_SLA_BREACH",
          tenantId: workOrder.tenantId,
          entityType: "WorkOrder",
          entityId: workOrder.id,
          severity: "CRITICAL",
          metadata: { consumedPct: clock.consumedPct, stage: clock.stage }
        });
      }
    }
    return { ...clock, slaHours, policyThresholds: policy };
  }

  async onWorkOrderTransition(workOrder: {
    id: string;
    tenantId?: string | null;
    status: WorkOrderStatus | string;
    priority: Priority | string;
    createdAt: Date;
    slaDeadline?: Date | null;
    type?: WorkOrderType | string;
    taxonomyIssueId?: string | null;
  }) {
    if (!workOrder.tenantId) return;
    await this.events.enqueue({
      tenantId: workOrder.tenantId,
      eventId: `WO_TRANSITION:${workOrder.id}:${workOrder.status}`,
      eventType: "WORK_ORDER_STATUS_CHANGED",
      aggregateType: "WorkOrder",
      aggregateId: workOrder.id,
      payload: { status: workOrder.status, type: workOrder.type }
    });
    await this.evaluateWorkOrderSla(workOrder);
    await this.events.drain(workOrder.tenantId, 20);
  }

  async listSlaQueue(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const open = await this.prisma.workOrder.findMany({
      where: { tenantId, status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED] } },
      select: {
        id: true,
        tenantId: true,
        status: true,
        priority: true,
        createdAt: true,
        slaDeadline: true,
        slaBreached: true,
        woNumber: true,
        title: true
      },
      take: 80,
      orderBy: { createdAt: "desc" }
    });
    const data = [];
    for (const row of open) {
      const clock = await this.evaluateWorkOrderSla(row, { emit: false });
      data.push({ ...row, ...clock });
    }
    return data;
  }

  async recommendTechnicians(actor: Actor, workOrderId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: { taxonomyIssue: true, assignees: true }
    });
    if (!workOrder) return [];
    const now = new Date();
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, active: true, canReceiveWorkOrders: true },
      include: {
        employeeLeaveRequests: {
          where: { status: LeaveRequestStatus.APPROVED, startDate: { lte: now }, endDate: { gte: now } }
        },
        workOrderAssigneeRows: {
          where: { assignmentStatus: { not: "REMOVED" }, workOrder: { status: { notIn: ["COMPLETED", "CANCELLED"] } } }
        }
      },
      take: 50
    });
    const keywords = [
      workOrder.issueNameSnapshot,
      workOrder.typeNameSnapshot,
      workOrder.taxonomyIssue?.name,
      workOrder.taxonomyIssue?.code
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    return employees
      .map((employee) => {
        const skillMatch =
          keywords.length === 0 ||
          employee.skills.some((skill) => keywords.some((keyword) => skill.toLowerCase().includes(keyword))) ||
          employee.workCategories.some((category) =>
            keywords.some((keyword) => category.toLowerCase().includes(keyword))
          );
        const onLeave = employee.employeeLeaveRequests.length > 0;
        const remainingHours = Math.max(
          0,
          (employee.dailyCapacityHours ?? 8) -
            employee.workOrderAssigneeRows.reduce((sum, row) => sum + (row.estimatedHours ?? 1), 0)
        );
        const decision = canAssignTechnician({
          tenantId,
          employeeActive: employee.active && employee.availabilityStatus !== EmployeeAvailabilityStatus.INACTIVE,
          canReceiveWorkOrders: employee.canReceiveWorkOrders,
          onLeave,
          skillMatch,
          remainingHours,
          estimatedHours: workOrder.estimatedHours ?? 1
        });
        return {
          employeeId: employee.id,
          fullName: employee.fullName,
          skills: employee.skills,
          remainingHours,
          onLeave,
          allowed: decision.allowed,
          code: decision.code,
          reasons: [decision.reason]
        };
      })
      .sort((left, right) => Number(right.allowed) - Number(left.allowed) || right.remainingHours - left.remainingHours);
  }

  async matchPurchaseOrders(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const orders = await this.prisma.purchaseOrder.findMany({
      where: { tenantId, status: { not: POStatus.CANCELLED } },
      include: { lines: true, receipts: true },
      orderBy: { createdAt: "desc" },
      take: 80
    });
    return orders.map((order) => {
      const orderedQty = order.lines.reduce((sum, line) => sum + line.quantity, 0);
      const receivedQty = order.lines.reduce((sum, line) => sum + line.receivedQuantity, 0);
      const match = matchThreeWay({
        orderedQty,
        receivedQty,
        invoicedQty: null,
        poPrice: order.totalAmount,
        invoicePrice: null
      });
      return {
        id: order.id,
        poNumber: order.poNumber,
        status: order.status,
        orderedQty,
        receivedQty,
        invoicedQty: null,
        invoiceCoverage: "INSUFFICIENT_DATA",
        ...match
      };
    });
  }

  async budgetSnapshot(actor: Actor, period?: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const policy = await this.orgPolicy.getPolicy(tenantId);
    const yearMonth = period ?? new Date().toISOString().slice(0, 7);
    const openPos = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        workflowStatus: PurchaseOrderWorkflowStatus.APPROVED,
        status: { in: [POStatus.PENDING, POStatus.ORDERED, POStatus.PARTIALLY_RECEIVED] }
      },
      select: { id: true, totalAmount: true, createdAt: true }
    });
    for (const order of openPos) {
      await this.prisma.budgetCommitment.upsert({
        where: { tenantId_sourceType_sourceId: { tenantId, sourceType: "PO", sourceId: order.id } },
        create: {
          tenantId,
          period: yearMonth,
          category: "PROCUREMENT",
          sourceType: "PO",
          sourceId: order.id,
          amount: order.totalAmount,
          status: "COMMITTED"
        },
        update: { amount: order.totalAmount, status: "COMMITTED", period: yearMonth }
      });
    }
    const committed = await this.prisma.budgetCommitment.aggregate({
      where: { tenantId, period: yearMonth, status: "COMMITTED" },
      _sum: { amount: true }
    });
    const configured = await this.prisma.appSetting.findUnique({
      where: {
        scope_scopeId_key: {
          scope: AppSettingScope.TENANT,
          scopeId: tenantId,
          key: `enterprise.budget.${yearMonth}`
        }
      }
    });
    const budgetAmount =
      configured && typeof configured.value === "object" && configured.value && "amount" in configured.value
        ? Number((configured.value as { amount?: number }).amount)
        : null;
    const decision = canCommitBudget({
      tenantId,
      budgetAmount: Number.isFinite(budgetAmount) ? budgetAmount : null,
      committed: committed._sum.amount ?? 0,
      requested: 0,
      policy
    });
    return {
      period: yearMonth,
      budgetAmount: Number.isFinite(budgetAmount) ? budgetAmount : null,
      committed: committed._sum.amount ?? 0,
      coverage: budgetAmount == null ? "INSUFFICIENT_DATA" : "COMPLETE",
      decision
    };
  }

  async assetHealth(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, archivedAt: null },
      take: 100,
      orderBy: { updatedAt: "desc" }
    });
    const now = new Date();
    const since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const results = [];
    for (const asset of assets) {
      const [criticalWos, completed] = await Promise.all([
        this.prisma.workOrder.count({
          where: {
            tenantId,
            assetId: asset.id,
            priority: Priority.CRITICAL,
            status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED] }
          }
        }),
        this.prisma.workOrder.findMany({
          where: {
            tenantId,
            assetId: asset.id,
            completedDate: { gte: since },
            startDate: { not: null }
          },
          select: { startDate: true, completedDate: true }
        })
      ]);
      const downtimeHours = completed
        .map((row) => {
          if (!row.startDate || !row.completedDate) return 0;
          return Math.max(0, (row.completedDate.getTime() - row.startDate.getTime()) / 36e5);
        })
        .filter((hours) => hours > 0);
      const reliability = mttrMtbf(downtimeHours.map((hours) => ({ downtimeHours: hours })));
      const overdue = Boolean(asset.nextServiceDate && asset.nextServiceDate.getTime() < now.getTime());
      const health = scoreAssetHealth({
        status: asset.status,
        overdueMaintenance: overdue,
        openCriticalWorkOrders: criticalWos,
        downtimeHours90d: downtimeHours.length ? downtimeHours.reduce((sum, hours) => sum + hours, 0) : null,
        condition: asset.condition as AssetCondition
      });
      const criticality = scoreAssetCriticality({
        condition: asset.condition,
        storedCriticality: asset.criticality
      });
      results.push({
        id: asset.id,
        assetTag: asset.assetTag,
        name: asset.name,
        status: asset.status,
        ...health,
        criticality: criticality.band,
        criticalityReasons: criticality.reasons,
        mttrHours: reliability.mttrHours,
        mtbfHours: reliability.mtbfHours,
        reliabilityCoverage: reliability.coverage
      });
    }
    return results;
  }

  async vendorEligibility(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const vendors = await this.prisma.supplier.findMany({ where: { tenantId }, take: 80, orderBy: { name: "asc" } });
    return vendors.map((vendor) => {
      const decision = canUseVendor({
        tenantId,
        active: vendor.isActive,
        blacklisted: vendor.blacklisted
      });
      return {
        id: vendor.id,
        name: vendor.name,
        vendorCode: vendor.vendorCode,
        allowed: decision.allowed,
        code: decision.code,
        contractCoverage: "INSUFFICIENT_DATA",
        insuranceCoverage: "INSUFFICIENT_DATA"
      };
    });
  }

  async mappingQueue(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const mismatches = await this.prisma.erpReconciliationMismatch.findMany({
      where: {
        tenantId,
        OR: [{ mismatchType: { in: ["UNKNOWN_ITEM", "UNKNOWN_WAREHOUSE", "MISSING_MAPPING", "MAPPING_REQUIRED"] } }, { fieldName: "mapping" }]
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return mismatches.map((row) => ({
      id: row.id,
      sourceRecordCode: row.sourceRecordCode,
      mismatchType: row.mismatchType,
      status: row.status,
      code: "MAPPING_REQUIRED"
    }));
  }

  async evaluatePermit(actor: Actor, workOrderId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const policy = await this.orgPolicy.getPolicy(tenantId);
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: { taxonomyIssue: true, evidenceAttachments: { where: { deletedAt: null } } }
    });
    if (!workOrder) return null;
    const hazardous =
      Boolean(workOrder.taxonomyIssue?.gateOutBlockingRisk) ||
      policy.ptwRequiredTaxonomyCodes.includes(workOrder.taxonomyIssue?.code ?? "");
    const permitEvidencePresent = workOrder.evidenceAttachments.some(
      (item) => item.evidenceType === "OTHER_DOCUMENT" || item.evidenceType === "SUPERVISOR_NOTE"
    );
    return canStartHazardousWork({
      tenantId,
      hazardous,
      permitEvidencePresent,
      policy
    });
  }
}

function slaHoursFor(priority: Priority, deadline: Date | null | undefined, createdAt: Date): number {
  if (deadline) {
    return Math.max(1, (deadline.getTime() - createdAt.getTime()) / 36e5);
  }
  switch (priority) {
    case Priority.CRITICAL:
      return 4;
    case Priority.HIGH:
      return 24;
    case Priority.MEDIUM:
      return 72;
    default:
      return 168;
  }
}
