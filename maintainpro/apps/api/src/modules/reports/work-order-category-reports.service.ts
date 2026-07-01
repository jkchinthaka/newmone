import { Injectable } from "@nestjs/common";
import { Prisma, WorkOrderStatus } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

export type CategoryReportQuery = {
  dateFrom?: string;
  dateTo?: string;
  departmentId?: string;
  branchId?: string;
  categoryId?: string;
  typeId?: string;
  issueId?: string;
  status?: string;
  priority?: string;
  riskSeverity?: string;
};

@Injectable()
export class WorkOrderCategoryReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(actor: Actor, query: CategoryReportQuery): Prisma.WorkOrderWhereInput {
    const where: Prisma.WorkOrderWhereInput = {};
    if (actor.tenantId !== undefined) where.tenantId = actor.tenantId;
    if (query.categoryId) where.taxonomyCategoryId = query.categoryId;
    if (query.typeId) where.taxonomyTypeId = query.typeId;
    if (query.issueId) where.taxonomyIssueId = query.issueId;
    if (query.status && query.status !== "ALL") where.status = query.status as WorkOrderStatus;
    if (query.priority && query.priority !== "ALL") where.priority = query.priority as Prisma.EnumPriorityFilter;
    if (query.departmentId) where.asset = { departmentId: query.departmentId };
    if (query.branchId) where.assignees = { some: { employee: { branchName: query.branchId } } };
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {})
      };
    }
    return where;
  }

  async getCategorySummary(actor: Actor, query: CategoryReportQuery) {
    const where = this.buildWhere(actor, query);
    const rows = await this.prisma.workOrder.findMany({
      where,
      select: {
        id: true,
        status: true,
        isTriage: true,
        taxonomyCategoryId: true,
        categoryNameSnapshot: true,
        typeNameSnapshot: true,
        issueNameSnapshot: true,
        verificationStatus: true,
        parts: { select: { lineStatus: true, issuedQuantity: true, requestedQuantity: true } },
        evidenceAttachments: { where: { deletedAt: null }, select: { id: true, status: true } }
      }
    });

    const summaryMap = new Map<
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

    for (const row of rows) {
      const key = row.taxonomyCategoryId ?? row.categoryNameSnapshot ?? "Uncategorized";
      const label = row.categoryNameSnapshot ?? "Uncategorized";
      const bucket =
        summaryMap.get(key) ??
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
      if (row.status === WorkOrderStatus.OVERDUE) next.overdue += 1;
      if (row.status === WorkOrderStatus.COMPLETED) next.completed += 1;
      if (row.status === WorkOrderStatus.CANCELLED) next.cancelled += 1;
      if (row.status === WorkOrderStatus.TECHNICIAN_COMPLETED && row.verificationStatus === "PENDING") {
        next.supervisorVerificationPending += 1;
      }
      if (row.parts.some((line) => line.requestedQuantity > 0 && line.issuedQuantity === 0)) next.partsPending += 1;
      if (row.evidenceAttachments.length === 0 && row.status !== WorkOrderStatus.COMPLETED) next.evidenceMissing += 1;

      summaryMap.set(key, next);
    }

    return {
      categories: [...summaryMap.values()].sort((a, b) => b.total - a.total),
      triageCount: rows.filter((row) => row.isTriage).length,
      totalWorkOrders: rows.length,
      generatedAt: new Date().toISOString(),
      filters: query
    };
  }

  async exportCategorySummaryCsv(actor: Actor, query: CategoryReportQuery) {
    const summary = await this.getCategorySummary(actor, query);
    const header = [
      "Category",
      "Total",
      "Open",
      "In Progress",
      "Overdue",
      "Completed",
      "Cancelled",
      "Triage",
      "Evidence Missing",
      "Parts Pending",
      "Supervisor Verification Pending"
    ];
    const lines = summary.categories.map((row) =>
      [
        row.categoryName,
        row.total,
        row.open,
        row.inProgress,
        row.overdue,
        row.completed,
        row.cancelled,
        row.triage,
        row.evidenceMissing,
        row.partsPending,
        row.supervisorVerificationPending
      ].join(",")
    );

    const meta = [
      `# Report: Work Orders by Main Category`,
      `# Generated By: ${actor.email ?? actor.sub}`,
      `# Generated At: ${summary.generatedAt}`,
      `# Filters: ${JSON.stringify(query)}`
    ];

    const content = [...meta, header.join(","), ...lines].join("\n");
    return {
      filename: `work-orders-category-summary-${Date.now()}.csv`,
      contentType: "text/csv; charset=utf-8",
      content: Buffer.from(content, "utf8")
    };
  }

  async getTopIssues(actor: Actor, query: CategoryReportQuery, limit = 20) {
    const where = this.buildWhere(actor, query);
    const rows = await this.prisma.workOrder.groupBy({
      by: ["taxonomyIssueId", "issueNameSnapshot", "typeNameSnapshot", "categoryNameSnapshot"],
      where: { ...where, OR: [{ taxonomyIssueId: { not: null } }, { issueNameSnapshot: { not: null } }] },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: limit
    });

    return rows.map((row) => ({
      issueId: row.taxonomyIssueId,
      issueName: row.issueNameSnapshot ?? "Unknown issue",
      typeName: row.typeNameSnapshot,
      categoryName: row.categoryNameSnapshot,
      count: row._count._all
    }));
  }

  async getTriageReport(actor: Actor, query: CategoryReportQuery) {
    const where = this.buildWhere(actor, { ...query });
    const rows = await this.prisma.workOrder.findMany({
      where: { ...where, isTriage: true },
      select: {
        id: true,
        woNumber: true,
        title: true,
        description: true,
        createdAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        categoryNameSnapshot: true,
        typeNameSnapshot: true
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    const grouped = new Map<string, number>();
    for (const row of rows) {
      const key = row.description.trim().slice(0, 80).toLowerCase();
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }

    return {
      total: rows.length,
      items: rows,
      commonDescriptions: [...grouped.entries()]
        .map(([description, count]) => ({ description, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
    };
  }

  async getCategoryChanges(actor: Actor, query: CategoryReportQuery) {
    const tenantFilter = actor.tenantId !== undefined ? { tenantId: actor.tenantId } : {};
    const logs = await this.prisma.auditLog.findMany({
      where: {
        ...tenantFilter,
        entity: "WorkOrder",
        ...(query.dateFrom || query.dateTo
          ? {
              createdAt: {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {})
              }
            }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: 500
    });

    const items = logs.filter((log) => {
      const metadata = log.metadata as { event?: string } | null;
      return metadata?.event === "work_order_category_changed";
    });

    return {
      total: items.length,
      items: items.slice(0, 200).map((log) => ({
        id: log.id,
        workOrderId: log.entityId,
        reason: log.reason,
        changedAt: log.createdAt,
        beforeData: log.beforeData,
        afterData: log.afterData,
        actorId: log.actorId
      }))
    };
  }
}
