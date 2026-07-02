import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { AuditAction, Prisma, RoleName, WorkOrderAssigneeStatus, WorkOrderStatus, WorkOrderType } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import {
  computeDowntimeHours,
  computeWorkOrderCosts,
  DOWNTIME_HOURLY_COST,
  MANAGEMENT_INTELLIGENCE_DISCLAIMER,
  recommendAction,
  repairVsReplaceFlag,
  riskSeverityFromCost
} from "../../common/utils/management-intelligence-cost.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import type {
  ManagementReportKey,
  ManagementReportQuery,
  ManagementSummaryCard,
  PaginatedRows
} from "./management-intelligence.types";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

const BLOCKED_ROLES = new Set<RoleName>([RoleName.TECHNICIAN, RoleName.MECHANIC, RoleName.DRIVER, RoleName.VIEWER]);
const FULL_ACCESS_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER
]);
const FINANCE_ROLE_NAMES = new Set<string>(["FINANCE_APPROVER"]);
const SUPERVISOR_ROLES = new Set<RoleName>([RoleName.SUPERVISOR]);
const PARTS_ROLES = new Set<RoleName>([RoleName.INVENTORY_KEEPER]);

const MAX_ROWS = 5000;
const DEFAULT_PAGE_SIZE = 50;

const workOrderCostInclude = {
  asset: {
    select: {
      id: true,
      name: true,
      currentValue: true,
      location: true,
      departmentId: true,
      departmentRef: { select: { id: true, name: true } }
    }
  },
  vehicle: {
    select: {
      id: true,
      registrationNo: true,
      currentMileage: true,
      departmentId: true,
      department: { select: { id: true, name: true } }
    }
  },
  technician: { select: { id: true, firstName: true, lastName: true } },
  parts: { select: { usedQuantity: true, unitCost: true, issuedQuantity: true } },
  vendorRepairCase: {
    select: {
      supplierId: true,
      emergencyOverride: true,
      supplier: { select: { id: true, name: true } },
      invoices: { select: { totalAmount: true, status: true, invoiceAmount: true } }
    }
  },
  assignees: {
    where: { assignmentStatus: { not: WorkOrderAssigneeStatus.REMOVED } },
    take: 1,
    include: { employee: { select: { branchName: true } } }
  }
} satisfies Prisma.WorkOrderInclude;

type LoadedWorkOrder = Prisma.WorkOrderGetPayload<{ include: typeof workOrderCostInclude }>;

type CostedWorkOrder = {
  id: string;
  woNumber: string;
  title: string;
  status: WorkOrderStatus;
  priority: string;
  type: WorkOrderType;
  category: string;
  typeName: string;
  issueName: string;
  assetId: string | null;
  assetName: string | null;
  assetValue: number | null;
  vehicleId: string | null;
  vehicleLabel: string | null;
  vehicleMileage: number | null;
  departmentId: string | null;
  departmentName: string;
  branchName: string;
  technicianId: string | null;
  technicianName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  createdAt: Date;
  completedDate: Date | null;
  startDate: Date | null;
  partsCost: number;
  vendorCost: number;
  laborCost: number;
  totalMaintenanceCost: number;
  downtimeHours: number;
  isCorrective: boolean;
  isAccident: boolean;
};

@Injectable()
export class ManagementIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  assertAccess(actor: Actor | undefined, scope: "full" | "finance" | "supervisor" | "parts" = "full"): Actor {
    if (!actor?.sub || !actor.role) {
      throw new ForbiddenException("Authenticated user required.");
    }
    if (BLOCKED_ROLES.has(actor.role as RoleName)) {
      throw new ForbiddenException("Management profitability reports are not available for this role.");
    }
    if (scope === "full" && FULL_ACCESS_ROLES.has(actor.role as RoleName)) return actor;
    if (scope === "finance" && (FULL_ACCESS_ROLES.has(actor.role as RoleName) || FINANCE_ROLE_NAMES.has(String(actor.role)))) {
      return actor;
    }
    if (scope === "supervisor" && (FULL_ACCESS_ROLES.has(actor.role as RoleName) || SUPERVISOR_ROLES.has(actor.role as RoleName))) {
      return actor;
    }
    if (scope === "parts" && (FULL_ACCESS_ROLES.has(actor.role as RoleName) || PARTS_ROLES.has(actor.role as RoleName))) {
      return actor;
    }
    throw new ForbiddenException("You do not have permission to view this management report.");
  }

  async getProfitabilitySummary(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "full");
    const orders = await this.loadCostedWorkOrders(actor, query);
    const previous = await this.loadCostedWorkOrders(actor, {
      ...query,
      ...this.previousPeriodRange(query)
    });

    const partsCost = this.sum(orders, (o) => o.partsCost);
    const vendorCost = this.sum(orders, (o) => o.vendorCost);
    const laborCost = this.sum(orders, (o) => o.laborCost);
    const totalCost = this.sum(orders, (o) => o.totalMaintenanceCost);
    const prevTotal = this.sum(previous, (o) => o.totalMaintenanceCost);

    const byDept = this.groupOrders(orders, (o) => o.departmentName);
    const byBranch = this.groupOrders(orders, (o) => o.branchName);
    const topDept = [...byDept.entries()].sort((a, b) => b[1].total - a[1].total)[0];
    const topBranch = [...byBranch.entries()].sort((a, b) => b[1].total - a[1].total)[0];

    const cards: ManagementSummaryCard[] = [
      { key: "total-cost", label: "Total maintenance cost", value: totalCost, subLabel: this.trendLabel(totalCost, prevTotal) },
      { key: "parts-cost", label: "Parts cost", value: partsCost },
      { key: "vendor-cost", label: "Vendor / external repair cost", value: vendorCost },
      { key: "downtime-hours", label: "Downtime hours", value: Number(this.sum(orders, (o) => o.downtimeHours).toFixed(1)) },
      { key: "high-cost-assets", label: "High-cost assets", value: this.countHighCostEntities(orders, "asset") },
      { key: "high-cost-vehicles", label: "High-cost vehicles", value: this.countHighCostEntities(orders, "vehicle") },
      { key: "repeated-breakdowns", label: "Repeated breakdowns", value: this.countRepeatedBreakdowns(orders, 60).length },
      { key: "repair-vs-replace", label: "Repair vs replace reviews", value: this.buildRepairVsReplaceRows(orders).length },
      { key: "top-department", label: "Top cost department", value: topDept?.[0] ?? "—", subLabel: topDept ? String(topDept[1].total) : undefined },
      { key: "top-branch", label: "Top cost branch", value: topBranch?.[0] ?? "—", subLabel: topBranch ? String(topBranch[1].total) : undefined }
    ];

    return {
      cards,
      monthlyTrend: this.buildMonthlyTrend(orders).slice(-6),
      topAssets: this.buildTopEntities(orders, "asset", 5),
      topVehicles: this.buildTopEntities(orders, "vehicle", 5),
      generatedAt: new Date().toISOString(),
      disclaimer: MANAGEMENT_INTELLIGENCE_DISCLAIMER,
      filtersApplied: this.filtersSnapshot(query)
    };
  }

  async getCostByAsset(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "full");
    return this.buildEntityCostReport(actor, query, "asset");
  }

  async getCostByVehicle(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "full");
    return this.buildEntityCostReport(actor, query, "vehicle");
  }

  async getCostByDepartment(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "supervisor");
    return this.buildGroupedCostReport(actor, query, (o) => o.departmentName, "departmentName");
  }

  async getCostByBranch(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "full");
    return this.buildGroupedCostReport(actor, query, (o) => o.branchName, "branchName");
  }

  async getCostByCategory(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "full");
    return this.buildGroupedCostReport(actor, query, (o) => o.category, "category");
  }

  async getTopHighCostAssets(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "full");
    const orders = await this.loadCostedWorkOrders(actor, query);
    return {
      rows: this.buildTopEntities(orders, "asset", 20),
      generatedAt: new Date().toISOString(),
      disclaimer: MANAGEMENT_INTELLIGENCE_DISCLAIMER
    };
  }

  async getTopHighCostVehicles(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "full");
    const orders = await this.loadCostedWorkOrders(actor, query);
    return {
      rows: this.buildTopEntities(orders, "vehicle", 20),
      generatedAt: new Date().toISOString(),
      disclaimer: MANAGEMENT_INTELLIGENCE_DISCLAIMER
    };
  }

  async getRepeatedBreakdowns(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "supervisor");
    const orders = await this.loadCostedWorkOrders(actor, query);
    const windowDays = query.repeatWindowDays ?? 60;
    const rows = this.countRepeatedBreakdowns(orders, windowDays).map((row, index) => ({
      rank: index + 1,
      ...row
    }));
    return this.paginate(rows, query);
  }

  async getVendorCostComparison(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "finance");
    const orders = await this.loadCostedWorkOrders(actor, query);
    const map = new Map<
      string,
      {
        vendorId: string;
        vendorName: string;
        invoiceCount: number;
        totalVendorCost: number;
        quotationVariance: number;
        emergencyCount: number;
        workOrderCount: number;
      }
    >();

    for (const order of orders) {
      if (!order.vendorId) continue;
      const current = map.get(order.vendorId) ?? {
        vendorId: order.vendorId,
        vendorName: order.vendorName ?? "Unknown vendor",
        invoiceCount: 0,
        totalVendorCost: 0,
        quotationVariance: 0,
        emergencyCount: 0,
        workOrderCount: 0
      };
      current.workOrderCount += 1;
      current.totalVendorCost += order.vendorCost;
      if (order.vendorCost > 0) current.invoiceCount += 1;
      map.set(order.vendorId, current);
    }

    const rows = [...map.values()]
      .map((row) => ({
        ...row,
        averageInvoiceAmount: row.invoiceCount > 0 ? Number((row.totalVendorCost / row.invoiceCount).toFixed(2)) : 0,
        recommendedAction: recommendAction({
          totalCost: row.totalVendorCost,
          repeatedCount: row.workOrderCount,
          downtimeHours: 0,
          vendorCost: row.totalVendorCost,
          partsCost: 0
        })
      }))
      .sort((a, b) => b.totalVendorCost - a.totalVendorCost);

    return this.paginate(rows, query);
  }

  async getPartsUsageByTechnician(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "parts");
    const orders = await this.loadCostedWorkOrders(actor, query);
    const map = new Map<
      string,
      {
        technicianId: string;
        technicianName: string;
        partsIssuedCost: number;
        partsUsedCost: number;
        workOrderCount: number;
        abnormalScore: number;
      }
    >();

    for (const order of orders) {
      if (!order.technicianId) continue;
      const current = map.get(order.technicianId) ?? {
        technicianId: order.technicianId,
        technicianName: order.technicianName ?? "Unknown",
        partsIssuedCost: 0,
        partsUsedCost: 0,
        workOrderCount: 0,
        abnormalScore: 0
      };
      current.partsUsedCost += order.partsCost;
      current.partsIssuedCost += order.partsCost;
      current.workOrderCount += 1;
      map.set(order.technicianId, current);
    }

    const avgParts =
      map.size > 0 ? [...map.values()].reduce((s, r) => s + r.partsUsedCost, 0) / map.size : 0;
    const rows = [...map.values()]
      .map((row) => ({
        ...row,
        averagePartsPerWorkOrder: row.workOrderCount > 0 ? Number((row.partsUsedCost / row.workOrderCount).toFixed(2)) : 0,
        abnormalScore: avgParts > 0 && row.partsUsedCost > avgParts * 1.5 ? 15 : row.partsUsedCost > avgParts * 1.2 ? 10 : 0,
        riskSeverity: riskSeverityFromCost(row.partsUsedCost, 0)
      }))
      .sort((a, b) => b.partsUsedCost - a.partsUsedCost);

    return this.paginate(rows, query);
  }

  async getMonthlyCostTrend(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "finance");
    const orders = await this.loadCostedWorkOrders(actor, query);
    return {
      rows: this.buildMonthlyTrend(orders),
      generatedAt: new Date().toISOString(),
      disclaimer: MANAGEMENT_INTELLIGENCE_DISCLAIMER,
      filtersApplied: this.filtersSnapshot(query)
    };
  }

  async getRepairVsReplace(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "full");
    const rows = this.buildRepairVsReplaceRows(await this.loadCostedWorkOrders(actor, query));
    return this.paginate(rows, query);
  }

  async getDowntimeCost(actor: Actor, query: ManagementReportQuery = {}) {
    this.assertAccess(actor, "full");
    const orders = await this.loadCostedWorkOrders(actor, query);
    const totalHours = this.sum(orders, (o) => o.downtimeHours);
    const estimatedCost = DOWNTIME_HOURLY_COST > 0 ? Number((totalHours * DOWNTIME_HOURLY_COST).toFixed(2)) : null;

    const byAsset = this.buildGroupedCostReportSync(orders, (o) => o.assetName ?? "Unassigned", "assetName");
    const byDepartment = this.buildGroupedCostReportSync(orders, (o) => o.departmentName, "departmentName");

    return {
      totalDowntimeHours: Number(totalHours.toFixed(2)),
      estimatedDowntimeCost: estimatedCost,
      hourlyRateConfigured: DOWNTIME_HOURLY_COST > 0,
      byAsset: byAsset.rows.slice(0, 20).map((r) => ({ label: r.label, downtimeHours: r.downtimeHours })),
      byDepartment: byDepartment.rows.slice(0, 20).map((r) => ({ label: r.label, downtimeHours: r.downtimeHours })),
      generatedAt: new Date().toISOString(),
      disclaimer:
        estimatedCost === null
          ? "Downtime hours are computed from work order start to completion. Configure DOWNTIME_HOURLY_COST for estimated production loss."
          : MANAGEMENT_INTELLIGENCE_DISCLAIMER,
      filtersApplied: this.filtersSnapshot(query)
    };
  }

  async exportReport(actor: Actor, reportKey: ManagementReportKey, query: ManagementReportQuery = {}) {
    const data = await this.resolveReport(actor, reportKey, query);
    const rows = Array.isArray((data as { rows?: unknown[] }).rows) ? (data as { rows: Record<string, unknown>[] }).rows : [];
    if (rows.length === 0) {
      throw new BadRequestException("No rows available to export for the selected filters.");
    }

    const headers = Object.keys(rows[0]);
    const lines = [
      `# Report: ${reportKey}`,
      `# Generated at: ${new Date().toISOString()}`,
      `# Generated by: ${actor.email}`,
      `# Filters: ${JSON.stringify(this.filtersSnapshot(query))}`,
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((key) => {
            const value = row[key];
            if (value === null || value === undefined) return "";
            const text = String(value);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
          })
          .join(",")
      )
    ];

    await this.recordExportAudit(actor, reportKey, query);

    return {
      filename: `management-${reportKey}-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content: lines.join("\n"),
      rowCount: rows.length
    };
  }

  private async resolveReport(actor: Actor, reportKey: ManagementReportKey, query: ManagementReportQuery) {
    switch (reportKey) {
      case "profitability-summary":
        return this.getProfitabilitySummary(actor, query);
      case "cost-by-asset":
        return this.getCostByAsset(actor, query);
      case "cost-by-vehicle":
        return this.getCostByVehicle(actor, query);
      case "cost-by-department":
        return this.getCostByDepartment(actor, query);
      case "cost-by-branch":
        return this.getCostByBranch(actor, query);
      case "cost-by-category":
        return this.getCostByCategory(actor, query);
      case "top-high-cost-assets":
        return this.getTopHighCostAssets(actor, query);
      case "top-high-cost-vehicles":
        return this.getTopHighCostVehicles(actor, query);
      case "repeated-breakdowns":
        return this.getRepeatedBreakdowns(actor, query);
      case "vendor-cost-comparison":
        return this.getVendorCostComparison(actor, query);
      case "parts-usage-by-technician":
        return this.getPartsUsageByTechnician(actor, query);
      case "monthly-cost-trend":
        return this.getMonthlyCostTrend(actor, query);
      case "repair-vs-replace":
        return this.getRepairVsReplace(actor, query);
      case "downtime-cost":
        return this.getDowntimeCost(actor, query);
      default:
        throw new BadRequestException("Unknown management report key.");
    }
  }

  private async loadCostedWorkOrders(actor: Actor, query: ManagementReportQuery): Promise<CostedWorkOrder[]> {
    const tenantId = actor.tenantId ?? undefined;
    const { start, end } = this.resolveDateRange(query);

    const where: Prisma.WorkOrderWhereInput = {
      ...(tenantId !== undefined ? { tenantId } : {}),
      createdAt: { gte: start, lte: end },
      status: { not: WorkOrderStatus.CANCELLED }
    };

    if (query.assetId) where.assetId = query.assetId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.technicianId) where.technicianId = query.technicianId;
    if (query.departmentId) {
      where.OR = [
        { asset: { departmentId: query.departmentId } },
        { vehicle: { departmentId: query.departmentId } }
      ];
    }
    if (query.branch || query.branchId) {
      const branch = query.branch ?? query.branchId;
      where.AND = [
        {
          OR: [
            { asset: { location: { contains: branch, mode: "insensitive" } } },
            { assignees: { some: { employee: { branchName: { contains: branch, mode: "insensitive" } } } } }
          ]
        }
      ];
    }
    if (query.vendorId || query.supplierId) {
      where.vendorRepairCase = { supplierId: query.vendorId ?? query.supplierId };
    }

    const orders = await this.prisma.workOrder.findMany({
      where,
      include: workOrderCostInclude,
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS
    });

    const mapped = orders.map((order: LoadedWorkOrder) => {
      const costs = computeWorkOrderCosts({
        parts: order.parts,
        invoices: order.vendorRepairCase?.invoices ?? [],
        actualCost: order.actualCost
      });
      const departmentName =
        order.asset?.departmentRef?.name ?? order.vehicle?.department?.name ?? "Unassigned department";
      const branchName = order.asset?.location ?? order.assignees[0]?.employee.branchName ?? "Unassigned branch";
      const technicianName = order.technician
        ? `${order.technician.firstName} ${order.technician.lastName}`.trim()
        : null;

      return {
        id: order.id,
        woNumber: order.woNumber,
        title: order.title,
        status: order.status,
        priority: order.priority,
        type: order.type,
        category: order.categoryNameSnapshot?.trim() || "Unclassified / Legacy",
        typeName: order.typeNameSnapshot?.trim() || "Unclassified",
        issueName: order.issueNameSnapshot?.trim() || "Unclassified",
        assetId: order.assetId,
        assetName: order.asset?.name ?? null,
        assetValue: order.asset?.currentValue ?? null,
        vehicleId: order.vehicleId,
        vehicleLabel: order.vehicle?.registrationNo ?? null,
        vehicleMileage: order.vehicle?.currentMileage ?? null,
        departmentId: order.asset?.departmentId ?? order.vehicle?.departmentId ?? null,
        departmentName,
        branchName,
        technicianId: order.technicianId,
        technicianName,
        vendorId: order.vendorRepairCase?.supplierId ?? null,
        vendorName: order.vendorRepairCase?.supplier?.name ?? null,
        createdAt: order.createdAt,
        completedDate: order.completedDate,
        startDate: order.startDate,
        ...costs,
        downtimeHours: computeDowntimeHours(order.startDate ?? order.createdAt, order.completedDate),
        isCorrective: order.type === WorkOrderType.CORRECTIVE || order.type === WorkOrderType.EMERGENCY,
        isAccident: order.type === WorkOrderType.ACCIDENT_REPAIR
      } satisfies CostedWorkOrder;
    });

    return mapped.filter((row) => {
      if (query.minCost !== undefined && row.totalMaintenanceCost < query.minCost) return false;
      if (query.maxCost !== undefined && row.totalMaintenanceCost > query.maxCost) return false;
      return true;
    });
  }

  private async buildEntityCostReport(actor: Actor, query: ManagementReportQuery, entity: "asset" | "vehicle") {
    const orders = await this.loadCostedWorkOrders(actor, query);
    const rows = this.buildTopEntities(orders, entity, 500);
    return this.paginate(rows, query);
  }

  private async buildGroupedCostReport(
    actor: Actor,
    query: ManagementReportQuery,
    keyFn: (order: CostedWorkOrder) => string,
    labelKey: string
  ) {
    const orders = await this.loadCostedWorkOrders(actor, query);
    return this.paginate(this.buildGroupedCostReportSync(orders, keyFn, labelKey).rows, query);
  }

  private buildGroupedCostReportSync(
    orders: CostedWorkOrder[],
    keyFn: (order: CostedWorkOrder) => string,
    labelKey: string
  ) {
    const map = this.groupOrders(orders, keyFn);
    const rows = [...map.entries()]
      .map(([label, bucket]) => {
        const repeated = bucket.orders.filter((o) => o.isCorrective).length;
        const row = {
          [labelKey]: label,
          totalMaintenanceCost: Number(bucket.total.toFixed(2)),
          partsCost: Number(bucket.parts.toFixed(2)),
          vendorCost: Number(bucket.vendor.toFixed(2)),
          laborCost: Number(bucket.labor.toFixed(2)),
          workOrderCount: bucket.orders.length,
          repeatedBreakdownCount: repeated,
          downtimeHours: Number(bucket.downtime.toFixed(2)),
          highRiskCount: bucket.orders.filter((o) => o.totalMaintenanceCost >= 25_000).length,
          averageCostPerWorkOrder:
            bucket.orders.length > 0 ? Number((bucket.total / bucket.orders.length).toFixed(2)) : 0,
          lastRepairDate: bucket.orders[0]?.completedDate?.toISOString() ?? null,
          riskSeverity: riskSeverityFromCost(bucket.total, repeated),
          recommendedAction: recommendAction({
            totalCost: bucket.total,
            repeatedCount: repeated,
            downtimeHours: bucket.downtime,
            vendorCost: bucket.vendor,
            partsCost: bucket.parts
          }),
          repairVsReplaceReview: repairVsReplaceFlag({
            cost90Days: bucket.total,
            repeatedCount: repeated,
            downtimeHours: bucket.downtime
          })
        };
        return row;
      })
      .sort((a, b) => b.totalMaintenanceCost - a.totalMaintenanceCost);

    return {
      rows,
      totals: {
        totalMaintenanceCost: Number(this.sum(orders, (o) => o.totalMaintenanceCost).toFixed(2)),
        workOrderCount: orders.length
      }
    };
  }

  private buildTopEntities(orders: CostedWorkOrder[], entity: "asset" | "vehicle", limit: number) {
    const key = entity === "asset" ? "assetId" : "vehicleId";
    const nameKey = entity === "asset" ? "assetName" : "vehicleLabel";
    const map = new Map<string, CostedWorkOrder[]>();

    for (const order of orders) {
      const id = order[key];
      if (!id) continue;
      const list = map.get(id) ?? [];
      list.push(order);
      map.set(id, list);
    }

    return [...map.entries()]
      .map(([id, list], index) => {
        const total = this.sum(list, (o) => o.totalMaintenanceCost);
        const repeated = list.filter((o) => o.isCorrective).length;
        const downtime = this.sum(list, (o) => o.downtimeHours);
        const label = list[0]?.[nameKey] ?? id;
        return {
          rank: index + 1,
          id,
          label,
          departmentName: list[0]?.departmentName,
          branchName: list[0]?.branchName,
          totalMaintenanceCost: Number(total.toFixed(2)),
          partsCost: Number(this.sum(list, (o) => o.partsCost).toFixed(2)),
          vendorCost: Number(this.sum(list, (o) => o.vendorCost).toFixed(2)),
          laborCost: Number(this.sum(list, (o) => o.laborCost).toFixed(2)),
          workOrderCount: list.length,
          repeatedBreakdownCount: repeated,
          downtimeHours: Number(downtime.toFixed(2)),
          costPerKm:
            entity === "vehicle" && list[0]?.vehicleMileage
              ? Number((total / Math.max(list[0].vehicleMileage, 1)).toFixed(4))
              : null,
          lastRepairDate: list.find((o) => o.completedDate)?.completedDate?.toISOString() ?? null,
          riskSeverity: riskSeverityFromCost(total, repeated),
          recommendedAction: recommendAction({
            totalCost: total,
            repeatedCount: repeated,
            downtimeHours: downtime,
            vendorCost: this.sum(list, (o) => o.vendorCost),
            partsCost: this.sum(list, (o) => o.partsCost)
          }),
          repairVsReplaceReview: repairVsReplaceFlag({
            cost90Days: total,
            repeatedCount: repeated,
            downtimeHours: downtime,
            assetValue: list[0]?.assetValue,
            partsCost90Days: this.sum(list, (o) => o.partsCost)
          })
        };
      })
      .sort((a, b) => b.totalMaintenanceCost - a.totalMaintenanceCost)
      .slice(0, limit)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }

  private buildRepairVsReplaceRows(orders: CostedWorkOrder[]) {
    const assets = this.buildTopEntities(orders, "asset", 200);
    const vehicles = this.buildTopEntities(orders, "vehicle", 200);
    return [...assets, ...vehicles]
      .filter((row) => row.repairVsReplaceReview)
      .map((row) => ({
        entity: row.label,
        entityType: row.costPerKm !== null && row.costPerKm !== undefined ? "vehicle" : "asset",
        totalCost: row.totalMaintenanceCost,
        repeatedCount: row.repeatedBreakdownCount,
        downtimeHours: row.downtimeHours,
        lastRepairDate: row.lastRepairDate,
        riskSeverity: row.riskSeverity,
        recommendation: row.recommendedAction
      }));
  }

  private countRepeatedBreakdowns(orders: CostedWorkOrder[], windowDays: number) {
    const groups = new Map<string, CostedWorkOrder[]>();
    for (const order of orders.filter((o) => o.isCorrective || o.isAccident)) {
      const key = `${order.assetId ?? order.vehicleId ?? order.id}:${order.category}`;
      const list = groups.get(key) ?? [];
      list.push(order);
      groups.set(key, list);
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const [key, list] of groups.entries()) {
      const sorted = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      let repeats = 0;
      for (let i = 1; i < sorted.length; i += 1) {
        const days = (sorted[i].createdAt.getTime() - sorted[i - 1].createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (days <= windowDays) repeats += 1;
      }
      if (repeats === 0) continue;
      const total = this.sum(sorted, (o) => o.totalMaintenanceCost);
      rows.push({
        groupKey: key,
        assetOrVehicle: sorted[0].assetName ?? sorted[0].vehicleLabel ?? "Unknown",
        category: sorted[0].category,
        departmentName: sorted[0].departmentName,
        branchName: sorted[0].branchName,
        repeatedCount: repeats,
        totalCost: Number(total.toFixed(2)),
        downtimeHours: Number(this.sum(sorted, (o) => o.downtimeHours).toFixed(2)),
        lastOccurrence: sorted[sorted.length - 1].createdAt.toISOString(),
        recommendedAction: recommendAction({
          totalCost: total,
          repeatedCount: repeats,
          downtimeHours: this.sum(sorted, (o) => o.downtimeHours),
          vendorCost: this.sum(sorted, (o) => o.vendorCost),
          partsCost: this.sum(sorted, (o) => o.partsCost)
        })
      });
    }

    return rows.sort((a, b) => Number(b.totalCost) - Number(a.totalCost));
  }

  private buildMonthlyTrend(orders: CostedWorkOrder[]) {
    const map = new Map<string, { month: string; totalCost: number; partsCost: number; vendorCost: number; workOrderCount: number; correctiveCount: number }>();
    for (const order of orders) {
      const month = order.createdAt.toISOString().slice(0, 7);
      const current = map.get(month) ?? { month, totalCost: 0, partsCost: 0, vendorCost: 0, workOrderCount: 0, correctiveCount: 0 };
      current.totalCost += order.totalMaintenanceCost;
      current.partsCost += order.partsCost;
      current.vendorCost += order.vendorCost;
      current.workOrderCount += 1;
      if (order.isCorrective) current.correctiveCount += 1;
      map.set(month, current);
    }
    return [...map.values()]
      .map((row) => ({
        ...row,
        totalCost: Number(row.totalCost.toFixed(2)),
        partsCost: Number(row.partsCost.toFixed(2)),
        vendorCost: Number(row.vendorCost.toFixed(2))
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private groupOrders(orders: CostedWorkOrder[], keyFn: (order: CostedWorkOrder) => string) {
    const map = new Map<
      string,
      { total: number; parts: number; vendor: number; labor: number; downtime: number; orders: CostedWorkOrder[] }
    >();
    for (const order of orders) {
      const key = keyFn(order) || "Unassigned";
      const bucket = map.get(key) ?? { total: 0, parts: 0, vendor: 0, labor: 0, downtime: 0, orders: [] };
      bucket.total += order.totalMaintenanceCost;
      bucket.parts += order.partsCost;
      bucket.vendor += order.vendorCost;
      bucket.labor += order.laborCost;
      bucket.downtime += order.downtimeHours;
      bucket.orders.push(order);
      map.set(key, bucket);
    }
    return map;
  }

  private countHighCostEntities(orders: CostedWorkOrder[], entity: "asset" | "vehicle") {
    const key = entity === "asset" ? "assetId" : "vehicleId";
    const totals = new Map<string, number>();
    for (const order of orders) {
      const id = order[key];
      if (!id) continue;
      totals.set(id, (totals.get(id) ?? 0) + order.totalMaintenanceCost);
    }
    return [...totals.values()].filter((value) => value >= 25_000).length;
  }

  private paginate<T extends Record<string, unknown>>(rows: T[], query: ManagementReportQuery): PaginatedRows<T> {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? DEFAULT_PAGE_SIZE)));
    const start = (page - 1) * pageSize;
    const slice = rows.slice(start, start + pageSize);
    return {
      rows: slice,
      pagination: {
        page,
        pageSize,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize))
      },
      generatedAt: new Date().toISOString(),
      disclaimer: MANAGEMENT_INTELLIGENCE_DISCLAIMER,
      filtersApplied: this.filtersSnapshot(query),
      truncated: rows.length >= MAX_ROWS
    };
  }

  private resolveDateRange(query: ManagementReportQuery) {
    const endRaw = query.dateTo ?? query.endDate;
    const startRaw = query.dateFrom ?? query.startDate;
    const end = endRaw ? new Date(`${endRaw}T23:59:59.999Z`) : new Date();
    const start = startRaw
      ? new Date(`${startRaw}T00:00:00.000Z`)
      : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException("Invalid date range.");
    }
    return { start, end };
  }

  private previousPeriodRange(query: ManagementReportQuery) {
    const { start, end } = this.resolveDateRange(query);
    const duration = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { dateFrom: prevStart.toISOString().slice(0, 10), dateTo: prevEnd.toISOString().slice(0, 10) };
  }

  private trendLabel(current: number, previous: number) {
    if (previous <= 0) return "No prior period comparison";
    const delta = ((current - previous) / previous) * 100;
    return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs prior period`;
  }

  private filtersSnapshot(query: ManagementReportQuery) {
    return {
      dateFrom: query.dateFrom ?? query.startDate,
      dateTo: query.dateTo ?? query.endDate,
      branch: query.branch ?? query.branchId,
      departmentId: query.departmentId,
      assetId: query.assetId,
      vehicleId: query.vehicleId,
      technicianId: query.technicianId,
      vendorId: query.vendorId ?? query.supplierId
    };
  }

  private sum<T>(items: T[], picker: (item: T) => number) {
    return items.reduce((acc, item) => acc + picker(item), 0);
  }

  private async recordExportAudit(actor: Actor, reportKey: string, query: ManagementReportQuery) {
    const ctx = requestContext.get();
    await this.prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId ?? null,
        actorId: actor.sub,
        module: "management-intelligence",
        action: AuditAction.UPDATE,
        entity: "MANAGEMENT_REPORT",
        entityId: reportKey,
        reason: "report_exported",
        metadata: {
          event: "report_exported",
          reportType: reportKey,
          filters: this.filtersSnapshot(query),
          source: ctx?.requestPath ?? "API"
        }
      }
    });
  }
}
