import { Injectable, Logger, Optional } from "@nestjs/common";
import { NotificationPriority, NotificationType, Prisma, RoleName } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { policyMessage } from "../policies/policy-codes";

export type DomainEventType =
  | "MAINTENANCE_DUE_SOON"
  | "MAINTENANCE_OVERDUE"
  | "CRITICAL_WORK_ORDER"
  | "WORK_ORDER_SLA_WARNING"
  | "WORK_ORDER_SLA_BREACH"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "FORECAST_SHORTAGE"
  | "COMPLIANCE_EXPIRING"
  | "COMPLIANCE_EXPIRED"
  | "ERP_SYNC_FAILED"
  | "RECONCILIATION_VARIANCE"
  | "GATE_BLOCKED"
  | "GATE_OVERRIDE_USED"
  | "QA_PENDING"
  | "WARRANTY_CLAIM_POSSIBLE"
  | "REPEAT_FAILURE"
  | "DATA_QUALITY_EXCEPTION";

export type DomainEvent = {
  type: DomainEventType;
  tenantId: string;
  entityType: string;
  entityId: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  metadata?: Record<string, unknown>;
  cooldownHours?: number;
};

const EVENT_TO_TYPE: Record<DomainEventType, NotificationType> = {
  MAINTENANCE_DUE_SOON: NotificationType.MAINTENANCE_DUE,
  MAINTENANCE_OVERDUE: NotificationType.MAINTENANCE_OVERDUE,
  CRITICAL_WORK_ORDER: NotificationType.CRITICAL_WORK_ORDER,
  WORK_ORDER_SLA_WARNING: NotificationType.SLA_BREACH_WARNING,
  WORK_ORDER_SLA_BREACH: NotificationType.SLA_BREACH_WARNING,
  LOW_STOCK: NotificationType.LOW_STOCK,
  OUT_OF_STOCK: NotificationType.OUT_OF_STOCK,
  FORECAST_SHORTAGE: NotificationType.FORECAST_SHORTAGE,
  COMPLIANCE_EXPIRING: NotificationType.INSURANCE_EXPIRY,
  COMPLIANCE_EXPIRED: NotificationType.COMPLIANCE_EXPIRED,
  ERP_SYNC_FAILED: NotificationType.ERP_SYNC_FAILED,
  RECONCILIATION_VARIANCE: NotificationType.RECONCILIATION_VARIANCE,
  GATE_BLOCKED: NotificationType.GATE_BLOCKED,
  GATE_OVERRIDE_USED: NotificationType.GATE_OVERRIDE_USED,
  QA_PENDING: NotificationType.QA_PENDING,
  WARRANTY_CLAIM_POSSIBLE: NotificationType.WARRANTY_CLAIM_POSSIBLE,
  REPEAT_FAILURE: NotificationType.REPEAT_FAILURE,
  DATA_QUALITY_EXCEPTION: NotificationType.DATA_QUALITY_EXCEPTION
};

@Injectable()
export class DomainNotificationService {
  private readonly logger = new Logger(DomainNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService
  ) {}

  slaWarningPct(): number {
    return Number(process.env.ENTERPRISE_SLA_WARNING_PCT ?? 75);
  }

  slaBreachPct(): number {
    return Number(process.env.ENTERPRISE_SLA_BREACH_PCT ?? 100);
  }

  slaEscalatePct(): number {
    return Number(process.env.ENTERPRISE_SLA_ESCALATE_PCT ?? 125);
  }

  slaStage(elapsedMs: number, slaMs: number): DomainEventType | null {
    if (!Number.isFinite(slaMs) || slaMs <= 0) {
      return null;
    }
    const pct = (elapsedMs / slaMs) * 100;
    if (pct >= this.slaEscalatePct() || pct >= this.slaBreachPct()) {
      return "WORK_ORDER_SLA_BREACH";
    }
    if (pct >= this.slaWarningPct()) {
      return "WORK_ORDER_SLA_WARNING";
    }
    return null;
  }

  async emit(event: DomainEvent): Promise<number> {
    if (!this.notifications) {
      return 0;
    }
    const recipients = await this.resolveRecipients(event.tenantId, event.type);
    const day = new Date().toISOString().slice(0, 10);
    const cooldown = event.cooldownHours ?? (event.severity === "CRITICAL" ? 72 : 24);
    const bucket = event.severity === "CRITICAL" ? "open" : `${day}:${cooldown}`;
    const dedupeKey = `ent:${event.tenantId}:${event.type}:${event.entityId}:${bucket}`;
    const type = EVENT_TO_TYPE[event.type];
    const title = event.type.replaceAll("_", " ");
    const message = policyMessage(event.type) === "Action is not permitted" ? title : policyMessage(event.type);
    let sent = 0;
    for (const userId of recipients) {
      try {
        await this.notifications.createNotification({
          userId,
          title,
          message,
          type,
          priority: event.severity === "CRITICAL" ? NotificationPriority.CRITICAL : NotificationPriority.WARNING,
          referenceId: event.entityId,
          referenceType: event.entityType,
          metadata: event.metadata as Prisma.InputJsonValue,
          dedupeKey
        });
        sent += 1;
      } catch (error) {
        this.logger.warn(`Notification emit failed for ${event.type}: ${error instanceof Error ? error.message : "unknown"}`);
      }
    }
    return sent;
  }

  private async resolveRecipients(tenantId: string, type: DomainEventType): Promise<string[]> {
    const roles: RoleName[] = [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGER, RoleName.OPERATIONS_MANAGER];
    if (type === "LOW_STOCK" || type === "OUT_OF_STOCK" || type === "FORECAST_SHORTAGE") {
      roles.push(RoleName.INVENTORY_KEEPER);
    }
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { name: { in: roles } }
      },
      select: { id: true },
      take: 50
    });
    return users.map((user) => user.id);
  }
}
