import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";

import { rowsToCsv, writeAuditTrail } from "../../common/utils/audit-trail.util";
import { metadataIndicatesOverride, FRAUD_AUDIT_EVENTS } from "../../common/utils/fraud-control.util";
import { clampPageSize } from "../../common/utils/pagination.util";
import {
  cardSeverityFromCount,
  resolveRiskSeverity,
  type RiskSeverity
} from "../../common/utils/maintenance-risk-score";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { MaintenanceReportsService } from "../reports/maintenance-reports.service";
import type { MaintenanceExceptionType } from "../reports/maintenance-reports.types";
import { WorkOrderPartsService } from "../work-orders/work-order-parts.service";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

export type FraudDashboardAlert = {
  key: string;
  label: string;
  count: number;
  severity: RiskSeverity;
  module: string;
  actionOwner?: string;
  href?: string;
  lastUpdated: string;
};

export type AdminOverrideRow = {
  id: string;
  createdAt: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  module?: string | null;
  action: string;
  entity: string;
  entityId: string;
  reason?: string | null;
  event?: string | null;
  overrideType?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  source?: string | null;
  workOrderId?: string | null;
  riskSeverity: RiskSeverity;
};

export type AdminOverrideQuery = {
  dateFrom?: string;
  dateTo?: string;
  module?: string;
  actorId?: string;
  role?: string;
  overrideType?: string;
  riskSeverity?: RiskSeverity;
  branch?: string;
  departmentId?: string;
  limit?: number;
};

@Injectable()
export class FraudControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly maintenanceReports: MaintenanceReportsService,
    private readonly workOrderPartsService: WorkOrderPartsService
  ) {}

  async getDashboard(actor: Actor) {
    const tenantId = actor.tenantId;
    const summary = await this.maintenanceReports.getExceptionsSummary(actor, {});
    const partsExceptions = await this.workOrderPartsService.getPartsExceptions(actor);
    const now = new Date().toISOString();

    const fraudTypes: Array<{ key: MaintenanceExceptionType | string; label: string; module: string; href: string }> =
      [
        { key: "duplicate-part-requests", label: "Duplicate part requests", module: "parts", href: "/reports/maintenance-exceptions" },
        { key: "parts-issued-not-completed", label: "Parts issued, job not completed", module: "parts", href: "/reports/fraud-control/parts-misuse" },
        { key: "pending-part-returns", label: "Pending part returns", module: "parts", href: "/reports/fraud-control/parts-misuse" },
        { key: "completed-without-evidence", label: "Completed without evidence", module: "evidence", href: "/reports/maintenance-exceptions" },
        { key: "qr-mismatch", label: "QR mismatch", module: "evidence", href: "/reports/maintenance-exceptions" },
        { key: "closed-without-supervisor-verification", label: "Closed without supervisor verification", module: "governance", href: "/reports/maintenance-exceptions" },
        { key: "vendor-repair-without-quotation", label: "Vendor repair without quotation", module: "vendor", href: "/reports/maintenance-exceptions" },
        { key: "duplicate-vendor-invoice", label: "Duplicate vendor invoice attempts", module: "finance", href: "/reports/maintenance-exceptions" },
        { key: "invoice-exceeds-quotation", label: "Invoice exceeds quotation", module: "finance", href: "/reports/maintenance-exceptions" },
        { key: "same-user-vendor-approval", label: "Same-user vendor approval attempts", module: "finance", href: "/reports/maintenance-exceptions" },
        { key: "emergency-vendor-override", label: "Emergency vendor overrides", module: "vendor", href: "/reports/fraud-control/admin-overrides" },
        { key: "parts-issue-without-work-order", label: "Parts issue without work order attempts", module: "parts", href: "/reports/fraud-control/parts-misuse" }
      ];

    const cards = summary.cards ?? [];
    const alerts: FraudDashboardAlert[] = fraudTypes.map((entry) => {
      const card = cards.find((item) => item.type === entry.key);
      const count =
        entry.key === "parts-issue-without-work-order"
          ? partsExceptions.partsIssuedWithoutWorkOrderAttempt ?? 0
          : card?.count ?? 0;
      return {
        key: entry.key,
        label: entry.label,
        count,
        severity: card?.severity ?? cardSeverityFromCount(entry.key, count),
        module: entry.module,
        actionOwner: entry.module === "finance" ? "FINANCE" : entry.module === "parts" ? "INVENTORY_KEEPER" : "SUPERVISOR",
        href: entry.href,
        lastUpdated: card?.lastUpdated ?? now
      };
    });

    const blockedAttempts = await this.countAuditEvents(actor, [
      FRAUD_AUDIT_EVENTS.PARTS_ISSUE_BLOCKED_NO_WORK_ORDER,
      FRAUD_AUDIT_EVENTS.MAKER_CHECKER_VIOLATION_BLOCKED,
      FRAUD_AUDIT_EVENTS.GATE_OUT_BLOCKED,
      FRAUD_AUDIT_EVENTS.INVOICE_APPROVAL_BLOCKED_UNVERIFIED
    ]);

    return {
      alerts: alerts.filter((alert) => alert.count > 0).sort((a, b) => b.count - a.count),
      summary: {
        totalAlerts: alerts.reduce((sum, alert) => sum + alert.count, 0),
        blockedAttempts,
        highSeverity: alerts.filter((alert) => alert.severity === "HIGH" || alert.severity === "CRITICAL").length
      },
      disclaimer:
        "Rule-based operational fraud and control indicators — not AI fraud detection. All sensitive actions require backend audit trails.",
      generatedAt: now
    };
  }

  async listAdminOverrides(actor: Actor, query: AdminOverrideQuery = {}) {
    const overrides = await this.loadAdminOverrides(actor, query);
    return {
      rows: overrides,
      total: overrides.length,
      generatedAt: new Date().toISOString(),
      filtersApplied: this.overrideFiltersSnapshot(query)
    };
  }

  async exportAdminOverrides(actor: Actor, query: AdminOverrideQuery = {}) {
    const rows = await this.loadAdminOverrides(actor, query);
    if (rows.length === 0) {
      throw new BadRequestException("No admin override rows available to export for the selected filters.");
    }

    const csv = rowsToCsv(
      [
        "id",
        "createdAt",
        "actorId",
        "actorName",
        "actorRole",
        "module",
        "action",
        "entity",
        "entityId",
        "overrideType",
        "reason",
        "previousValue",
        "newValue",
        "source",
        "workOrderId",
        "riskSeverity"
      ],
      rows as unknown as Record<string, unknown>[],
      [
        "Report: admin-overrides",
        `Generated at: ${new Date().toISOString()}`,
        `Generated by: ${actor.email ?? actor.sub ?? "unknown"}`,
        `Filters: ${JSON.stringify(this.overrideFiltersSnapshot(query))}`
      ]
    );

    await writeAuditTrail(this.prisma, {
      actor,
      entity: "report",
      entityId: "admin-overrides",
      action: AuditAction.UPDATE,
      module: "fraud-control",
      reason: "report_exported",
      metadata: {
        event: "report_exported",
        reportKey: "admin-overrides",
        rowCount: rows.length,
        filters: this.overrideFiltersSnapshot(query)
      }
    });

    return {
      filename: `admin-overrides-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content: csv
    };
  }

  private async loadAdminOverrides(actor: Actor, query: AdminOverrideQuery): Promise<AdminOverrideRow[]> {
    const tenantId = actor.tenantId;
    const limit = clampPageSize(query.limit ?? 100, 100, 500);
    const where: Prisma.AuditLogWhereInput = {
      ...(tenantId !== undefined ? { tenantId } : {})
    };

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {})
      };
    }

    if (query.module) {
      where.module = query.module;
    }
    if (query.actorId) {
      where.actorId = query.actorId;
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(2000, limit * 5),
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } }
      }
    });

    return rows
      .filter((row) => metadataIndicatesOverride(row.metadata) || /override/i.test(row.reason ?? ""))
      .map((row) => this.toAdminOverrideRow(row))
      .filter((row) => {
        if (query.role && row.actorRole !== query.role) return false;
        if (query.overrideType && row.overrideType !== query.overrideType) return false;
        if (query.riskSeverity && row.riskSeverity !== query.riskSeverity) return false;
        return true;
      })
      .slice(0, limit);
  }

  private overrideFiltersSnapshot(query: AdminOverrideQuery) {
    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      module: query.module,
      actorId: query.actorId,
      role: query.role,
      overrideType: query.overrideType,
      riskSeverity: query.riskSeverity,
      branch: query.branch,
      departmentId: query.departmentId
    };
  }

  async listPartsMisuse(actor: Actor) {
    const partsExceptions = await this.workOrderPartsService.getPartsExceptions(actor);
    const summary = await this.maintenanceReports.getExceptionsSummary(actor, {});
    const relevant = (summary.cards ?? []).filter((card) =>
      [
        "parts-issued-not-completed",
        "parts-not-accounted",
        "pending-part-returns",
        "duplicate-part-requests",
        "high-cost-part-issues"
      ].includes(card.type)
    );

    return {
      metrics: partsExceptions,
      cards: relevant,
      riskNotes: [
        "+25 parts issued without WO attempt",
        "+20 unaccounted high-value parts",
        "+15 duplicate request",
        "+15 issued after completion",
        "+15 pending return overdue"
      ],
      disclaimer:
        "Parts misuse indicators are rule-based counts from work order parts governance — not AI fraud detection.",
      generatedAt: new Date().toISOString()
    };
  }

  private async countAuditEvents(actor: Actor, events: string[]) {
    const tenantId = actor.tenantId;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(tenantId !== undefined ? { tenantId } : {}),
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      select: { metadata: true },
      take: 5000
    });

    return rows.filter((row) => {
      const event =
        row.metadata && typeof row.metadata === "object" && "event" in row.metadata
          ? String((row.metadata as Record<string, unknown>).event ?? "")
          : "";
      return events.includes(event);
    }).length;
  }

  private toAdminOverrideRow(row: {
    id: string;
    createdAt: Date;
    actorId: string | null;
    module: string | null;
    action: string;
    entity: string;
    entityId: string;
    reason: string | null;
    metadata: Prisma.JsonValue | null;
    beforeData: Prisma.JsonValue | null;
    afterData: Prisma.JsonValue | null;
    requestPath: string | null;
    actor?: { firstName?: string; lastName?: string; role?: { name: string } | null } | null;
  }): AdminOverrideRow {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
    const event = typeof metadata.event === "string" ? metadata.event : null;
    const workOrderId = typeof metadata.workOrderId === "string" ? metadata.workOrderId : null;
    const overrideType =
      (typeof metadata.overrideType === "string" ? metadata.overrideType : null) ?? event ?? "override";
    const source = typeof metadata.source === "string" ? metadata.source : row.requestPath ? "WEB" : "API";
    const riskSeverity =
      typeof metadata.riskSeverity === "string"
        ? (metadata.riskSeverity as RiskSeverity)
        : resolveRiskSeverity(event?.includes("gate") || event?.includes("invoice") ? 25 : 10);
    const actorName = row.actor
      ? `${row.actor.firstName ?? ""} ${row.actor.lastName ?? ""}`.trim() || null
      : null;

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actorId: row.actorId,
      actorName,
      actorRole: row.actor?.role?.name ?? null,
      module: row.module,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      reason: row.reason,
      event,
      overrideType,
      previousValue: row.beforeData ? JSON.stringify(row.beforeData) : null,
      newValue: row.afterData ? JSON.stringify(row.afterData) : null,
      source,
      workOrderId,
      riskSeverity
    };
  }
}
