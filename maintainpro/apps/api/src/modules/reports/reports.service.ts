import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { AuditAction, ExpenseCategory, Prisma, RoleName, WorkOrderStatus } from "@prisma/client";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import { PrismaService } from "../../database/prisma.service";
import { DriverIntelligenceService } from "../driver-intelligence/driver-intelligence.service";
import { VehiclesService } from "../vehicles/vehicles.service";

export type ReportModuleKey =
  | "operations"
  | "financials"
  | "user-activity"
  | "assets"
  | "inventory"
  | "performance"
  | "system-logs"
  | "driver-intelligence"
  | "fuel-analytics"
  | "vehicle-cost-analytics";

export type ReportExportFormat = "csv" | "xlsx" | "pdf";

export interface ReportQuery {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  departmentIds?: string[] | string;
  userId?: string;
  driverId?: string;
  assetId?: string;
  vehicleId?: string;
  status?: string;
  supplierId?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}

interface ReportActor {
  sub: string;
  email: string;
  role: RoleName;
  tenantId?: string | null;
}

interface DateRange {
  start: Date;
  end: Date;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ReportColumn {
  key: string;
  label: string;
  type?: "text" | "number" | "currency" | "date" | "datetime" | "percent";
}

interface ReportTable {
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  pagination: Pagination;
}

interface ReportChart {
  id: string;
  title: string;
  type: "line" | "bar" | "pie";
  data: Array<Record<string, string | number>>;
  xKey?: string;
  yKeys?: string[];
  nameKey?: string;
  valueKey?: string;
}

interface ReportSummaryCard {
  label: string;
  value: string | number;
  subLabel?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

export interface ReportFilterOptions {
  departments: Array<{ id: string; label: string }>;
  users: Array<{ id: string; label: string; role?: string }>;
  drivers: Array<{ id: string; label: string }>;
  vehicles: Array<{ id: string; label: string }>;
  assets: Array<{ id: string; label: string; type: "asset" | "vehicle" }>;
  suppliers: Array<{ id: string; label: string }>;
  statuses: string[];
  categories: string[];
}

export interface ReportModuleResponse {
  module: ReportModuleKey;
  title: string;
  description: string;
  generatedAt: string;
  refreshSeconds: number;
  filters: {
    startDate: string;
    endDate: string;
    departmentId?: string;
    departmentIds?: string[];
    userId?: string;
    driverId?: string;
    assetId?: string;
    vehicleId?: string;
    status?: string;
    supplierId?: string;
    category?: string;
    search?: string;
  };
  summaryCards: ReportSummaryCard[];
  charts: ReportChart[];
  table: ReportTable;
  insights: string[];
  filterOptions: ReportFilterOptions;
  coverageNotes: string[];
}

export interface ReportExportFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

const REPORT_TITLES: Record<ReportModuleKey, { title: string; description: string }> = {
  operations: {
    title: "Operations Reports",
    description: "Job volume, status, departmental throughput, technician output, and bottlenecks."
  },
  financials: {
    title: "Financial Reports",
    description: "Expenses, job costs, supplier spend, parts cost, and budget versus actual signals."
  },
  "user-activity": {
    title: "User Activity Reports",
    description: "Login recency, audit actions, role activity, record changes, and inactive users."
  },
  assets: {
    title: "Asset and Equipment Reports",
    description: "Maintenance history, breakdowns, downtime, costs, usage, and upcoming service alerts."
  },
  inventory: {
    title: "Inventory and Parts Reports",
    description: "Stock levels, low-stock risk, movement history, part usage, suppliers, and item velocity."
  },
  performance: {
    title: "Performance and KPI Reports",
    description: "Completion rate, response time, overdue percentage, department efficiency, and productivity."
  },
  "system-logs": {
    title: "System Logs and Audit Reports",
    description: "Audit history, security-sensitive changes, record mutations, and system coverage notes."
  },
  "driver-intelligence": {
    title: "Driver Intelligence Reports",
    description: "Driver scoring, risk levels, eligibility decisions, supervisor review, and linked operational signals."
  },
  "fuel-analytics": {
    title: "Fuel Analytics Reports",
    description: "Fuel cost, usage efficiency, anomaly flags, and consumption trends by vehicle and driver filter."
  },
  "vehicle-cost-analytics": {
    title: "Vehicle Cost Analytics Reports",
    description: "Net vehicle cost, fuel, maintenance, accident impact, fines, and insurance recovery trends."
  }
};

const MODULES = Object.keys(REPORT_TITLES) as ReportModuleKey[];
const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 100;
const REFRESH_SECONDS = 60;
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly driverIntelligenceService: DriverIntelligenceService,
    private readonly vehiclesService: VehiclesService
  ) {}

  async options(actor: ReportActor): Promise<ReportFilterOptions> {
    return this.getFilterOptions(actor.tenantId ?? null);
  }

  async dashboard(actor: ReportActor, query: ReportQuery = {}) {
    const range = this.resolveDateRange(query);
    const tenantId = actor.tenantId ?? null;
    const [operations, financials, inventory, assets, audits, filterOptions, driverDashboard] = await Promise.all([
      this.prisma.workOrder.findMany({
        where: this.workOrderWhere(tenantId, range, query),
        select: {
          id: true,
          status: true,
          dueDate: true,
          completedDate: true,
          createdAt: true,
          actualCost: true,
          estimatedCost: true
        }
      }),
      this.getFinancialTransactions(tenantId, range, query),
      this.prisma.sparePart.findMany({
        where: this.sparePartWhere(tenantId, query),
        select: {
          id: true,
          quantityInStock: true,
          minimumStock: true,
          reorderPoint: true,
          unitCost: true,
          isActive: true
        }
      }),
      Promise.all([
        this.prisma.asset.count({ where: this.assetWhere(tenantId, query) }),
        this.prisma.vehicle.count({ where: this.vehicleWhere(tenantId, query) }),
        this.prisma.maintenanceSchedule.findMany({
          where: this.maintenanceScheduleWhere(tenantId, query, true),
          select: { id: true, name: true, nextDueDate: true },
          orderBy: { nextDueDate: "asc" },
          take: 5
        })
      ]),
      this.prisma.auditLog.findMany({
        where: this.auditWhere(tenantId, range, query),
        include: { actor: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 6
      }),
      this.getFilterOptions(tenantId),
      this.driverIntelligenceService.dashboard(actor, {
        startDate: this.isoDate(range.start) ?? undefined,
        endDate: this.isoDate(range.end) ?? undefined,
        departmentId: query.departmentId,
        driverId: query.driverId,
        vehicleId: query.vehicleId,
        status: query.status
      })
    ]);

    const now = new Date();
    const totalJobs = operations.length;
    const completed = operations.filter((item) => item.status === WorkOrderStatus.COMPLETED).length;
    const overdue = operations.filter((item) => this.isWorkOrderOverdue(item, now)).length;
    const totalExpenses = financials.reduce((sum, item) => sum + item.amount, 0);
    const stockValue = inventory.reduce((sum, part) => sum + part.quantityInStock * part.unitCost, 0);
    const lowStock = inventory.filter((part) => part.isActive && part.quantityInStock <= Math.max(part.minimumStock, part.reorderPoint)).length;
    const [assetCount, vehicleCount, upcomingMaintenance] = assets;

    const moduleSummaries = [
      {
        module: "operations",
        label: "Operations",
        value: totalJobs,
        helper: `${completed} completed, ${overdue} overdue`,
        tone: overdue > 0 ? "warning" : "success"
      },
      {
        module: "financials",
        label: "Financials",
        value: this.formatCurrency(totalExpenses),
        helper: `${financials.length} cost records in range`,
        tone: totalExpenses > 0 ? "info" : "neutral"
      },
      {
        module: "assets",
        label: "Assets & Equipment",
        value: assetCount + vehicleCount,
        helper: `${upcomingMaintenance.length} upcoming maintenance alerts`,
        tone: upcomingMaintenance.length > 0 ? "warning" : "success"
      },
      {
        module: "inventory",
        label: "Inventory",
        value: this.formatCurrency(stockValue),
        helper: `${lowStock} low-stock items`,
        tone: lowStock > 0 ? "danger" : "success"
      },
      {
        module: "driver-intelligence",
        label: "Driver Intelligence",
        value: driverDashboard.summaryCards.find((item) => item.label === "Average driver score")?.value ?? 0,
        helper: `${driverDashboard.riskDistribution
          .filter((item) => item.level === "HIGH" || item.level === "CRITICAL")
          .reduce((sum, item) => sum + item.count, 0)} high-risk drivers`,
        tone: driverDashboard.riskDistribution.some((item) => (item.level === "HIGH" || item.level === "CRITICAL") && item.count > 0)
          ? "warning"
          : "success"
      },
      {
        module: "fuel-analytics",
        label: "Fuel Analytics",
        value: driverDashboard.fuelInsights.abnormalUsageCount,
        helper: "Abnormal usage events flagged for review",
        tone: driverDashboard.fuelInsights.abnormalUsageCount > 0 ? "warning" : "success"
      },
      {
        module: "vehicle-cost-analytics",
        label: "Vehicle Costs",
        value: this.formatCurrency(driverDashboard.fleetCostSummary.breakdown.netCost),
        helper: "Net fleet cost in selected range",
        tone: "info"
      }
    ];

    return {
      generatedAt: new Date().toISOString(),
      refreshSeconds: REFRESH_SECONDS,
      filters: this.publicFilters(range, query),
      summaryCards: [
        { label: "Total Jobs", value: totalJobs, subLabel: "All work orders in range", tone: "info" },
        {
          label: "Completion Rate",
          value: this.formatPercent(this.safeRatio(completed, totalJobs)),
          subLabel: `${completed} completed`,
          tone: completed >= totalJobs && totalJobs > 0 ? "success" : "neutral"
        },
        { label: "Total Expenses", value: this.formatCurrency(totalExpenses), subLabel: "Jobs, parts, utilities, POs, farm costs", tone: "info" },
        { label: "Low Stock", value: lowStock, subLabel: "At or below threshold", tone: lowStock > 0 ? "danger" : "success" },
        {
          label: "High Risk Drivers",
          value: driverDashboard.riskDistribution
            .filter((item) => item.level === "HIGH" || item.level === "CRITICAL")
            .reduce((sum, item) => sum + item.count, 0),
          subLabel: "Driver intelligence score below threshold or with material incidents",
          tone: driverDashboard.riskDistribution.some((item) => (item.level === "HIGH" || item.level === "CRITICAL") && item.count > 0)
            ? "warning"
            : "success"
        },
        {
          label: "Eligible Drivers",
          value: driverDashboard.summaryCards.find((item) => item.label === "Eligible for new vehicle")?.value ?? 0,
          subLabel: "Ready for new vehicle assignment",
          tone: "info"
        }
      ],
      moduleSummaries,
      crossModuleTrend: this.buildMonthlyTrend(financials.map((item) => ({ date: item.date, value: item.amount })), range, "expense"),
      filterOptions,
      alerts: [
        ...operations
          .filter((item) => this.isWorkOrderOverdue(item, now))
          .slice(0, 4)
          .map((item) => ({ type: "Overdue job", message: `Work order ${item.id} is past due.`, tone: "danger" })),
        ...upcomingMaintenance.map((item) => ({
          type: "Upcoming maintenance",
          message: `${item.name} due ${item.nextDueDate ? this.formatDate(item.nextDueDate) : "soon"}`,
          tone: "warning"
        })),
        ...audits.slice(0, 3).map((item) => ({
          type: "Recent audit",
          message: `${item.action} ${item.entity} by ${this.userLabel(item.actor)}`,
          tone: "neutral"
        })),
        ...driverDashboard.alerts.slice(0, 4)
      ],
      dataCoverage: this.systemCoverageNotes()
    };
  }

  async moduleReport(actor: ReportActor, module: ReportModuleKey, query: ReportQuery = {}): Promise<ReportModuleResponse> {
    this.assertModule(module);
    this.assertModuleAccess(actor, module);

    switch (module) {
      case "operations":
        return this.operationsReport(actor, query);
      case "financials":
        return this.financialReport(actor, query);
      case "user-activity":
        return this.userActivityReport(actor, query);
      case "assets":
        return this.assetsReport(actor, query);
      case "inventory":
        return this.inventoryReport(actor, query);
      case "performance":
        return this.performanceReport(actor, query);
      case "system-logs":
        return this.systemLogsReport(actor, query);
      case "driver-intelligence":
        return this.driverIntelligenceReport(actor, query);
      case "fuel-analytics":
        return this.fuelAnalyticsReport(actor, query);
      case "vehicle-cost-analytics":
        return this.vehicleCostAnalyticsReport(actor, query);
      default:
        return this.operationsReport(actor, query);
    }
  }

  async exportModule(actor: ReportActor, module: ReportModuleKey, format: ReportExportFormat, query: ReportQuery = {}): Promise<ReportExportFile> {
    const report = await this.moduleReport(actor, module, { ...query, page: 1, pageSize: MAX_PAGE_SIZE });
    const basename = `${module}-report-${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      return {
        buffer: this.toCsvBuffer(report.table.columns, report.table.rows),
        contentType: "text/csv; charset=utf-8",
        filename: `${basename}.csv`
      };
    }

    if (format === "xlsx") {
      return {
        buffer: await this.toXlsxBuffer(report),
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `${basename}.xlsx`
      };
    }

    return {
      buffer: await this.toPdfBuffer(report),
      contentType: "application/pdf",
      filename: `${basename}.pdf`
    };
  }

  async maintenanceCost(actor?: ReportActor) {
    const report = await this.financialReport(actor ?? { sub: "system", email: "system@local", role: "SUPER_ADMIN" }, {});
    return report;
  }

  async fleetEfficiency(actor?: ReportActor) {
    const report = await this.assetsReport(actor ?? { sub: "system", email: "system@local", role: "SUPER_ADMIN" }, {});
    return report;
  }

  async downtime(actor?: ReportActor) {
    const report = await this.assetsReport(actor ?? { sub: "system", email: "system@local", role: "SUPER_ADMIN" }, {});
    return report;
  }

  async workOrders(actor?: ReportActor) {
    const report = await this.operationsReport(actor ?? { sub: "system", email: "system@local", role: "SUPER_ADMIN" }, {});
    return report;
  }

  async inventory(actor?: ReportActor) {
    const report = await this.inventoryReport(actor ?? { sub: "system", email: "system@local", role: "SUPER_ADMIN" }, {});
    return report;
  }

  async utilities(actor?: ReportActor) {
    const report = await this.financialReport(actor ?? { sub: "system", email: "system@local", role: "SUPER_ADMIN" }, { category: "Utilities" });
    return report;
  }

  private async driverIntelligenceReport(actor: ReportActor, query: ReportQuery): Promise<ReportModuleResponse> {
    const range = this.resolveDateRange(query);
    const pagination = this.resolvePagination(query);
    const filterOptions = await this.getFilterOptions(actor.tenantId ?? null);
    const list = await this.driverIntelligenceService.listDrivers(actor, {
      startDate: this.isoDate(range.start) ?? undefined,
      endDate: this.isoDate(range.end) ?? undefined,
      departmentId: query.departmentId,
      driverId: query.driverId,
      vehicleId: query.vehicleId,
      search: query.search,
      sortBy:
        query.sortBy === "name" || query.sortBy === "riskLevel" || query.sortBy === "eligibility"
          ? query.sortBy
          : "score",
      sortDirection: query.sortDirection,
      page: 1,
      pageSize: MAX_PAGE_SIZE
    });

    let rows = list.items;
    if (query.status) {
      const status = query.status.toUpperCase();
      rows = rows.filter((item) => {
        if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(status)) {
          return item.riskLevel === status;
        }
        if (status === "ELIGIBLE") {
          return item.eligibleForNewVehicle;
        }
        if (status === "INELIGIBLE") {
          return !item.eligibleForNewVehicle;
        }
        return true;
      });
    }

    const total = rows.length;
    const pageRows = rows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
    const averageScore = rows.length > 0 ? Math.round(rows.reduce((sum, item) => sum + item.driverScore, 0) / rows.length) : 0;
    const highRiskCount = rows.filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL").length;
    const eligibleCount = rows.filter((item) => item.eligibleForNewVehicle).length;

    return this.composeReport({
      actor,
      module: "driver-intelligence",
      range,
      query,
      summaryCards: [
        { label: "Drivers in scope", value: total, subLabel: "After report filters", tone: "info" },
        { label: "Average driver score", value: averageScore, subLabel: "Weighted intelligence score", tone: averageScore >= 85 ? "success" : averageScore >= 70 ? "warning" : "danger" },
        { label: "High risk drivers", value: highRiskCount, subLabel: "High or critical risk level", tone: highRiskCount > 0 ? "warning" : "success" },
        { label: "Eligible for new vehicle", value: eligibleCount, subLabel: `${total - eligibleCount} require review`, tone: eligibleCount === total ? "success" : "info" }
      ],
      charts: [
        {
          id: "driver-risk-distribution",
          title: "Driver Risk Distribution",
          type: "pie",
          data: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((level) => ({
            level,
            count: rows.filter((item) => item.riskLevel === level).length
          })),
          nameKey: "level",
          valueKey: "count"
        },
        {
          id: "top-driver-scores",
          title: "Top Driver Scores",
          type: "bar",
          data: [...rows]
            .sort((left, right) => right.driverScore - left.driverScore)
            .slice(0, 10)
            .map((item) => ({ name: item.displayName, score: item.driverScore })),
          xKey: "name",
          yKeys: ["score"]
        }
      ],
      table: {
        columns: [
          { key: "name", label: "Driver" },
          { key: "department", label: "Department" },
          { key: "driverScore", label: "Driver Score", type: "number" },
          { key: "riskLevel", label: "Risk Level" },
          { key: "eligible", label: "Eligible" },
          { key: "trainingStatus", label: "Training" },
          { key: "supervisorReviewScore", label: "Supervisor Review", type: "number" },
          { key: "vehicleCareScore", label: "Vehicle Care", type: "number" },
          { key: "driverFaultAccidents", label: "Driver-Fault Accidents", type: "number" },
          { key: "driverRelatedFines", label: "Driver-Related Fines", type: "number" },
          { key: "abnormalFuelUsageCount", label: "Fuel Flags", type: "number" },
          { key: "licenseExpiry", label: "License Expiry", type: "date" }
        ],
        rows: pageRows.map((item) => ({
          name: item.displayName,
          department: item.department,
          driverScore: item.driverScore,
          riskLevel: item.riskLevel,
          eligible: item.eligibleForNewVehicle ? "Yes" : "No",
          trainingStatus: item.inputs.trainingStatus,
          supervisorReviewScore: item.inputs.supervisorReviewScore ?? null,
          vehicleCareScore: item.components.vehicleCareScore,
          driverFaultAccidents: item.summary.driverFaultAccidents,
          driverRelatedFines: item.summary.driverRelatedFines,
          abnormalFuelUsageCount: item.summary.abnormalFuelUsageCount,
          licenseExpiry: item.license.expiry
        })),
        pagination: this.paginationMeta(pagination, total)
      },
      insights: [
        `${highRiskCount} driver(s) are currently high or critical risk in the selected scope.`,
        `${eligibleCount} driver(s) meet the current new vehicle eligibility rule set.`,
        "Driver scores blend accident responsibility, fine responsibility, vehicle care, trip reliability, fuel behavior, compliance readiness, and supervisor review inputs."
      ],
      filterOptions,
      coverageNotes: [
        ...this.systemCoverageNotes(),
        "Eligibility uses license validity, risk level, serious driver-related fines, driver-fault accidents, disciplinary issues, and vehicle care score."
      ]
    });
  }

  private async fuelAnalyticsReport(actor: ReportActor, query: ReportQuery): Promise<ReportModuleResponse> {
    const range = this.resolveDateRange(query);
    const pagination = this.resolvePagination(query);
    const filterOptions = await this.getFilterOptions(actor.tenantId ?? null);
    const departmentCondition = this.departmentIdCondition(query);
    const vehicleWhere: Prisma.VehicleWhereInput = {
      ...this.tenantWhere(actor.tenantId ?? null),
      ...(query.vehicleId ? { id: query.vehicleId } : {}),
      ...(query.driverId ? { driverId: query.driverId } : {}),
      ...(departmentCondition ? { departmentId: departmentCondition } : {})
    };

    const vehicles = await this.prisma.vehicle.findMany({
      where: vehicleWhere,
      select: {
        id: true,
        registrationNo: true,
        vehicleModel: true,
        status: true,
        department: { select: { name: true } },
        driver: { select: { user: { select: { firstName: true, lastName: true, email: true } } } }
      },
      orderBy: { registrationNo: "asc" },
      take: 200
    });

    const analyticsRows = await Promise.all(
      vehicles.map(async (vehicle) => ({
        vehicle,
        analytics: await this.vehiclesService.fuelAnalytics(vehicle.id, {
          startDate: range.start,
          endDate: range.end,
          driverId: query.driverId
        })
      }))
    );

    let rows = analyticsRows.map(({ vehicle, analytics }) => ({
      id: vehicle.id,
      registrationNo: vehicle.registrationNo,
      vehicleModel: vehicle.vehicleModel,
      department: vehicle.department?.name ?? null,
      driver: this.userLabel(vehicle.driver?.user),
      vehicleStatus: vehicle.status,
      totalLiters: Math.round(Number(analytics.totalLiters ?? 0) * 100) / 100,
      totalCost: Math.round(Number(analytics.totalCost ?? 0) * 100) / 100,
      avgCostPerLiter: Math.round(Number(analytics.avgCostPerLiter ?? 0) * 100) / 100,
      avgConsumption: Math.round(Number(analytics.averageConsumptionLPer100Km ?? analytics.avgConsumption ?? 0) * 100) / 100,
      costPerKm: Math.round(Number(analytics.costPerKm ?? 0) * 100) / 100,
      abnormalUsageCount: Number(analytics.abnormalUsageCount ?? 0),
      monthlyFuelCostTrend: analytics.monthlyFuelCostTrend as Array<{ month: string; totalCost: number; liters?: number }>
    }));

    if (query.status) {
      const status = query.status.toUpperCase();
      rows = rows.filter((item) => {
        if (status === "ANOMALOUS") {
          return item.abnormalUsageCount > 0;
        }
        if (status === "NORMAL") {
          return item.abnormalUsageCount === 0;
        }
        return item.vehicleStatus === query.status;
      });
    }

    const total = rows.length;
    const pageRows = rows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
    const monthlyTrend = new Map<string, { totalCost: number; liters: number }>();
    for (const row of rows) {
      for (const item of row.monthlyFuelCostTrend) {
        const current = monthlyTrend.get(item.month) ?? { totalCost: 0, liters: 0 };
        current.totalCost += Number(item.totalCost ?? 0);
        current.liters += Number(item.liters ?? 0);
        monthlyTrend.set(item.month, current);
      }
    }

    const totalFuelCost = rows.reduce((sum, item) => sum + item.totalCost, 0);
    const totalLiters = rows.reduce((sum, item) => sum + item.totalLiters, 0);
    const averageConsumption = rows.length > 0 ? rows.reduce((sum, item) => sum + item.avgConsumption, 0) / rows.length : 0;
    const abnormalVehicles = rows.filter((item) => item.abnormalUsageCount > 0).length;

    return this.composeReport({
      actor,
      module: "fuel-analytics",
      range,
      query,
      summaryCards: [
        { label: "Vehicles analyzed", value: total, subLabel: "After report filters", tone: "info" },
        { label: "Fuel cost", value: this.formatCurrency(totalFuelCost), subLabel: `${Math.round(totalLiters * 100) / 100} liters logged`, tone: "info" },
        { label: "Average consumption", value: `${averageConsumption.toFixed(1)} L/100km`, subLabel: "Average across scoped vehicles", tone: averageConsumption <= 10 ? "success" : averageConsumption <= 13 ? "warning" : "danger" },
        { label: "Abnormal vehicles", value: abnormalVehicles, subLabel: "Flagged for review only", tone: abnormalVehicles > 0 ? "warning" : "success" }
      ],
      charts: [
        {
          id: "fuel-cost-trend",
          title: "Fuel Cost Trend",
          type: "line",
          data: [...monthlyTrend.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([period, value]) => ({ period, totalCost: Math.round(value.totalCost * 100) / 100 })),
          xKey: "period",
          yKeys: ["totalCost"]
        },
        {
          id: "fuel-cost-by-vehicle",
          title: "Highest Fuel Cost Vehicles",
          type: "bar",
          data: [...rows]
            .sort((left, right) => right.totalCost - left.totalCost)
            .slice(0, 10)
            .map((item) => ({ vehicle: item.registrationNo, totalCost: item.totalCost })),
          xKey: "vehicle",
          yKeys: ["totalCost"]
        }
      ],
      table: {
        columns: [
          { key: "registrationNo", label: "Vehicle" },
          { key: "vehicleModel", label: "Model" },
          { key: "department", label: "Department" },
          { key: "driver", label: "Assigned Driver" },
          { key: "vehicleStatus", label: "Vehicle Status" },
          { key: "totalLiters", label: "Liters", type: "number" },
          { key: "totalCost", label: "Fuel Cost", type: "currency" },
          { key: "avgCostPerLiter", label: "Avg Cost/L", type: "currency" },
          { key: "avgConsumption", label: "Avg Consumption", type: "number" },
          { key: "costPerKm", label: "Cost/Km", type: "currency" },
          { key: "abnormalUsageCount", label: "Fuel Flags", type: "number" }
        ],
        rows: pageRows.map((item) => ({
          registrationNo: item.registrationNo,
          vehicleModel: item.vehicleModel,
          department: item.department,
          driver: item.driver,
          vehicleStatus: item.vehicleStatus,
          totalLiters: item.totalLiters,
          totalCost: item.totalCost,
          avgCostPerLiter: item.avgCostPerLiter,
          avgConsumption: item.avgConsumption,
          costPerKm: item.costPerKm,
          abnormalUsageCount: item.abnormalUsageCount
        })),
        pagination: this.paginationMeta(pagination, total)
      },
      insights: [
        `${abnormalVehicles} vehicle(s) show abnormal fuel behavior in the selected range.`,
        `Fuel analytics currently summarize ${Math.round(totalLiters * 100) / 100} liters across scoped vehicles.`,
        "Abnormal usage is a review signal and is not automatically treated as driver fault without supporting evidence."
      ],
      filterOptions,
      coverageNotes: [
        ...this.systemCoverageNotes(),
        "Fuel analytics use logged liters, cost, mileage progression, and anomaly thresholds derived from historical usage intervals."
      ]
    });
  }

  private async vehicleCostAnalyticsReport(actor: ReportActor, query: ReportQuery): Promise<ReportModuleResponse> {
    const range = this.resolveDateRange(query);
    const pagination = this.resolvePagination(query);
    const filterOptions = await this.getFilterOptions(actor.tenantId ?? null);
    const departmentCondition = this.departmentIdCondition(query);
    const vehicleWhere: Prisma.VehicleWhereInput = {
      ...this.tenantWhere(actor.tenantId ?? null),
      ...(query.vehicleId ? { id: query.vehicleId } : {}),
      ...(query.driverId ? { driverId: query.driverId } : {}),
      ...(departmentCondition ? { departmentId: departmentCondition } : {}),
      ...(query.status ? { status: query.status as any } : {})
    };

    const vehicles = await this.prisma.vehicle.findMany({
      where: vehicleWhere,
      select: {
        id: true,
        registrationNo: true,
        vehicleModel: true,
        status: true,
        complianceStatus: true,
        serviceStatus: true,
        department: { select: { name: true } }
      },
      orderBy: { registrationNo: "asc" },
      take: 200
    });

    const costRows = await Promise.all(
      vehicles.map(async (vehicle) => {
        const summary = await this.driverIntelligenceService.vehicleCostSummary(actor, vehicle.id, {
          startDate: this.isoDate(range.start) ?? undefined,
          endDate: this.isoDate(range.end) ?? undefined
        });
        return {
          id: vehicle.id,
          registrationNo: vehicle.registrationNo,
          vehicleModel: vehicle.vehicleModel,
          department: vehicle.department?.name ?? null,
          vehicleStatus: vehicle.status,
          complianceStatus: vehicle.complianceStatus,
          serviceStatus: vehicle.serviceStatus,
          breakdown: summary.breakdown,
          monthlyTrend: summary.monthlyTrend
        };
      })
    );

    const total = costRows.length;
    const pageRows = costRows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
    const totalNetCost = costRows.reduce((sum, item) => sum + Number(item.breakdown.netCost ?? 0), 0);
    const totalInsuranceRecovery = costRows.reduce((sum, item) => sum + Number(item.breakdown.insuranceRecovery ?? 0), 0);
    const highestCostVehicle = [...costRows].sort((left, right) => Number(right.breakdown.netCost) - Number(left.breakdown.netCost))[0];
    const monthlyTrend = new Map<string, { fuelCost: number; maintenanceCost: number; accidentCost: number; fineCost: number; insuranceRecovery: number; netCost: number }>();
    for (const row of costRows) {
      for (const item of row.monthlyTrend) {
        const current = monthlyTrend.get(item.period) ?? {
          fuelCost: 0,
          maintenanceCost: 0,
          accidentCost: 0,
          fineCost: 0,
          insuranceRecovery: 0,
          netCost: 0
        };
        current.fuelCost += Number(item.fuelCost ?? 0);
        current.maintenanceCost += Number(item.maintenanceCost ?? 0);
        current.accidentCost += Number(item.accidentCost ?? 0);
        current.fineCost += Number(item.fineCost ?? 0);
        current.insuranceRecovery += Number(item.insuranceRecovery ?? 0);
        current.netCost += Number(item.netCost ?? 0);
        monthlyTrend.set(item.period, current);
      }
    }

    return this.composeReport({
      actor,
      module: "vehicle-cost-analytics",
      range,
      query,
      summaryCards: [
        { label: "Vehicles in scope", value: total, subLabel: "After report filters", tone: "info" },
        { label: "Net vehicle cost", value: this.formatCurrency(totalNetCost), subLabel: "Fuel + maintenance + accidents + fines - insurance", tone: "info" },
        { label: "Insurance recovery", value: this.formatCurrency(totalInsuranceRecovery), subLabel: "Approved claims in range", tone: totalInsuranceRecovery > 0 ? "success" : "neutral" },
        { label: "Highest cost vehicle", value: highestCostVehicle?.registrationNo ?? "-", subLabel: highestCostVehicle ? this.formatCurrency(Number(highestCostVehicle.breakdown.netCost ?? 0)) : "No cost data", tone: highestCostVehicle ? "warning" : "neutral" }
      ],
      charts: [
        {
          id: "vehicle-cost-trend",
          title: "Net Vehicle Cost Trend",
          type: "line",
          data: [...monthlyTrend.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([period, value]) => ({ period, netCost: Math.round(value.netCost * 100) / 100 })),
          xKey: "period",
          yKeys: ["netCost"]
        },
        {
          id: "top-cost-vehicles",
          title: "Highest Cost Vehicles",
          type: "bar",
          data: [...costRows]
            .sort((left, right) => Number(right.breakdown.netCost) - Number(left.breakdown.netCost))
            .slice(0, 10)
            .map((item) => ({ vehicle: item.registrationNo, netCost: Number(item.breakdown.netCost) })),
          xKey: "vehicle",
          yKeys: ["netCost"]
        }
      ],
      table: {
        columns: [
          { key: "registrationNo", label: "Vehicle" },
          { key: "vehicleModel", label: "Model" },
          { key: "department", label: "Department" },
          { key: "vehicleStatus", label: "Status" },
          { key: "complianceStatus", label: "Compliance" },
          { key: "serviceStatus", label: "Service" },
          { key: "fuelCost", label: "Fuel Cost", type: "currency" },
          { key: "maintenanceCost", label: "Maintenance Cost", type: "currency" },
          { key: "accidentCost", label: "Accident Cost", type: "currency" },
          { key: "fineCost", label: "Fine Cost", type: "currency" },
          { key: "insuranceRecovery", label: "Insurance Recovery", type: "currency" },
          { key: "netCost", label: "Net Cost", type: "currency" }
        ],
        rows: pageRows.map((item) => ({
          registrationNo: item.registrationNo,
          vehicleModel: item.vehicleModel,
          department: item.department,
          vehicleStatus: item.vehicleStatus,
          complianceStatus: item.complianceStatus,
          serviceStatus: item.serviceStatus,
          fuelCost: Number(item.breakdown.fuelCost ?? 0),
          maintenanceCost: Number(item.breakdown.maintenanceCost ?? 0),
          accidentCost: Number(item.breakdown.accidentCost ?? 0),
          fineCost: Number(item.breakdown.fineCost ?? 0),
          insuranceRecovery: Number(item.breakdown.insuranceRecovery ?? 0),
          netCost: Number(item.breakdown.netCost ?? 0)
        })),
        pagination: this.paginationMeta(pagination, total)
      },
      insights: [
        `${total} vehicle(s) contribute ${this.formatCurrency(totalNetCost)} of net cost in the selected range.`,
        highestCostVehicle
          ? `${highestCostVehicle.registrationNo} is currently the highest net-cost vehicle at ${this.formatCurrency(Number(highestCostVehicle.breakdown.netCost ?? 0))}.`
          : "No vehicle cost data matched the current filters.",
        "Vehicle cost analytics combine fuel logs, work orders, maintenance logs, accident damage, traffic fines, and approved insurance recoveries."
      ],
      filterOptions,
      coverageNotes: [
        ...this.systemCoverageNotes(),
        "Current cost attribution is vehicle-centric and uses current assignment links where driver filtering is applied."
      ]
    });
  }

  private async operationsReport(actor: ReportActor, query: ReportQuery): Promise<ReportModuleResponse> {
    const range = this.resolveDateRange(query);
    const tenantId = actor.tenantId ?? null;
    const where = this.workOrderWhere(tenantId, range, query);
    const pagination = this.resolvePagination(query);
    const orderBy = this.workOrderOrderBy(query);

    const [allOrders, pageRows, total, filterOptions] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        include: {
          asset: { select: { id: true, name: true, assetTag: true, departmentId: true, departmentRef: { select: { name: true } } } },
          vehicle: { select: { id: true, registrationNo: true, vehicleModel: true, departmentId: true, department: { select: { name: true } } } },
          technician: { select: { id: true, firstName: true, lastName: true, email: true, departmentId: true, department: { select: { name: true } } } },
          parts: { select: { totalCost: true } }
        }
      }),
      this.prisma.workOrder.findMany({
        where,
        include: {
          asset: { select: { name: true, assetTag: true, departmentRef: { select: { name: true } } } },
          vehicle: { select: { registrationNo: true, vehicleModel: true, department: { select: { name: true } } } },
          technician: { select: { firstName: true, lastName: true, email: true, department: { select: { name: true } } } }
        },
        orderBy,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize
      }),
      this.prisma.workOrder.count({ where }),
      this.getFilterOptions(tenantId)
    ]);

    const now = new Date();
    const totalJobs = allOrders.length;
    const completed = allOrders.filter((item) => item.status === WorkOrderStatus.COMPLETED).length;
    const cancelled = allOrders.filter((item) => item.status === WorkOrderStatus.CANCELLED).length;
    const pendingStatuses: WorkOrderStatus[] = [WorkOrderStatus.OPEN, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD];
    const pending = allOrders.filter((item) => pendingStatuses.includes(item.status)).length;
    const overdue = allOrders.filter((item) => this.isWorkOrderOverdue(item, now)).length;
    const avgCompletionHours = this.average(
      allOrders
        .filter((item) => item.completedDate)
        .map((item) => this.hoursBetween(item.createdAt, item.completedDate ?? item.createdAt))
    );
    const statusBreakdown = this.countBy(allOrders, (item) => item.status);
    const priorityBreakdown = this.countBy(allOrders, (item) => item.priority);
    const departmentSummary = this.summarizeByDepartment(allOrders);
    const technicianSummary = this.summarizeByTechnician(allOrders);
    const trends = this.buildMonthlyTrend(allOrders.map((item) => ({ date: item.createdAt, value: 1 })), range, "jobs");

    return this.composeReport({
      actor,
      module: "operations",
      range,
      query,
      summaryCards: [
        { label: "Total Jobs", value: totalJobs, subLabel: "Created in selected range", tone: "info" },
        { label: "Pending", value: pending, subLabel: "Open, in progress, on hold", tone: pending > 0 ? "warning" : "success" },
        { label: "Completed", value: completed, subLabel: `${this.formatPercent(this.safeRatio(completed, totalJobs))} completion rate`, tone: "success" },
        { label: "Overdue", value: overdue, subLabel: `${cancelled} cancelled`, tone: overdue > 0 ? "danger" : "neutral" },
        { label: "Avg Completion", value: `${avgCompletionHours.toFixed(1)}h`, subLabel: "Created to completed", tone: "neutral" }
      ],
      charts: [
        { id: "date-trend", title: "Date-wise Job Trends", type: "line", data: trends, xKey: "period", yKeys: ["jobs"] },
        { id: "status-breakdown", title: "Job Status Breakdown", type: "pie", data: this.mapToChart(statusBreakdown), nameKey: "name", valueKey: "value" },
        { id: "department-summary", title: "Department-wise Job Summary", type: "bar", data: departmentSummary.slice(0, 8), xKey: "department", yKeys: ["total", "completed", "overdue"] },
        { id: "priority-breakdown", title: "Priority Breakdown", type: "bar", data: this.mapToChart(priorityBreakdown), xKey: "name", yKeys: ["value"] }
      ],
      table: {
        columns: [
          { key: "woNumber", label: "WO Number" },
          { key: "title", label: "Title" },
          { key: "status", label: "Status" },
          { key: "priority", label: "Priority" },
          { key: "department", label: "Department" },
          { key: "technician", label: "Technician" },
          { key: "dueDate", label: "Due Date", type: "date" },
          { key: "completionHours", label: "Completion Hours", type: "number" },
          { key: "actualCost", label: "Actual Cost", type: "currency" }
        ],
        rows: pageRows.map((item) => ({
          woNumber: item.woNumber,
          title: item.title,
          status: item.status,
          priority: item.priority,
          department: this.departmentLabel(item),
          technician: this.userLabel(item.technician),
          dueDate: this.isoDate(item.dueDate),
          completionHours: item.completedDate ? Number(this.hoursBetween(item.createdAt, item.completedDate).toFixed(1)) : null,
          actualCost: item.actualCost ?? 0
        })),
        pagination: this.paginationMeta(pagination, total)
      },
      insights: [
        `${pending} jobs still need action across open, in-progress, and on-hold states.`,
        overdue > 0 ? `${overdue} jobs are overdue and should be reviewed for SLA or staffing blockers.` : "No overdue jobs detected in this filter range.",
        technicianSummary[0] ? `${technicianSummary[0].technician} has the highest assigned workload in the current view.` : "No technician workload data is available for this range."
      ],
      filterOptions,
      coverageNotes: []
    });
  }

  private async financialReport(actor: ReportActor, query: ReportQuery): Promise<ReportModuleResponse> {
    const range = this.resolveDateRange(query);
    const tenantId = actor.tenantId ?? null;
    const pagination = this.resolvePagination(query);
    const [transactions, workOrders, filterOptions] = await Promise.all([
      this.getFinancialTransactions(tenantId, range, query),
      this.prisma.workOrder.findMany({
        where: this.workOrderWhere(tenantId, range, query),
        include: {
          asset: { select: { departmentId: true, department: true, departmentRef: { select: { name: true } } } },
          vehicle: { select: { departmentId: true, department: { select: { name: true } } } },
          technician: { select: { departmentId: true, department: { select: { name: true } } } },
          parts: { include: { part: { include: { supplier: true } } } }
        }
      }),
      this.getFilterOptions(tenantId)
    ]);

    const sorted = this.sortRows(transactions, query.sortBy ?? "date", query.sortDirection ?? "desc");
    const pageRows = sorted.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
    const totalExpenses = transactions.reduce((sum, item) => sum + item.amount, 0);
    const jobCosts = workOrders.reduce((sum, item) => sum + (item.actualCost ?? 0), 0);
    const partsCost = workOrders.flatMap((item) => item.parts).reduce((sum, item) => sum + item.totalCost, 0);
    const estimatedBudget = workOrders.reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0);
    const actualCost = workOrders.reduce((sum, item) => sum + (item.actualCost ?? 0), 0);
    const supplierCosts = this.countAmountBy(transactions.filter((item) => item.supplier), (item) => item.supplier ?? "Unknown Supplier");
    const departmentCosts = this.departmentCostSummary(workOrders);

    return this.composeReport({
      actor,
      module: "financials",
      range,
      query,
      summaryCards: [
        { label: "Total Expenses", value: this.formatCurrency(totalExpenses), subLabel: `${transactions.length} cost records`, tone: "info" },
        { label: "Cost per Job", value: this.formatCurrency(this.safeRatio(jobCosts, workOrders.length)), subLabel: `${workOrders.length} jobs`, tone: "neutral" },
        { label: "Parts Cost", value: this.formatCurrency(partsCost), subLabel: "Work order parts", tone: "warning" },
        {
          label: "Budget vs Actual",
          value: estimatedBudget > 0 ? this.formatCurrency(actualCost - estimatedBudget) : "N/A",
          subLabel: estimatedBudget > 0 ? `${this.formatCurrency(estimatedBudget)} estimated` : "Estimated costs not populated",
          tone: estimatedBudget > 0 && actualCost > estimatedBudget ? "danger" : "neutral"
        }
      ],
      charts: [
        { id: "monthly-expenses", title: "Monthly Expense Trends", type: "line", data: this.buildMonthlyTrend(transactions.map((item) => ({ date: item.date, value: item.amount })), range, "expense"), xKey: "period", yKeys: ["expense"] },
        { id: "cost-by-category", title: "Cost by Category", type: "pie", data: this.mapToChart(this.countAmountBy(transactions, (item) => item.category)), nameKey: "name", valueKey: "value" },
        { id: "cost-by-department", title: "Cost per Department", type: "bar", data: departmentCosts.slice(0, 8), xKey: "department", yKeys: ["cost"] },
        { id: "supplier-cost", title: "Supplier-wise Cost", type: "bar", data: this.mapToChart(supplierCosts).slice(0, 8), xKey: "name", yKeys: ["value"] }
      ],
      table: {
        columns: [
          { key: "date", label: "Date", type: "date" },
          { key: "source", label: "Source" },
          { key: "category", label: "Category" },
          { key: "department", label: "Department" },
          { key: "supplier", label: "Supplier" },
          { key: "description", label: "Description" },
          { key: "amount", label: "Amount", type: "currency" }
        ],
        rows: pageRows.map((item) => ({
          date: this.isoDate(item.date),
          source: item.source,
          category: item.category,
          department: item.department ?? "-",
          supplier: item.supplier ?? "-",
          description: item.description,
          amount: Number(item.amount.toFixed(2))
        })),
        pagination: this.paginationMeta(pagination, transactions.length)
      },
      insights: [
        `${this.formatCurrency(totalExpenses)} in expenses are visible for this period.`,
        estimatedBudget > 0 ? `Actual job cost is ${this.formatCurrency(actualCost - estimatedBudget)} against estimated budget.` : "Budget comparison is limited because estimated job costs are not consistently populated.",
        partsCost > 0 ? `${this.formatCurrency(partsCost)} is tied directly to parts/material usage.` : "No parts/material costs were recorded in the selected range."
      ],
      filterOptions,
      coverageNotes: estimatedBudget > 0 ? [] : ["Budget vs actual uses WorkOrder.estimatedCost and WorkOrder.actualCost where available; no dedicated budget model exists yet."]
    });
  }

  private async userActivityReport(actor: ReportActor, query: ReportQuery): Promise<ReportModuleResponse> {
    const range = this.resolveDateRange(query);
    const tenantId = actor.tenantId ?? null;
    const pagination = this.resolvePagination(query);
    const [users, audits, totalAudits, filterOptions] = await Promise.all([
      this.prisma.user.findMany({
        where: this.userWhere(tenantId, query),
        include: { role: true, department: true },
        orderBy: { lastLogin: "desc" }
      }),
      this.prisma.auditLog.findMany({
        where: this.auditWhere(tenantId, range, query),
        include: { actor: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
        orderBy: this.auditOrderBy(query),
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize
      }),
      this.prisma.auditLog.count({ where: this.auditWhere(tenantId, range, query) }),
      this.getFilterOptions(tenantId)
    ]);

    const activeUsers = users.filter((item) => item.isActive).length;
    const inactiveUsers = users.filter((item) => !item.isActive || !item.lastLogin || this.daysBetween(item.lastLogin, new Date()) > 30).length;
    const actionBreakdown = this.countBy(audits, (item) => item.action);
    const roleActivity = this.countBy(audits, (item) => item.actor?.role?.name ?? "UNKNOWN");
    const mostActive = this.mapToChart(this.countBy(audits, (item) => this.userLabel(item.actor))).slice(0, 8);
    const dailyActions = this.buildDailyTrend(audits.map((item) => ({ date: item.createdAt, value: 1 })), range, "actions");

    return this.composeReport({
      actor,
      module: "user-activity",
      range,
      query,
      summaryCards: [
        { label: "Users", value: users.length, subLabel: `${activeUsers} active`, tone: "info" },
        { label: "Audit Actions", value: totalAudits, subLabel: "Created, updated, deleted records", tone: "neutral" },
        { label: "Inactive Users", value: inactiveUsers, subLabel: "Inactive or no login in 30 days", tone: inactiveUsers > 0 ? "warning" : "success" },
        { label: "Most Active", value: mostActive[0]?.name ?? "N/A", subLabel: mostActive[0] ? `${mostActive[0].value} actions` : "No audit activity", tone: "neutral" }
      ],
      charts: [
        { id: "daily-actions", title: "User Actions Over Time", type: "line", data: dailyActions, xKey: "date", yKeys: ["actions"] },
        { id: "action-breakdown", title: "Created, Updated, Deleted Records", type: "pie", data: this.mapToChart(actionBreakdown), nameKey: "name", valueKey: "value" },
        { id: "role-activity", title: "Role-based Activity", type: "bar", data: this.mapToChart(roleActivity), xKey: "name", yKeys: ["value"] },
        { id: "most-active", title: "Most Active Users", type: "bar", data: mostActive, xKey: "name", yKeys: ["value"] }
      ],
      table: {
        columns: [
          { key: "createdAt", label: "Timestamp", type: "datetime" },
          { key: "actor", label: "User" },
          { key: "role", label: "Role" },
          { key: "action", label: "Action" },
          { key: "entity", label: "Entity" },
          { key: "entityId", label: "Record ID" }
        ],
        rows: audits.map((item) => ({
          createdAt: item.createdAt.toISOString(),
          actor: this.userLabel(item.actor),
          role: item.actor?.role?.name ?? "-",
          action: item.action,
          entity: item.entity,
          entityId: item.entityId
        })),
        pagination: this.paginationMeta(pagination, totalAudits)
      },
      insights: [
        `${inactiveUsers} users are inactive or have not logged in within 30 days.`,
        mostActive[0] ? `${mostActive[0].name} has the highest recorded activity in this period.` : "No user audit activity has been recorded in this period.",
        `${totalAudits} record changes are available from the audit trail.`
      ],
      filterOptions,
      coverageNotes: ["The current schema stores only User.lastLogin, not a full login-history table. Login history is reported as latest login recency until a dedicated LoginEvent model is added."]
    });
  }

  private async assetsReport(actor: ReportActor, query: ReportQuery): Promise<ReportModuleResponse> {
    const range = this.resolveDateRange(query);
    const tenantId = actor.tenantId ?? null;
    const pagination = this.resolvePagination(query);
    const [assets, vehicles, workOrders, maintenanceLogs, schedules, filterOptions] = await Promise.all([
      this.prisma.asset.findMany({ where: this.assetWhere(tenantId, query), include: { departmentRef: true } }),
      this.prisma.vehicle.findMany({ where: this.vehicleWhere(tenantId, query), include: { department: true, tripLogs: true } }),
      this.prisma.workOrder.findMany({ where: this.workOrderWhere(tenantId, range, query), include: { asset: { include: { departmentRef: true } }, vehicle: { include: { department: true } } } }),
      this.prisma.maintenanceLog.findMany({ where: this.maintenanceLogWhere(tenantId, range, query), include: { asset: true, vehicle: true } }),
      this.prisma.maintenanceSchedule.findMany({ where: this.maintenanceScheduleWhere(tenantId, query, false), include: { asset: true, vehicle: true }, orderBy: { nextDueDate: "asc" } }),
      this.getFilterOptions(tenantId)
    ]);

    const assetRows = [
      ...assets.map((item) => ({
        id: item.id,
        type: "Asset",
        name: item.name,
        identifier: item.assetTag,
        status: item.status,
        category: item.category,
        department: item.departmentRef?.name ?? item.department ?? "-",
        nextServiceDate: item.nextServiceDate,
        usage: item.meterReading ?? 0,
        cost: maintenanceLogs.filter((log) => log.assetId === item.id).reduce((sum, log) => sum + (log.cost ?? 0), 0),
        breakdowns: workOrders.filter((wo) => wo.assetId === item.id && ["CORRECTIVE", "EMERGENCY"].includes(wo.type)).length,
        downtimeHours: this.sumDowntime(workOrders.filter((wo) => wo.assetId === item.id))
      })),
      ...vehicles.map((item) => ({
        id: item.id,
        type: "Vehicle",
        name: `${item.make} ${item.vehicleModel}`,
        identifier: item.registrationNo,
        status: item.status,
        category: item.type,
        department: item.department?.name ?? "-",
        nextServiceDate: item.nextServiceDate,
        usage: item.tripLogs.reduce((sum, trip) => sum + trip.distance, 0),
        cost: maintenanceLogs.filter((log) => log.vehicleId === item.id).reduce((sum, log) => sum + (log.cost ?? 0), 0),
        breakdowns: workOrders.filter((wo) => wo.vehicleId === item.id && ["CORRECTIVE", "EMERGENCY"].includes(wo.type)).length,
        downtimeHours: this.sumDowntime(workOrders.filter((wo) => wo.vehicleId === item.id))
      }))
    ];
    const filteredRows = this.applySearch(assetRows, query.search, ["name", "identifier", "department", "category"]);
    const sortedRows = this.sortRows(filteredRows, query.sortBy ?? "breakdowns", query.sortDirection ?? "desc");
    const pageRows = sortedRows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
    const totalCost = assetRows.reduce((sum, item) => sum + item.cost, 0);
    const downtimeHours = assetRows.reduce((sum, item) => sum + item.downtimeHours, 0);
    const upcoming = schedules.filter((item) => item.nextDueDate && item.nextDueDate <= this.daysFromNow(30));
    const statusBreakdown = this.countBy(assetRows, (item) => item.status);
    const breakdownFrequency = assetRows
      .map((item) => ({ name: item.identifier, value: item.breakdowns }))
      .sort((leftItem, rightItem) => rightItem.value - leftItem.value)
      .slice(0, 8);

    return this.composeReport({
      actor,
      module: "assets",
      range,
      query,
      summaryCards: [
        { label: "Assets & Vehicles", value: assetRows.length, subLabel: `${assets.length} assets, ${vehicles.length} vehicles`, tone: "info" },
        { label: "Breakdowns", value: assetRows.reduce((sum, item) => sum + item.breakdowns, 0), subLabel: "Corrective and emergency jobs", tone: "warning" },
        { label: "Downtime", value: `${downtimeHours.toFixed(1)}h`, subLabel: "Work order start to completion", tone: downtimeHours > 0 ? "warning" : "success" },
        { label: "Maintenance Cost", value: this.formatCurrency(totalCost), subLabel: "Maintenance logs", tone: "neutral" },
        { label: "Upcoming", value: upcoming.length, subLabel: "Due within 30 days", tone: upcoming.length > 0 ? "warning" : "success" }
      ],
      charts: [
        { id: "asset-status", title: "Asset Status Breakdown", type: "pie", data: this.mapToChart(statusBreakdown), nameKey: "name", valueKey: "value" },
        { id: "breakdown-frequency", title: "Breakdown Frequency", type: "bar", data: breakdownFrequency, xKey: "name", yKeys: ["value"] },
        { id: "downtime-cost", title: "Downtime and Cost per Asset", type: "bar", data: sortedRows.slice(0, 8).map((item) => ({ name: item.identifier, downtimeHours: Number(item.downtimeHours.toFixed(1)), cost: Number(item.cost.toFixed(2)) })), xKey: "name", yKeys: ["downtimeHours", "cost"] },
        { id: "maintenance-trend", title: "Maintenance Cost Trend", type: "line", data: this.buildMonthlyTrend(maintenanceLogs.map((item) => ({ date: item.performedAt, value: item.cost ?? 0 })), range, "cost"), xKey: "period", yKeys: ["cost"] }
      ],
      table: {
        columns: [
          { key: "type", label: "Type" },
          { key: "identifier", label: "Identifier" },
          { key: "name", label: "Name" },
          { key: "status", label: "Status" },
          { key: "department", label: "Department" },
          { key: "breakdowns", label: "Breakdowns", type: "number" },
          { key: "downtimeHours", label: "Downtime Hours", type: "number" },
          { key: "cost", label: "Cost", type: "currency" },
          { key: "nextServiceDate", label: "Next Service", type: "date" }
        ],
        rows: pageRows.map((item) => ({
          type: item.type,
          identifier: item.identifier,
          name: item.name,
          status: item.status,
          department: item.department,
          breakdowns: item.breakdowns,
          downtimeHours: Number(item.downtimeHours.toFixed(1)),
          cost: Number(item.cost.toFixed(2)),
          nextServiceDate: this.isoDate(item.nextServiceDate)
        })),
        pagination: this.paginationMeta(pagination, filteredRows.length)
      },
      insights: [
        upcoming.length > 0 ? `${upcoming.length} assets or vehicles have maintenance due within 30 days.` : "No upcoming maintenance alerts found for the next 30 days.",
        breakdownFrequency[0] ? `${breakdownFrequency[0].name} has the highest breakdown count in this range.` : "No breakdown frequency data is available for the selected range.",
        `${this.formatCurrency(totalCost)} is recorded against maintenance logs in this range.`
      ],
      filterOptions,
      coverageNotes: []
    });
  }

  private async inventoryReport(actor: ReportActor, query: ReportQuery): Promise<ReportModuleResponse> {
    const range = this.resolveDateRange(query);
    const tenantId = actor.tenantId ?? null;
    const pagination = this.resolvePagination(query);
    const [parts, movements, workOrderParts, purchaseOrders, filterOptions] = await Promise.all([
      this.prisma.sparePart.findMany({ where: this.sparePartWhere(tenantId, query), include: { supplier: true } }),
      this.prisma.stockMovement.findMany({ where: this.stockMovementWhere(tenantId, range, query), include: { part: { include: { supplier: true } } }, orderBy: { createdAt: "desc" } }),
      this.prisma.workOrderPart.findMany({ where: { part: this.sparePartWhere(tenantId, query) }, include: { workOrder: true, part: { include: { supplier: true } } } }),
      this.prisma.purchaseOrder.findMany({ where: this.purchaseOrderWhere(tenantId, range, query), include: { supplier: true } }),
      this.getFilterOptions(tenantId)
    ]);

    const allRows = parts.map((part) => {
      const relatedMovements = movements.filter((movement) => movement.partId === part.id);
      const usedQuantity = relatedMovements.filter((movement) => movement.type === "OUT").reduce((sum, movement) => sum + movement.quantity, 0);
      const linkedCost = workOrderParts.filter((item) => item.partId === part.id).reduce((sum, item) => sum + item.totalCost, 0);
      return {
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        category: part.category,
        supplier: part.supplier?.name ?? "-",
        stock: part.quantityInStock,
        minimumStock: part.minimumStock,
        reorderPoint: part.reorderPoint,
        status: this.stockStatus(part),
        unitCost: part.unitCost,
        stockValue: part.quantityInStock * part.unitCost,
        usedQuantity,
        linkedCost,
        lastMovement: relatedMovements[0]?.createdAt ?? null
      };
    });
    const stockStatuses = ["LOW", "CRITICAL", "OUT_OF_STOCK", "IN_STOCK"];
    const rows = stockStatuses.includes(query.status ?? "") ? allRows.filter((item) => item.status === query.status) : allRows;
    const rowPartIds = new Set(rows.map((item) => item.id));
    const filteredMovements = movements.filter((item) => rowPartIds.has(item.partId));
    const filteredWorkOrderParts = workOrderParts.filter((item) => rowPartIds.has(item.partId));
    const sortedRows = this.sortRows(rows, query.sortBy ?? "stockValue", query.sortDirection ?? "desc");
    const pageRows = sortedRows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
    const stockValue = rows.reduce((sum, item) => sum + item.stockValue, 0);
    const lowStock = rows.filter((item) => item.status === "LOW" || item.status === "CRITICAL" || item.status === "OUT_OF_STOCK").length;
    const usageQuantity = filteredMovements.filter((item) => item.type === "OUT").reduce((sum, item) => sum + item.quantity, 0);
    const pendingPo = purchaseOrders.filter((item) => ["PENDING", "ORDERED", "PARTIALLY_RECEIVED"].includes(item.status)).length;
    const stockByCategory = this.countAmountBy(rows, (item) => item.category, (item) => item.stockValue);
    const supplierPerformance = this.countAmountBy(purchaseOrders, (item) => item.supplier?.name ?? "Unknown Supplier", (item) => item.totalAmount);

    return this.composeReport({
      actor,
      module: "inventory",
      range,
      query,
      summaryCards: [
        { label: "Stock Value", value: this.formatCurrency(stockValue), subLabel: `${rows.length} active parts`, tone: "info" },
        { label: "Low Stock Alerts", value: lowStock, subLabel: "Low, critical, or out", tone: lowStock > 0 ? "danger" : "success" },
        { label: "Stock Usage", value: usageQuantity, subLabel: "Units consumed in range", tone: "neutral" },
        { label: "Pending POs", value: pendingPo, subLabel: "Supplier replenishment", tone: pendingPo > 0 ? "warning" : "success" }
      ],
      charts: [
        { id: "stock-by-category", title: "Current Stock Value by Category", type: "bar", data: this.mapToChart(stockByCategory), xKey: "name", yKeys: ["value"] },
        { id: "stock-usage", title: "Stock Usage History", type: "line", data: this.buildDailyTrend(filteredMovements.filter((item) => item.type === "OUT").map((item) => ({ date: item.createdAt, value: item.quantity })), range, "quantity"), xKey: "date", yKeys: ["quantity"] },
        { id: "parts-used", title: "Parts Used per Job", type: "bar", data: this.topPartUsage(filteredWorkOrderParts), xKey: "name", yKeys: ["quantity", "cost"] },
        { id: "supplier-performance", title: "Supplier Performance by Spend", type: "bar", data: this.mapToChart(supplierPerformance).slice(0, 8), xKey: "name", yKeys: ["value"] }
      ],
      table: {
        columns: [
          { key: "partNumber", label: "Part Number" },
          { key: "name", label: "Part" },
          { key: "category", label: "Category" },
          { key: "supplier", label: "Supplier" },
          { key: "status", label: "Stock Status" },
          { key: "stock", label: "Current Stock", type: "number" },
          { key: "usedQuantity", label: "Used", type: "number" },
          { key: "stockValue", label: "Stock Value", type: "currency" },
          { key: "lastMovement", label: "Last Movement", type: "date" }
        ],
        rows: pageRows.map((item) => ({
          partNumber: item.partNumber,
          name: item.name,
          category: item.category,
          supplier: item.supplier,
          status: item.status,
          stock: item.stock,
          usedQuantity: item.usedQuantity,
          stockValue: Number(item.stockValue.toFixed(2)),
          lastMovement: this.isoDate(item.lastMovement)
        })),
        pagination: this.paginationMeta(pagination, rows.length)
      },
      insights: [
        lowStock > 0 ? `${lowStock} parts are below target stock thresholds.` : "No low-stock parts are visible in this filter range.",
        `${usageQuantity} units were consumed from stock in the selected period.`,
        pendingPo > 0 ? `${pendingPo} purchase orders are still pending or partially received.` : "No pending purchase orders are currently visible."
      ],
      filterOptions,
      coverageNotes: []
    });
  }

  private async performanceReport(actor: ReportActor, query: ReportQuery): Promise<ReportModuleResponse> {
    const range = this.resolveDateRange(query);
    const tenantId = actor.tenantId ?? null;
    const pagination = this.resolvePagination(query);
    const [orders, filterOptions] = await Promise.all([
      this.prisma.workOrder.findMany({
        where: this.workOrderWhere(tenantId, range, query),
        include: {
          technician: { include: { department: true } },
          asset: { include: { departmentRef: true } },
          vehicle: { include: { department: true } }
        }
      }),
      this.getFilterOptions(tenantId)
    ]);

    const now = new Date();
    const completed = orders.filter((item) => item.status === WorkOrderStatus.COMPLETED);
    const overdue = orders.filter((item) => this.isWorkOrderOverdue(item, now));
    const avgCompletion = this.average(completed.map((item) => this.hoursBetween(item.startDate ?? item.createdAt, item.completedDate ?? item.updatedAt)));
    const avgResponse = this.average(orders.filter((item) => item.startDate).map((item) => this.hoursBetween(item.createdAt, item.startDate ?? item.createdAt)));
    const departmentEfficiency = this.summarizeByDepartment(orders).map((item) => ({
      department: item.department,
      efficiency: Number((this.safeRatio(item.completed, item.total) * 100).toFixed(1)),
      total: item.total
    }));
    const technicianProductivity = this.summarizeByTechnician(orders).map((item) => ({
      technician: item.technician,
      total: item.total,
      completed: item.completed,
      overdue: item.overdue,
      productivity: Number((this.safeRatio(item.completed, item.total) * 100).toFixed(1))
    }));
    const sortedRows = this.sortRows(technicianProductivity, query.sortBy ?? "productivity", query.sortDirection ?? "desc");
    const pageRows = sortedRows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
    const monthlyKpis = this.buildMonthlyKpis(orders, range);

    return this.composeReport({
      actor,
      module: "performance",
      range,
      query,
      summaryCards: [
        { label: "Completion Rate", value: this.formatPercent(this.safeRatio(completed.length, orders.length)), subLabel: `${completed.length}/${orders.length} jobs`, tone: "success" },
        { label: "Avg Completion", value: `${avgCompletion.toFixed(1)}h`, subLabel: "Start to complete", tone: "neutral" },
        { label: "Avg Response", value: `${avgResponse.toFixed(1)}h`, subLabel: "Create to start", tone: avgResponse > 24 ? "warning" : "success" },
        { label: "Overdue", value: this.formatPercent(this.safeRatio(overdue.length, orders.length)), subLabel: `${overdue.length} jobs`, tone: overdue.length > 0 ? "danger" : "success" },
        { label: "SLA Compliance", value: this.formatPercent(this.safeRatio(orders.filter((item) => !item.slaBreached).length, orders.length)), subLabel: "Non-breached jobs", tone: "info" }
      ],
      charts: [
        { id: "monthly-kpis", title: "Monthly KPI Trends", type: "line", data: monthlyKpis, xKey: "period", yKeys: ["completionRate", "overdueRate", "avgCompletionHours"] },
        { id: "department-efficiency", title: "Department Efficiency", type: "bar", data: departmentEfficiency.slice(0, 8), xKey: "department", yKeys: ["efficiency", "total"] },
        { id: "technician-productivity", title: "Technician Productivity", type: "bar", data: technicianProductivity.slice(0, 8), xKey: "technician", yKeys: ["completed", "overdue"] },
        { id: "response-time", title: "Response Time Trend", type: "line", data: this.buildMonthlyResponseTrend(orders, range), xKey: "period", yKeys: ["responseHours"] }
      ],
      table: {
        columns: [
          { key: "technician", label: "Technician" },
          { key: "total", label: "Assigned Jobs", type: "number" },
          { key: "completed", label: "Completed", type: "number" },
          { key: "overdue", label: "Overdue", type: "number" },
          { key: "productivity", label: "Productivity", type: "percent" }
        ],
        rows: pageRows.map((item) => ({
          technician: item.technician,
          total: item.total,
          completed: item.completed,
          overdue: item.overdue,
          productivity: item.productivity
        })),
        pagination: this.paginationMeta(pagination, sortedRows.length)
      },
      insights: [
        `Average response time is ${avgResponse.toFixed(1)} hours for started work.`,
        overdue.length > 0 ? `${overdue.length} jobs are overdue, affecting KPI performance.` : "No overdue jobs are affecting KPI performance in this range.",
        technicianProductivity[0] ? `${technicianProductivity[0].technician} has the strongest completion volume in this view.` : "No technician productivity data is available for this filter range."
      ],
      filterOptions,
      coverageNotes: []
    });
  }

  private async systemLogsReport(actor: ReportActor, query: ReportQuery): Promise<ReportModuleResponse> {
    const range = this.resolveDateRange(query);
    const tenantId = actor.tenantId ?? null;
    const pagination = this.resolvePagination(query);
    const where = this.auditWhere(tenantId, range, query);
    const [audits, totalAudits, filterOptions] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { firstName: true, lastName: true, email: true, role: true } } },
        orderBy: this.auditOrderBy(query),
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize
      }),
      this.prisma.auditLog.count({ where }),
      this.getFilterOptions(tenantId)
    ]);

    const actionBreakdown = this.countBy(audits, (item) => item.action);
    const entityBreakdown = this.countBy(audits, (item) => item.entity);
    const securityEvents = audits.filter((item) => ["User", "Role", "Permission", "TenantMembership", "TenantInvitation"].includes(item.entity));

    return this.composeReport({
      actor,
      module: "system-logs",
      range,
      query,
      summaryCards: [
        { label: "Audit Events", value: totalAudits, subLabel: "Data change history", tone: "info" },
        { label: "Creates", value: actionBreakdown.CREATE ?? 0, subLabel: "New records", tone: "success" },
        { label: "Updates", value: actionBreakdown.UPDATE ?? 0, subLabel: "Changed records", tone: "warning" },
        { label: "Deletes", value: actionBreakdown.DELETE ?? 0, subLabel: "Deleted records", tone: "danger" },
        { label: "Security Events", value: securityEvents.length, subLabel: "User, role, tenant changes", tone: securityEvents.length > 0 ? "warning" : "neutral" }
      ],
      charts: [
        { id: "audit-trend", title: "Audit Event Trend", type: "line", data: this.buildDailyTrend(audits.map((item) => ({ date: item.createdAt, value: 1 })), range, "events"), xKey: "date", yKeys: ["events"] },
        { id: "audit-actions", title: "Action Breakdown", type: "pie", data: this.mapToChart(actionBreakdown), nameKey: "name", valueKey: "value" },
        { id: "entity-breakdown", title: "Entity Activity", type: "bar", data: this.mapToChart(entityBreakdown).slice(0, 10), xKey: "name", yKeys: ["value"] },
        { id: "security-events", title: "Security-related Events", type: "bar", data: this.mapToChart(this.countBy(securityEvents, (item) => item.entity)), xKey: "name", yKeys: ["value"] }
      ],
      table: {
        columns: [
          { key: "createdAt", label: "Timestamp", type: "datetime" },
          { key: "actor", label: "Actor" },
          { key: "role", label: "Role" },
          { key: "action", label: "Action" },
          { key: "entity", label: "Entity" },
          { key: "entityId", label: "Record ID" }
        ],
        rows: audits.map((item) => ({
          createdAt: item.createdAt.toISOString(),
          actor: this.userLabel(item.actor),
          role: item.actor?.role?.name ?? "-",
          action: item.action,
          entity: item.entity,
          entityId: item.entityId
        })),
        pagination: this.paginationMeta(pagination, totalAudits)
      },
      insights: [
        `${totalAudits} audit records match the current filters.`,
        securityEvents.length > 0 ? `${securityEvents.length} security-related changes should be reviewed.` : "No security-related audit changes are visible in this range.",
        "Created, updated, and deleted record history is sourced from the AuditLog model."
      ],
      filterOptions,
      coverageNotes: this.systemCoverageNotes()
    });
  }

  private composeReport(args: {
    actor: ReportActor;
    module: ReportModuleKey;
    range: DateRange;
    query: ReportQuery;
    summaryCards: ReportSummaryCard[];
    charts: ReportChart[];
    table: ReportTable;
    insights: string[];
    filterOptions: ReportFilterOptions;
    coverageNotes: string[];
  }): ReportModuleResponse {
    const meta = REPORT_TITLES[args.module];
    return {
      module: args.module,
      title: meta.title,
      description: meta.description,
      generatedAt: new Date().toISOString(),
      refreshSeconds: REFRESH_SECONDS,
      filters: this.publicFilters(args.range, args.query),
      summaryCards: args.summaryCards,
      charts: args.charts,
      table: args.table,
      insights: args.insights,
      filterOptions: args.filterOptions,
      coverageNotes: args.coverageNotes
    };
  }

  private resolveDateRange(query: ReportQuery): DateRange {
    const end = query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : new Date();
    const start = query.startDate ? new Date(`${query.startDate}T00:00:00.000Z`) : this.daysAgo(29, end);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("Invalid report date range.");
    }

    if (start > end) {
      throw new BadRequestException("startDate must be before endDate.");
    }

    return { start, end };
  }

  private resolvePagination(query: ReportQuery) {
    const page = Math.max(1, Math.floor(Number(query.page ?? 1)) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.pageSize ?? DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE));
    return { page, pageSize };
  }

  private publicFilters(range: DateRange, query: ReportQuery) {
    return {
      startDate: this.isoDate(range.start) ?? "",
      endDate: this.isoDate(range.end) ?? "",
      departmentId: query.departmentId || undefined,
      departmentIds: this.departmentIds(query).length ? this.departmentIds(query) : undefined,
      userId: query.userId || undefined,
      driverId: query.driverId || undefined,
      assetId: query.assetId || undefined,
      vehicleId: query.vehicleId || undefined,
      status: query.status || undefined,
      supplierId: query.supplierId || undefined,
      category: query.category || undefined,
      search: query.search || undefined
    };
  }

  private assertModule(module: string): asserts module is ReportModuleKey {
    if (!MODULES.includes(module as ReportModuleKey)) {
      throw new BadRequestException(`Unsupported report module: ${module}`);
    }
  }

  private assertModuleAccess(actor: ReportActor, module: ReportModuleKey) {
    if (module === "system-logs" && !["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"].includes(actor.role)) {
      throw new ForbiddenException("System log reports require admin or asset manager access.");
    }

    if (module === "financials" && ["TECHNICIAN", "MECHANIC", "DRIVER", "CLEANER", "VIEWER"].includes(actor.role)) {
      throw new ForbiddenException("Financial reports require manager-level access.");
    }
  }

  private async getFilterOptions(tenantId: string | null): Promise<ReportFilterOptions> {
    const [departments, users, drivers, assets, vehicles, suppliers, partCategories, assetCategories] = await Promise.all([
      this.prisma.department.findMany({ where: { ...(tenantId ? { tenantId } : {}), isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
      this.prisma.user.findMany({ where: { ...(tenantId ? { tenantId } : {}), isActive: true }, include: { role: true }, orderBy: { firstName: "asc" } }),
      this.prisma.driver.findMany({
        where: { ...(tenantId ? { tenantId } : {}) },
        select: {
          id: true,
          licenseNumber: true,
          user: { select: { firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 200
      }),
      this.prisma.asset.findMany({ where: { ...(tenantId ? { tenantId } : {}), archivedAt: null }, select: { id: true, name: true, assetTag: true }, orderBy: { name: "asc" }, take: 200 }),
      this.prisma.vehicle.findMany({ where: { ...(tenantId ? { tenantId } : {}) }, select: { id: true, registrationNo: true, vehicleModel: true }, orderBy: { registrationNo: "asc" }, take: 200 }),
      this.prisma.supplier.findMany({ where: { ...(tenantId ? { tenantId } : {}), isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.sparePart.findMany({ where: { ...(tenantId ? { tenantId } : {}), isActive: true }, select: { category: true }, distinct: ["category"] }),
      this.prisma.asset.findMany({ where: { ...(tenantId ? { tenantId } : {}), archivedAt: null }, select: { category: true }, distinct: ["category"] })
    ]);

    return {
      departments: departments.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` })),
      users: users.map((item) => ({ id: item.id, label: this.userLabel(item), role: item.role.name })),
      drivers: drivers.map((item) => ({ id: item.id, label: `${this.userLabel(item.user)} (${item.licenseNumber})` })),
      vehicles: vehicles.map((item) => ({ id: item.id, label: `${item.registrationNo} - ${item.vehicleModel}` })),
      assets: [
        ...assets.map((item) => ({ id: item.id, label: `${item.assetTag} - ${item.name}`, type: "asset" as const })),
        ...vehicles.map((item) => ({ id: item.id, label: `${item.registrationNo} - ${item.vehicleModel}`, type: "vehicle" as const }))
      ],
      suppliers: suppliers.map((item) => ({ id: item.id, label: item.name })),
      statuses: Array.from(
        new Set([
          ...Object.values(WorkOrderStatus),
          "LOW",
          "MEDIUM",
          "HIGH",
          "CRITICAL",
          "ELIGIBLE",
          "INELIGIBLE",
          "ANOMALOUS",
          "NORMAL",
          "OUT_OF_STOCK",
          "IN_STOCK"
        ])
      ),
      categories: Array.from(new Set([...partCategories.map((item) => item.category), ...assetCategories.map((item) => item.category)])).sort()
    };
  }

  private tenantWhere(tenantId: string | null) {
    return tenantId ? { tenantId } : {};
  }

  private departmentIds(query: ReportQuery) {
    const values = [query.departmentId, query.departmentIds]
      .flatMap((value) => Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [])
      .map((value) => value.trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }

  private departmentIdCondition(query: ReportQuery) {
    const ids = this.departmentIds(query);
    if (ids.length === 0) return undefined;
    return ids.length === 1 ? ids[0] : { in: ids };
  }

  private workOrderWhere(tenantId: string | null, range: DateRange, query: ReportQuery) {
    const where: Record<string, unknown> = {
      ...this.tenantWhere(tenantId),
      createdAt: { gte: range.start, lte: range.end }
    };
    const andFilters: Array<Record<string, unknown>> = [];

    if (query.status && Object.values(WorkOrderStatus).includes(query.status as WorkOrderStatus)) {
      where.status = query.status;
    }
    if (query.userId) where.technicianId = query.userId;
    if (query.assetId) andFilters.push({ OR: [{ assetId: query.assetId }, { vehicleId: query.assetId }] });
    const departmentCondition = this.departmentIdCondition(query);
    if (departmentCondition) {
      andFilters.push({
        OR: [
          { asset: { departmentId: departmentCondition } },
          { vehicle: { departmentId: departmentCondition } },
          { technician: { departmentId: departmentCondition } }
        ]
      });
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      andFilters.push({
        OR: [
          { woNumber: { contains: search, mode: "insensitive" as const } },
          { title: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } }
        ]
      });
    }
    if (andFilters.length > 0) where.AND = andFilters;

    return where;
  }

  private assetWhere(tenantId: string | null, query: ReportQuery) {
    const where: Record<string, unknown> = { ...this.tenantWhere(tenantId), archivedAt: null };
    if (query.assetId) where.id = query.assetId;
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    const departmentCondition = this.departmentIdCondition(query);
    if (departmentCondition) where.departmentId = departmentCondition;
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { assetTag: { contains: search, mode: "insensitive" as const } },
        { name: { contains: search, mode: "insensitive" as const } },
        { location: { contains: search, mode: "insensitive" as const } },
        { serialNumber: { contains: search, mode: "insensitive" as const } }
      ];
    }
    return where;
  }

  private vehicleWhere(tenantId: string | null, query: ReportQuery) {
    const where: Record<string, unknown> = { ...this.tenantWhere(tenantId) };
    if (query.assetId) where.id = query.assetId;
    if (query.status) where.status = query.status;
    if (query.category) where.type = query.category;
    const departmentCondition = this.departmentIdCondition(query);
    if (departmentCondition) where.departmentId = departmentCondition;
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { registrationNo: { contains: search, mode: "insensitive" as const } },
        { vehicleModel: { contains: search, mode: "insensitive" as const } },
        { make: { contains: search, mode: "insensitive" as const } }
      ];
    }
    return where;
  }

  private sparePartWhere(tenantId: string | null, query: ReportQuery) {
    const where: Record<string, unknown> = { ...this.tenantWhere(tenantId), isActive: true };
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.category) where.category = query.category;
    if (query.status === "OUT_OF_STOCK") where.quantityInStock = { lte: 0 };
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { partNumber: { contains: search, mode: "insensitive" as const } },
        { name: { contains: search, mode: "insensitive" as const } },
        { category: { contains: search, mode: "insensitive" as const } }
      ];
    }
    return where;
  }

  private stockMovementWhere(tenantId: string | null, range: DateRange, query: ReportQuery) {
    return {
      createdAt: { gte: range.start, lte: range.end },
      part: this.sparePartWhere(tenantId, query)
    };
  }

  private purchaseOrderWhere(tenantId: string | null, range: DateRange, query: ReportQuery) {
    const where: Record<string, unknown> = {
      orderDate: { gte: range.start, lte: range.end },
      supplier: tenantId ? { tenantId } : undefined
    };
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;
    return this.cleanWhere(where);
  }

  private maintenanceLogWhere(tenantId: string | null, range: DateRange, query: ReportQuery) {
    const where: Record<string, unknown> = {
      performedAt: { gte: range.start, lte: range.end }
    };
    const andFilters: Array<Record<string, unknown>> = [];
    if (tenantId) {
      andFilters.push({
        OR: [
          { asset: { tenantId } },
          { vehicle: { tenantId } },
          { workOrder: { tenantId } }
        ]
      });
    }
    if (query.assetId) andFilters.push({ OR: [{ assetId: query.assetId }, { vehicleId: query.assetId }] });
    if (andFilters.length > 0) where.AND = andFilters;
    return where;
  }

  private maintenanceScheduleWhere(tenantId: string | null, query: ReportQuery, upcomingOnly: boolean) {
    const where: Record<string, unknown> = {
      isActive: true
    };
    const andFilters: Array<Record<string, unknown>> = [];
    if (tenantId) {
      andFilters.push({
        OR: [
          { asset: { tenantId } },
          { vehicle: { tenantId } }
        ]
      });
    }
    if (query.assetId) andFilters.push({ OR: [{ assetId: query.assetId }, { vehicleId: query.assetId }] });
    if (andFilters.length > 0) where.AND = andFilters;
    if (upcomingOnly) where.nextDueDate = { lte: this.daysFromNow(30) };
    return where;
  }

  private auditWhere(tenantId: string | null, range: DateRange, query: ReportQuery) {
    const where: Record<string, unknown> = {
      ...this.tenantWhere(tenantId),
      createdAt: { gte: range.start, lte: range.end }
    };
    if (query.userId) where.actorId = query.userId;
    if (query.status && Object.values(AuditAction).includes(query.status as AuditAction)) where.action = query.status;
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { entity: { contains: search, mode: "insensitive" as const } },
        { entityId: { contains: search, mode: "insensitive" as const } }
      ];
    }
    return where;
  }

  private userWhere(tenantId: string | null, query: ReportQuery) {
    const where: Record<string, unknown> = { ...this.tenantWhere(tenantId) };
    if (query.userId) where.id = query.userId;
    const departmentCondition = this.departmentIdCondition(query);
    if (departmentCondition) where.departmentId = departmentCondition;
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } }
      ];
    }
    return where;
  }

  private workOrderOrderBy(query: ReportQuery) {
    const sortBy = query.sortBy && ["createdAt", "dueDate", "completedDate", "actualCost", "priority", "status"].includes(query.sortBy) ? query.sortBy : "createdAt";
    return { [sortBy]: query.sortDirection ?? "desc" };
  }

  private auditOrderBy(query: ReportQuery) {
    const sortBy = query.sortBy && ["createdAt", "entity", "action"].includes(query.sortBy) ? query.sortBy : "createdAt";
    return { [sortBy]: query.sortDirection ?? "desc" };
  }

  private async getFinancialTransactions(tenantId: string | null, range: DateRange, query: ReportQuery) {
    const [workOrders, parts, maintenanceLogs, purchaseOrders, utilityBills, farmExpenses] = await Promise.all([
      this.prisma.workOrder.findMany({
        where: this.workOrderWhere(tenantId, range, query),
        include: {
          asset: { include: { departmentRef: true } },
          vehicle: { include: { department: true } },
          technician: { include: { department: true } }
        }
      }),
      this.prisma.workOrderPart.findMany({
        where: {
          workOrder: this.workOrderWhere(tenantId, range, query),
          part: this.sparePartWhere(tenantId, query)
        },
        include: { part: { include: { supplier: true } }, workOrder: { include: { asset: { include: { departmentRef: true } }, vehicle: { include: { department: true } }, technician: { include: { department: true } } } } }
      }),
      this.prisma.maintenanceLog.findMany({ where: this.maintenanceLogWhere(tenantId, range, query), include: { asset: true, vehicle: true } }),
      this.prisma.purchaseOrder.findMany({ where: this.purchaseOrderWhere(tenantId, range, query), include: { supplier: true } }),
      this.prisma.utilityBill.findMany({ where: { ...this.tenantWhere(tenantId), billingPeriodStart: { gte: range.start, lte: range.end } }, include: { meter: true } }),
      this.prisma.farmExpense.findMany({
        where: this.cleanWhere({
          ...(tenantId ? { tenantId } : {}),
          date: { gte: range.start, lte: range.end },
          category: query.category && Object.values(ExpenseCategory).includes(query.category as ExpenseCategory) ? (query.category as ExpenseCategory) : undefined
        })
      })
    ]);

    const transactions = [
      ...workOrders
        .filter((item) => (item.actualCost ?? 0) > 0)
        .map((item) => ({
          date: item.completedDate ?? item.updatedAt,
          source: "Work Order",
          category: "Job Cost",
          department: this.departmentLabel(item),
          supplier: null as string | null,
          description: `${item.woNumber} - ${item.title}`,
          amount: item.actualCost ?? 0
        })),
      ...parts.map((item) => ({
        date: item.workOrder.completedDate ?? item.workOrder.updatedAt,
        source: "Work Order Part",
        category: "Parts/Materials",
        department: this.departmentLabel(item.workOrder),
        supplier: item.part.supplier?.name ?? null,
        description: `${item.part.name} used on ${item.workOrder.woNumber}`,
        amount: item.totalCost
      })),
      ...maintenanceLogs
        .filter((item) => (item.cost ?? 0) > 0)
        .map((item) => ({
          date: item.performedAt,
          source: "Maintenance Log",
          category: "Maintenance",
          department: null as string | null,
          supplier: null as string | null,
          description: item.description,
          amount: item.cost ?? 0
        })),
      ...purchaseOrders.map((item) => ({
        date: item.orderDate,
        source: "Purchase Order",
        category: "Supplier Purchase",
        department: null as string | null,
        supplier: item.supplier.name,
        description: item.poNumber,
        amount: item.totalAmount
      })),
      ...utilityBills.map((item) => ({
        date: item.billingPeriodStart,
        source: "Utility Bill",
        category: "Utilities",
        department: null as string | null,
        supplier: item.meter.location,
        description: `${item.meter.type} bill`,
        amount: item.totalAmount
      })),
      ...farmExpenses.map((item) => ({
        date: item.date,
        source: "Farm Expense",
        category: String(item.category),
        department: null as string | null,
        supplier: null as string | null,
        description: item.description,
        amount: item.amountLkr
      }))
    ];

    const category = query.category?.trim().toLowerCase();
    return category ? transactions.filter((item) => item.category.toLowerCase() === category) : transactions;
  }

  private summarizeByDepartment(orders: Array<any>) {
    const rows = new Map<string, { department: string; total: number; completed: number; overdue: number }>();
    const now = new Date();
    for (const order of orders) {
      const department = this.departmentLabel(order);
      const current = rows.get(department) ?? { department, total: 0, completed: 0, overdue: 0 };
      current.total += 1;
      if (order.status === WorkOrderStatus.COMPLETED) current.completed += 1;
      if (this.isWorkOrderOverdue(order, now)) current.overdue += 1;
      rows.set(department, current);
    }
    return Array.from(rows.values()).sort((leftItem, rightItem) => rightItem.total - leftItem.total);
  }

  private summarizeByTechnician(orders: Array<any>) {
    const rows = new Map<string, { technician: string; total: number; completed: number; overdue: number }>();
    const now = new Date();
    for (const order of orders) {
      const technician = this.userLabel(order.technician);
      const current = rows.get(technician) ?? { technician, total: 0, completed: 0, overdue: 0 };
      current.total += 1;
      if (order.status === WorkOrderStatus.COMPLETED) current.completed += 1;
      if (this.isWorkOrderOverdue(order, now)) current.overdue += 1;
      rows.set(technician, current);
    }
    return Array.from(rows.values()).sort((leftItem, rightItem) => rightItem.total - leftItem.total);
  }

  private departmentCostSummary(orders: Array<any>) {
    const rows = new Map<string, { department: string; cost: number }>();
    for (const order of orders) {
      const department = this.departmentLabel(order);
      const current = rows.get(department) ?? { department, cost: 0 };
      current.cost += order.actualCost ?? 0;
      rows.set(department, current);
    }
    return Array.from(rows.values()).sort((leftItem, rightItem) => rightItem.cost - leftItem.cost);
  }

  private topPartUsage(parts: Array<any>) {
    const rows = new Map<string, { name: string; quantity: number; cost: number }>();
    for (const item of parts) {
      const name = item.part?.name ?? item.partId;
      const current = rows.get(name) ?? { name, quantity: 0, cost: 0 };
      current.quantity += item.quantity;
      current.cost += item.totalCost;
      rows.set(name, current);
    }
    return Array.from(rows.values()).sort((leftItem, rightItem) => rightItem.quantity - leftItem.quantity).slice(0, 8);
  }

  private buildMonthlyKpis(orders: Array<any>, range: DateRange) {
    const trend = this.monthKeys(range).map((period) => ({ period, total: 0, completed: 0, overdue: 0, completionHours: [] as number[] }));
    for (const order of orders) {
      const period = order.createdAt.toISOString().slice(0, 7);
      const point = trend.find((item) => item.period === period);
      if (!point) continue;
      point.total += 1;
      if (order.status === WorkOrderStatus.COMPLETED) point.completed += 1;
      if (this.isWorkOrderOverdue(order, new Date())) point.overdue += 1;
      if (order.completedDate) point.completionHours.push(this.hoursBetween(order.startDate ?? order.createdAt, order.completedDate));
    }
    return trend.map((item) => ({
      period: item.period,
      completionRate: Number((this.safeRatio(item.completed, item.total) * 100).toFixed(1)),
      overdueRate: Number((this.safeRatio(item.overdue, item.total) * 100).toFixed(1)),
      avgCompletionHours: Number(this.average(item.completionHours).toFixed(1))
    }));
  }

  private buildMonthlyResponseTrend(orders: Array<any>, range: DateRange) {
    const trend = this.monthKeys(range).map((period) => ({ period, values: [] as number[] }));
    for (const order of orders.filter((item) => item.startDate)) {
      const period = order.createdAt.toISOString().slice(0, 7);
      const point = trend.find((item) => item.period === period);
      if (point) point.values.push(this.hoursBetween(order.createdAt, order.startDate));
    }
    return trend.map((item) => ({ period: item.period, responseHours: Number(this.average(item.values).toFixed(1)) }));
  }

  private buildMonthlyTrend(items: Array<{ date: Date; value: number }>, range: DateRange, valueKey: string) {
    const values = new Map(this.monthKeys(range).map((key) => [key, 0]));
    for (const item of items) {
      const key = item.date.toISOString().slice(0, 7);
      if (values.has(key)) values.set(key, (values.get(key) ?? 0) + item.value);
    }
    return Array.from(values.entries()).map(([period, value]) => ({ period, [valueKey]: Number(value.toFixed(2)) }));
  }

  private buildDailyTrend(items: Array<{ date: Date; value: number }>, range: DateRange, valueKey: string) {
    const days = Math.min(45, Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1));
    const start = this.daysAgo(days - 1, range.end);
    const values = new Map<string, number>();
    for (let index = 0; index < days; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      values.set(this.isoDate(date) ?? "", 0);
    }
    for (const item of items) {
      const key = this.isoDate(item.date) ?? "";
      if (values.has(key)) values.set(key, (values.get(key) ?? 0) + item.value);
    }
    return Array.from(values.entries()).map(([date, value]) => ({ date, [valueKey]: Number(value.toFixed(2)) }));
  }

  private monthKeys(range: DateRange) {
    const keys: string[] = [];
    const cursor = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1));
    const end = new Date(Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), 1));
    while (cursor <= end) {
      keys.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return keys;
  }

  private countBy<T>(items: T[], keyFn: (item: T) => string) {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const key = keyFn(item) || "Unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  private countAmountBy<T>(items: T[], keyFn: (item: T) => string, amountFn: (item: T) => number = (item: any) => item.amount ?? item.value ?? 0) {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const key = keyFn(item) || "Unknown";
      counts[key] = (counts[key] ?? 0) + amountFn(item);
    }
    return counts;
  }

  private mapToChart(map: Record<string, number>) {
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((leftItem, rightItem) => rightItem.value - leftItem.value);
  }

  private sortRows<T extends Record<string, any>>(rows: T[], sortBy: string, sortDirection: "asc" | "desc") {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...rows].sort((leftItem, rightItem) => {
      const left = leftItem[sortBy];
      const right = rightItem[sortBy];
      if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
      return String(left ?? "").localeCompare(String(right ?? "")) * direction;
    });
  }

  private applySearch<T extends Record<string, any>>(rows: T[], search: string | undefined, keys: string[]) {
    if (!search?.trim()) return rows;
    const term = search.trim().toLowerCase();
    return rows.filter((row) => keys.some((key) => String(row[key] ?? "").toLowerCase().includes(term)));
  }

  private cleanWhere<T extends Record<string, unknown>>(where: T): T {
    return Object.fromEntries(Object.entries(where).filter(([, value]) => value !== undefined && value !== "")) as T;
  }

  private paginationMeta(pagination: { page: number; pageSize: number }, total: number): Pagination {
    return {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.pageSize))
    };
  }

  private isWorkOrderOverdue(item: { status: WorkOrderStatus; dueDate?: Date | null; completedDate?: Date | null }, now: Date) {
    if (item.status === WorkOrderStatus.OVERDUE) return true;
    if (!item.dueDate) return false;
    const terminalStatuses: WorkOrderStatus[] = [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED];
    if (terminalStatuses.includes(item.status)) return false;
    return item.dueDate < now;
  }

  private sumDowntime(orders: Array<{ startDate?: Date | null; completedDate?: Date | null }>) {
    return orders.reduce((sum, item) => (item.startDate && item.completedDate ? sum + this.hoursBetween(item.startDate, item.completedDate) : sum), 0);
  }

  private stockStatus(part: { quantityInStock: number; minimumStock: number; reorderPoint: number }) {
    if (part.quantityInStock <= 0) return "OUT_OF_STOCK";
    if (part.quantityInStock <= part.reorderPoint) return "CRITICAL";
    if (part.quantityInStock <= part.minimumStock) return "LOW";
    return "IN_STOCK";
  }

  private userLabel(user?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
    if (!user) return "Unassigned";
    const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    return name || user.email || "Unknown User";
  }

  private departmentLabel(order: any) {
    return (
      order.asset?.departmentRef?.name ??
      order.vehicle?.department?.name ??
      order.technician?.department?.name ??
      order.asset?.department ??
      "Unassigned"
    );
  }

  private hoursBetween(start: Date, end: Date) {
    return Math.max(0, end.getTime() - start.getTime()) / 3_600_000;
  }

  private daysBetween(start: Date, end: Date) {
    return Math.max(0, end.getTime() - start.getTime()) / 86_400_000;
  }

  private average(values: number[]) {
    if (!values.length) return 0;
    return values.reduce((sum, item) => sum + item, 0) / values.length;
  }

  private safeRatio(value: number, total: number) {
    return total > 0 ? value / total : 0;
  }

  private formatPercent(value: number) {
    return `${Math.round(value * 100)}%`;
  }

  private formatCurrency(value: number) {
    return CURRENCY_FORMATTER.format(Number.isFinite(value) ? value : 0);
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(date);
  }

  private isoDate(value?: Date | null) {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private daysAgo(days: number, from = new Date()) {
    const date = new Date(from);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - days);
    return date;
  }

  private daysFromNow(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  private systemCoverageNotes() {
    return [
      "API failures and runtime error logs are written through Nest logging but are not persisted in a queryable SystemLog model yet.",
      "Failed login attempts are rejected by auth but not stored as dedicated security events yet.",
      "Audit reports use the existing AuditLog model for created, updated, and deleted record history."
    ];
  }

  private toCsvBuffer(columns: ReportColumn[], rows: Array<Record<string, string | number | null>>) {
    const headers = columns.map((column) => column.label);
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(
        columns
          .map((column) => {
            const raw = String(row[column.key] ?? "");
            return `"${raw.replaceAll('"', '""')}"`;
          })
          .join(",")
      );
    }
    return Buffer.from(lines.join("\n"), "utf8");
  }

  private async toXlsxBuffer(report: ReportModuleResponse) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MaintainPro";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Report");
    sheet.columns = report.table.columns.map((column) => ({ header: column.label, key: column.key, width: Math.max(14, column.label.length + 4) }));
    for (const row of report.table.rows) sheet.addRow(row);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async toPdfBuffer(report: ReportModuleResponse) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text(report.title, { continued: false });
      doc.moveDown(0.25);
      doc.fontSize(9).fillColor("#475569").text(`Generated ${new Date(report.generatedAt).toLocaleString()}`);
      doc.moveDown(0.75);
      doc.fillColor("#0f172a").fontSize(10).text(report.summaryCards.map((card) => `${card.label}: ${card.value}`).join("   "));
      doc.moveDown();

      const columns = report.table.columns.slice(0, 7);
      const rowHeight = 20;
      const startX = doc.x;
      let y = doc.y;
      const widths = columns.map(() => 105);
      doc.fontSize(8).fillColor("#0f172a");
      columns.forEach((column, index) => doc.text(column.label, startX + widths.slice(0, index).reduce((sum, item) => sum + item, 0), y, { width: widths[index] }));
      y += rowHeight;
      doc.moveTo(startX, y - 6).lineTo(startX + widths.reduce((sum, item) => sum + item, 0), y - 6).stroke("#cbd5e1");

      for (const row of report.table.rows.slice(0, 22)) {
        columns.forEach((column, index) => {
          doc.text(String(row[column.key] ?? ""), startX + widths.slice(0, index).reduce((sum, item) => sum + item, 0), y, { width: widths[index], ellipsis: true });
        });
        y += rowHeight;
        if (y > 520) break;
      }

      doc.end();
    });
  }
}