import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationPriority, NotificationType, WorkOrderStatus } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { NotificationsService } from "./notifications.service";

/**
 * Reminders nobody has to remember to send. Runs every interval (default hourly); each reminder
 * carries a per-day dedupe key, so people get it at most once a day:
 * - jobs past their time limit (assigned technician per job, managers one summary);
 * - requests waiting for review for more than a day (reviewers, one summary);
 * - work permits that expire within a day or already expired while still open (raiser + approver);
 * - vehicle documents (insurance, licence, ...) that expire within 30 days or have expired.
 */
const OVERDUE_JOB_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.PLANNED,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.REWORK_REQUIRED,
  WorkOrderStatus.OVERDUE
];
const REVIEW_WAIT_STATUSES = ["NEW", "UNDER_REVIEW", "NEEDS_INFORMATION"];
const MANAGER_ROLES = ["ADMIN", "MANAGER", "SUPER_ADMIN"];
const FLEET_ROLES = ["ADMIN", "MANAGER", "FLEET_MANAGER", "TRANSPORT_MANAGER"];
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_DOCUMENT_STATUSES = new Set(["REPLACED", "SUPERSEDED", "REJECTED", "ARCHIVED", "CANCELLED", "RENEWED"]);

export function reminderDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Only the newest document of each vehicle + type counts; a renewed one hides the old expiry. */
export function latestVehicleDocuments<T extends { vehicleId: string; documentType: string; expiryDate: Date; status?: string | null }>(
  documents: T[]
): T[] {
  const latest = new Map<string, T>();
  for (const document of documents) {
    if (CLOSED_DOCUMENT_STATUSES.has(String(document.status ?? "").toUpperCase())) continue;
    const key = `${document.vehicleId}:${document.documentType.toUpperCase()}`;
    const current = latest.get(key);
    if (!current || document.expiryDate > current.expiryDate) latest.set(key, document);
  }
  return [...latest.values()];
}

export function vehicleDocumentNotificationType(documentType: string): NotificationType {
  return /INSUR/i.test(documentType) ? NotificationType.INSURANCE_EXPIRY : NotificationType.LICENSE_EXPIRY;
}

@Injectable()
export class DailyRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyRemindersService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService
  ) {}

  onModuleInit(): void {
    const enabled = String(this.config?.get<string>("DAILY_REMINDERS_ENABLED") ?? "true").toLowerCase() !== "false";
    if (!enabled || process.env.NODE_ENV === "test") return;
    const minutes = Number(this.config?.get<number>("DAILY_REMINDERS_INTERVAL_MINUTES") ?? 60);
    const intervalMs = Math.max(5, Number.isFinite(minutes) ? minutes : 60) * 60_000;
    const first = setTimeout(() => void this.runOnce(), 90_000);
    first.unref?.();
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(now = new Date()): Promise<Record<string, number>> {
    if (this.running) return {};
    this.running = true;
    const sent: Record<string, number> = { overdueJobs: 0, waitingRequests: 0, permits: 0, vehicleDocuments: 0 };
    try {
      sent.overdueJobs = await this.safe("overdue jobs", () => this.overdueJobs(now));
      sent.waitingRequests = await this.safe("waiting requests", () => this.waitingRequests(now));
      sent.permits = await this.safe("permits", () => this.expiringPermits(now));
      sent.vehicleDocuments = await this.safe("vehicle documents", () => this.vehicleDocuments(now));
    } finally {
      this.running = false;
    }
    return sent;
  }

  private async safe(label: string, run: () => Promise<number>) {
    try {
      return await run();
    } catch (error) {
      this.logger.warn(`Reminder sweep (${label}) failed: ${(error as Error)?.message ?? "unknown"}`);
      return 0;
    }
  }

  private async usersWithRoles(tenantId: string, roles: string[]): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { tenantId, isActive: true, role: { name: { in: roles as never } } },
      select: { id: true },
      take: 50
    });
    return rows.map((row) => row.id);
  }

  private async send(input: {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    referenceType?: string;
    referenceId?: string;
    dedupeKey: string;
    priority?: NotificationPriority;
  }): Promise<number> {
    const created = await this.notifications
      .createNotification({ ...input, priority: input.priority ?? NotificationPriority.WARNING, channel: "IN_APP" })
      .catch(() => null);
    return created ? 1 : 0;
  }

  private async overdueJobs(now: Date): Promise<number> {
    const day = reminderDay(now);
    const jobs = await this.prisma.workOrder.findMany({
      where: {
        status: { in: OVERDUE_JOB_STATUSES },
        OR: [{ slaDeadline: { lt: now } }, { slaDeadline: null, dueDate: { lt: now } }]
      },
      select: { id: true, tenantId: true, woNumber: true, title: true, technicianId: true },
      take: 2000
    });
    let count = 0;
    const byTenant = new Map<string, number>();
    for (const job of jobs) {
      if (!job.tenantId) continue;
      byTenant.set(job.tenantId, (byTenant.get(job.tenantId) ?? 0) + 1);
      if (job.technicianId) {
        count += await this.send({
          userId: job.technicianId,
          title: "Job past its time limit",
          message: `${job.woNumber} (${job.title}) is past its time limit. Finish it or tell your supervisor why it is late.`,
          type: NotificationType.SLA_BREACH_WARNING,
          referenceType: "WorkOrder",
          referenceId: job.id,
          dedupeKey: `reminder:wo-overdue:${job.id}:${day}`
        });
      }
    }
    for (const [tenantId, total] of byTenant) {
      for (const userId of await this.usersWithRoles(tenantId, MANAGER_ROLES)) {
        count += await this.send({
          userId,
          title: "Jobs past their time limit",
          message: `${total} job${total === 1 ? " is" : "s are"} past the time limit. Open Jobs and sort by due date.`,
          type: NotificationType.MAINTENANCE_OVERDUE,
          dedupeKey: `reminder:wo-overdue-summary:${tenantId}:${day}`
        });
      }
    }
    return count;
  }

  private async waitingRequests(now: Date): Promise<number> {
    const day = reminderDay(now);
    const rows = await this.prisma.maintenanceRequest.findMany({
      where: { status: { in: REVIEW_WAIT_STATUSES as never }, reportedAt: { lt: new Date(now.getTime() - DAY_MS) } },
      select: { tenantId: true },
      take: 5000
    });
    const byTenant = new Map<string, number>();
    for (const row of rows) if (row.tenantId) byTenant.set(row.tenantId, (byTenant.get(row.tenantId) ?? 0) + 1);
    let count = 0;
    for (const [tenantId, total] of byTenant) {
      for (const userId of await this.usersWithRoles(tenantId, MANAGER_ROLES)) {
        count += await this.send({
          userId,
          title: "Requests waiting for review",
          message: `${total} reported issue${total === 1 ? " has" : "s have"} been waiting more than a day for review.`,
          type: NotificationType.WORK_ORDER_UPDATED,
          dedupeKey: `reminder:requests-waiting:${tenantId}:${day}`
        });
      }
    }
    return count;
  }

  private async expiringPermits(now: Date): Promise<number> {
    const day = reminderDay(now);
    const permits = await this.prisma.workPermit.findMany({
      where: { status: { in: ["APPROVED", "ACTIVE"] }, validTo: { not: null, lt: new Date(now.getTime() + DAY_MS) } },
      select: { id: true, tenantId: true, permitNumber: true, validTo: true, issuedById: true, approvedById: true },
      take: 1000
    });
    let count = 0;
    for (const permit of permits) {
      const expired = Boolean(permit.validTo && permit.validTo.getTime() <= now.getTime());
      const recipients = new Set([permit.issuedById, permit.approvedById].filter((id): id is string => Boolean(id)));
      for (const userId of recipients) {
        count += await this.send({
          userId,
          title: expired ? "Work permit expired" : "Work permit expires soon",
          message: expired
            ? `${permit.permitNumber} has expired but is still open. Close it, or raise a new permit to keep working.`
            : `${permit.permitNumber} expires within a day. Raise a new permit if the work continues.`,
          type: NotificationType.SYSTEM_ALERT,
          referenceType: "WorkPermit",
          referenceId: permit.id,
          dedupeKey: `reminder:permit:${permit.id}:${expired ? "expired" : "soon"}:${day}`
        });
      }
    }
    return count;
  }

  private async vehicleDocuments(now: Date): Promise<number> {
    const day = reminderDay(now);
    const documents = await this.prisma.vehicleDocument.findMany({
      where: { expiryDate: { lt: new Date(now.getTime() + 30 * DAY_MS) } },
      select: {
        id: true,
        tenantId: true,
        vehicleId: true,
        documentType: true,
        expiryDate: true,
        status: true,
        vehicle: { select: { registrationNo: true } }
      },
      take: 5000
    });
    // A renewed document (newer expiry) for the same vehicle and type hides the old one.
    const renewed = await this.prisma.vehicleDocument.findMany({
      where: { vehicleId: { in: [...new Set(documents.map((doc) => doc.vehicleId))] } },
      select: { id: true, tenantId: true, vehicleId: true, documentType: true, expiryDate: true, status: true },
      take: 20000
    });
    const latestIds = new Set(latestVehicleDocuments(renewed).map((doc) => doc.id));
    let count = 0;
    for (const document of documents) {
      if (!document.tenantId || !latestIds.has(document.id)) continue;
      const expired = document.expiryDate.getTime() <= now.getTime();
      const label = document.documentType.replace(/_/g, " ").toLowerCase();
      for (const userId of await this.usersWithRoles(document.tenantId, FLEET_ROLES)) {
        count += await this.send({
          userId,
          title: expired ? "Vehicle document expired" : "Vehicle document expires soon",
          message: `${document.vehicle?.registrationNo ?? "Vehicle"}: ${label} ${
            expired ? "has expired" : `expires on ${reminderDay(document.expiryDate)}`
          }.`,
          type: vehicleDocumentNotificationType(document.documentType),
          referenceType: "Vehicle",
          referenceId: document.vehicleId,
          // Weekly until it expires, then daily.
          dedupeKey: expired
            ? `reminder:vehicle-doc:${document.id}:expired:${day}`
            : `reminder:vehicle-doc:${document.id}:soon:${day.slice(0, 8)}${Math.floor(now.getUTCDate() / 7)}`
        });
      }
    }
    return count;
  }
}
