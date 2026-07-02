import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { metadataIndicatesOverride, FRAUD_AUDIT_EVENTS } from "../../common/utils/fraud-control.util";
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
  actorRole?: string | null;
  module?: string | null;
  action: string;
  entity: string;
  entityId: string;
  reason?: string | null;
  event?: string | null;
  workOrderId?: string | null;
  riskSeverity: RiskSeverity;
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

  async listAdminOverrides(
    actor: Actor,
    query: { dateFrom?: string; dateTo?: string; module?: string; limit?: number } = {}
  ) {
    const tenantId = actor.tenantId;
    const limit = Math.min(500, Math.max(1, Number(query.limit ?? 100)));
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

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(2000, limit * 5),
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } }
      }
    });

    const overrides = rows
      .filter((row) => metadataIndicatesOverride(row.metadata) || /override/i.test(row.reason ?? ""))
      .slice(0, limit)
      .map((row) => this.toAdminOverrideRow(row));

    return {
      rows: overrides,
      total: overrides.length,
      generatedAt: new Date().toISOString()
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
    actor?: { role?: { name: string } | null } | null;
  }): AdminOverrideRow {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
    const event = typeof metadata.event === "string" ? metadata.event : null;
    const workOrderId = typeof metadata.workOrderId === "string" ? metadata.workOrderId : null;
    const riskScore = event?.includes("gate") || event?.includes("invoice") ? 25 : 10;

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actorId: row.actorId,
      actorRole: row.actor?.role?.name ?? null,
      module: row.module,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      reason: row.reason,
      event,
      workOrderId,
      riskSeverity: resolveRiskSeverity(riskScore)
    };
  }
}
