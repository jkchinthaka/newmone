import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import {
  AppSettingScope,
  NotificationPriority,
  NotificationType,
  Priority,
  Prisma,
  WorkOrderType
} from "@prisma/client";
import { Queue } from "bull";

import { PrismaService } from "../../database/prisma.service";
import { NotificationsGateway } from "./notifications.gateway";

export interface NotificationPreference {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
}

export interface NotificationRuleSet {
  mutedTypes: NotificationType[];
  onlyCritical: boolean;
  emailOnlyOverdue: boolean;
}

export type NotificationActionType =
  | "ACKNOWLEDGE"
  | "SCHEDULE_TASK"
  | "CREATE_WORK_ORDER"
  | "ASSIGN_USER";

type NotificationQuery = {
  status?: "ALL" | "READ" | "UNREAD";
  type?: string;
  priority?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  includeAnalytics?: boolean;
};

type NotificationAction = {
  action: NotificationActionType;
  payload?: Record<string, unknown>;
};

type NotificationInput = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  channel?: "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
  referenceId?: string;
  referenceType?: string;
  dueAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
  dedupeKey?: string;
};

type EnrichedNotification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  isRead: boolean;
  readAt: Date | null;
  acknowledgedAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
  module: "maintenance" | "fleet" | "utilities" | "cleaning" | "inventory" | "system";
  deepLink: string;
  context: {
    entityType: string | null;
    entityId: string | null;
    entityName: string | null;
    deadline: Date | null;
    preview: string | null;
    data: Record<string, unknown>;
  };
  preview: string;
  overdue: boolean;
  slaRemainingSeconds: number | null;
  referenceId: string | null;
  referenceType: string | null;
  metadata: Prisma.JsonValue | null;
  actions: Array<{ key: NotificationActionType; label: string }>;
};

const DEFAULT_PREFERENCES: NotificationPreference = {
  inApp: true,
  email: true,
  sms: false,
  whatsapp: false,
  push: true
};

const DEFAULT_RULES: NotificationRuleSet = {
  mutedTypes: [],
  onlyCritical: false,
  emailOnlyOverdue: false
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    @InjectQueue("notifications") private readonly notificationsQueue: Queue
  ) {}

  async findAll(userId: string, query: NotificationQuery) {
    const page = Number.isFinite(query.page) && query.page && query.page > 0 ? query.page : 1;
    const pageSize = Math.min(
      100,
      Number.isFinite(query.pageSize) && query.pageSize && query.pageSize > 0 ? query.pageSize : 20
    );

    const where: Prisma.NotificationWhereInput = {
      userId
    };

    if (query.status === "READ") {
      where.isRead = true;
    }

    if (query.status === "UNREAD") {
      where.isRead = false;
    }

    const parsedTypes = this.parseNotificationTypes(query.type);
    if (parsedTypes.length > 0) {
      where.type = { in: parsedTypes };
    }

    const parsedPriorities = this.parsePriorities(query.priority);
    if (parsedPriorities.length > 0) {
      where.priority = { in: parsedPriorities };
    }

    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { message: { contains: term, mode: "insensitive" } }
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.notification.count({ where })
    ]);

    const items = await Promise.all(rows.map((row) => this.enrichNotification(row)));

    return {
      items,
      pagination: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      },
      analytics: query.includeAnalytics ? await this.getNotificationAnalytics(userId) : null,
      dailySummary: await this.getAiDailySummary(userId)
    };
  }

  async markRead(userId: string, id: string) {
    await this.requireNotification(userId, id);

    const notification = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    const enriched = await this.enrichNotification(notification);
    this.notificationsGateway.emitMarkRead(notification.userId, enriched);

    await this.notificationsQueue.add("send", {
      channel: "IN_APP",
      userId: notification.userId,
      message: `Notification ${notification.id} marked as read`
    });

    return enriched;
  }

  async markAllRead(userId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    this.notificationsGateway.emitMarkRead(userId, { markAllRead: true, updated: updated.count });

    await this.notificationsQueue.add("send", {
      channel: "IN_APP",
      userId,
      message: "All notifications marked as read"
    });

    return { updated: updated.count };
  }

  async acknowledge(userId: string, id: string) {
    await this.requireNotification(userId, id);

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        isRead: true,
        readAt: new Date()
      }
    });

    const enriched = await this.enrichNotification(updated);
    this.notificationsGateway.emitMarkRead(userId, enriched);
    return enriched;
  }

  async runAction(
    userId: string,
    id: string,
    actorId: string,
    actionRequest: NotificationAction
  ) {
    const notification = await this.requireNotification(userId, id);

    let result: unknown;

    switch (actionRequest.action) {
      case "ACKNOWLEDGE":
        result = await this.acknowledge(userId, id);
        break;
      case "SCHEDULE_TASK":
        result = await this.scheduleTask(notification, actorId, actionRequest.payload ?? {});
        await this.acknowledge(userId, id);
        break;
      case "CREATE_WORK_ORDER":
        result = await this.createWorkOrderFromNotification(
          notification,
          actorId,
          actionRequest.payload ?? {}
        );
        await this.acknowledge(userId, id);
        break;
      case "ASSIGN_USER":
        result = await this.assignUserFromNotification(notification, actionRequest.payload ?? {});
        await this.acknowledge(userId, id);
        break;
      default:
        throw new BadRequestException("Unsupported notification action");
    }

    return {
      action: actionRequest.action,
      result
    };
  }

  async explain(userId: string, id: string) {
    const notification = await this.requireNotification(userId, id);
    const enriched = await this.enrichNotification(notification);

    const whyItMatters =
      enriched.priority === NotificationPriority.CRITICAL
        ? "This is critical and can lead to operational disruption or SLA breach if ignored."
        : enriched.priority === NotificationPriority.WARNING
          ? "This requires attention soon to prevent escalation."
          : "This is informational and helps maintain awareness.";

    return {
      whatHappened: enriched.preview,
      whyItMatters,
      recommendedActions: enriched.actions.map((item) => item.label),
      priority: enriched.priority,
      module: enriched.module
    };
  }

  async getAiDailySummary(userId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [todayTotal, todayCritical, overdueOpen] = await Promise.all([
      this.prisma.notification.count({
        where: {
          userId,
          createdAt: { gte: start }
        }
      }),
      this.prisma.notification.count({
        where: {
          userId,
          createdAt: { gte: start },
          priority: NotificationPriority.CRITICAL
        }
      }),
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
          dueAt: { lt: new Date() }
        }
      })
    ]);

    const recommendations: string[] = [];

    if (todayCritical > 0) {
      recommendations.push("Prioritize critical alerts and assign owners immediately.");
    }
    if (overdueOpen > 0) {
      recommendations.push("Resolve overdue items to avoid SLA breaches.");
    }
    if (recommendations.length === 0) {
      recommendations.push("No urgent issues detected. Continue monitoring module health.");
    }

    return {
      text: `Today: ${todayTotal} alerts, ${overdueOpen} overdue, ${todayCritical} critical.`,
      todayTotal,
      overdueOpen,
      critical: todayCritical,
      recommendations
    };
  }

  async getNotificationAnalytics(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      select: {
        type: true,
        priority: true,
        isRead: true,
        createdAt: true,
        readAt: true,
        referenceType: true
      }
    });

    const typeTotals: Record<string, number> = {};
    const moduleTotals: Record<string, number> = {};
    const priorityTotals: Record<string, number> = {};

    let responseCount = 0;
    let responseMinutesTotal = 0;

    for (const item of notifications) {
      typeTotals[item.type] = (typeTotals[item.type] ?? 0) + 1;
      priorityTotals[item.priority] = (priorityTotals[item.priority] ?? 0) + 1;

      const module = this.resolveModule(item.type, item.referenceType);
      moduleTotals[module] = (moduleTotals[module] ?? 0) + 1;

      if (item.readAt) {
        const diff = item.readAt.getTime() - item.createdAt.getTime();
        if (diff >= 0) {
          responseMinutesTotal += Math.round(diff / 60000);
          responseCount += 1;
        }
      }
    }

    const mostFrequentAlerts = Object.entries(typeTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      total: notifications.length,
      moduleTotals,
      typeTotals,
      priorityTotals,
      mostFrequentAlerts,
      averageResponseMinutes:
        responseCount > 0 ? Math.round(responseMinutesTotal / responseCount) : null
    };
  }

  async getPreferences(userId: string): Promise<NotificationPreference> {
    const setting = await this.getUserSetting<NotificationPreference>(
      userId,
      "notifications.preferences"
    );

    return {
      ...DEFAULT_PREFERENCES,
      ...(setting ?? {})
    };
  }

  async updatePreferences(userId: string, data: Partial<NotificationPreference>) {
    const current = await this.getPreferences(userId);

    const merged = {
      ...current,
      ...data
    };

    await this.setUserSetting(userId, "notifications.preferences", merged);

    this.notificationsGateway.emitMarkRead(userId, {
      preferencesUpdated: true,
      preferences: merged
    });

    return merged;
  }

  async getRules(userId: string): Promise<NotificationRuleSet> {
    const setting = await this.getUserSetting<NotificationRuleSet>(userId, "notifications.rules");
    const merged = {
      ...DEFAULT_RULES,
      ...(setting ?? {})
    };

    const validTypes = Object.values(NotificationType);
    merged.mutedTypes = (merged.mutedTypes ?? []).filter((type) => validTypes.includes(type));

    return merged;
  }

  async updateRules(userId: string, data: Partial<NotificationRuleSet>) {
    const current = await this.getRules(userId);
    const merged: NotificationRuleSet = {
      ...current,
      ...data,
      mutedTypes: (data.mutedTypes ?? current.mutedTypes).filter((type) =>
        Object.values(NotificationType).includes(type)
      )
    };

    await this.setUserSetting(userId, "notifications.rules", merged);

    this.notificationsGateway.emitMarkRead(userId, {
      rulesUpdated: true,
      rules: merged
    });

    return merged;
  }

  async createNotification(input: NotificationInput) {
    const preferences = await this.getPreferences(input.userId);
    const rules = await this.getRules(input.userId);

    const priority = input.priority ?? this.defaultPriorityForType(input.type);

    if (!preferences.inApp) {
      return null;
    }

    if (rules.onlyCritical && priority !== NotificationPriority.CRITICAL) {
      return null;
    }

    if (rules.mutedTypes.includes(input.type)) {
      return null;
    }

    if (input.dedupeKey) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: input.userId,
          dedupeKey: input.dedupeKey
        }
      });

      if (existing) {
        return this.enrichNotification(existing);
      }
    }

    const created = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        priority,
        channel: input.channel ?? "IN_APP",
        referenceId: input.referenceId,
        referenceType: input.referenceType,
        dueAt: input.dueAt ?? undefined,
        metadata: input.metadata,
        dedupeKey: input.dedupeKey
      }
    });

    const enriched = await this.enrichNotification(created);
    this.notificationsGateway.emitToUser(input.userId, enriched);

    await this.notificationsQueue.add("send", {
      channel: input.channel ?? "IN_APP",
      userId: input.userId,
      message: input.message
    });

    return enriched;
  }

  async createManyNotifications(inputs: NotificationInput[]) {
    const output: EnrichedNotification[] = [];

    for (const input of inputs) {
      const created = await this.createNotification(input);
      if (created) {
        output.push(created);
      }
    }

    return output;
  }

  private async requireNotification(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return notification;
  }

  private parseNotificationTypes(raw?: string) {
    if (!raw) {
      return [];
    }

    const values = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const valid = new Set(Object.values(NotificationType));

    return values.filter((item): item is NotificationType => valid.has(item as NotificationType));
  }

  private parsePriorities(raw?: string) {
    if (!raw) {
      return [];
    }

    const values = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const valid = new Set(Object.values(NotificationPriority));

    return values.filter(
      (item): item is NotificationPriority => valid.has(item as NotificationPriority)
    );
  }

  private defaultPriorityForType(type: NotificationType): NotificationPriority {
    switch (type) {
      case NotificationType.SLA_BREACH_WARNING:
      case NotificationType.CLEANING_SLA_BREACH:
      case NotificationType.CLEANING_MISSED:
      case NotificationType.FACILITY_ISSUE_REPORTED:
        return NotificationPriority.CRITICAL;
      case NotificationType.WORK_ORDER_ASSIGNED:
      case NotificationType.WORK_ORDER_UPDATED:
      case NotificationType.MAINTENANCE_DUE:
      case NotificationType.VEHICLE_SERVICE_DUE:
      case NotificationType.UTILITY_BILL_DUE:
      case NotificationType.LOW_STOCK:
      case NotificationType.CLEANING_LATE_VISIT:
      case NotificationType.CLEANING_REJECTED:
        return NotificationPriority.WARNING;
      default:
        return NotificationPriority.INFO;
    }
  }

  private resolveModule(type: NotificationType, referenceType?: string | null) {
    switch (type) {
      case NotificationType.WORK_ORDER_ASSIGNED:
      case NotificationType.WORK_ORDER_UPDATED:
      case NotificationType.MAINTENANCE_DUE:
      case NotificationType.SLA_BREACH_WARNING:
        return "maintenance" as const;
      case NotificationType.VEHICLE_SERVICE_DUE:
      case NotificationType.INSURANCE_EXPIRY:
      case NotificationType.LICENSE_EXPIRY:
        return "fleet" as const;
      case NotificationType.UTILITY_BILL_DUE:
        return "utilities" as const;
      case NotificationType.CLEANING_VISIT_SUBMITTED:
      case NotificationType.CLEANING_SIGN_OFF:
      case NotificationType.CLEANING_REJECTED:
      case NotificationType.FACILITY_ISSUE_REPORTED:
      case NotificationType.CLEANING_MISSED:
      case NotificationType.CLEANING_LATE_VISIT:
      case NotificationType.CLEANING_HIGH_ISSUE:
      case NotificationType.CLEANING_SLA_BREACH:
        return "cleaning" as const;
      case NotificationType.LOW_STOCK:
        return "inventory" as const;
      default:
        break;
    }

    if (referenceType === "Vehicle") {
      return "fleet" as const;
    }
    if (referenceType === "UtilityBill" || referenceType === "UtilityMeter") {
      return "utilities" as const;
    }
    if (referenceType === "FacilityIssue" || referenceType === "CleaningVisit") {
      return "cleaning" as const;
    }
    if (referenceType === "WorkOrder") {
      return "maintenance" as const;
    }

    return "system" as const;
  }

  private resolveDeepLink(referenceType?: string | null, referenceId?: string | null) {
    if (!referenceType || !referenceId) {
      return "/notifications";
    }

    switch (referenceType) {
      case "WorkOrder":
        return `/work-orders?highlight=${referenceId}`;
      case "Vehicle":
        return `/vehicles/${referenceId}`;
      case "UtilityMeter":
        return `/utilities/meters/${referenceId}`;
      case "UtilityBill":
        return `/utilities?billId=${referenceId}`;
      case "FacilityIssue":
        return `/cleaning/issues?issueId=${referenceId}`;
      case "CleaningVisit":
        return `/cleaning/visits?visitId=${referenceId}`;
      default:
        return "/notifications";
    }
  }

  private async enrichNotification(
    notification: Prisma.NotificationGetPayload<Record<string, never>>
  ): Promise<EnrichedNotification> {
    const context = await this.resolveContext(
      notification.referenceType,
      notification.referenceId,
      notification.metadata
    );

    const nowMs = Date.now();
    const dueAt = notification.dueAt ?? context.deadline;
    const remainingSeconds = dueAt
      ? Math.round((dueAt.getTime() - nowMs) / 1000)
      : null;
    const overdue = Boolean(remainingSeconds !== null && remainingSeconds < 0 && !notification.isRead);

    const module = this.resolveModule(notification.type, notification.referenceType);

    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      isRead: notification.isRead,
      readAt: notification.readAt,
      acknowledgedAt: notification.acknowledgedAt,
      dueAt,
      createdAt: notification.createdAt,
      module,
      deepLink: context.deepLink ?? this.resolveDeepLink(notification.referenceType, notification.referenceId),
      context: {
        entityType: context.entityType,
        entityId: context.entityId,
        entityName: context.entityName,
        deadline: context.deadline,
        preview: context.preview,
        data: context.data
      },
      preview: context.preview ?? notification.message,
      overdue,
      slaRemainingSeconds: remainingSeconds,
      referenceId: notification.referenceId,
      referenceType: notification.referenceType,
      metadata: notification.metadata,
      actions: this.suggestActions(notification.type, notification.referenceType)
    };
  }

  private suggestActions(type: NotificationType, referenceType?: string | null) {
    const actions: Array<{ key: NotificationActionType; label: string }> = [
      { key: "ACKNOWLEDGE", label: "Accept / Acknowledge" }
    ];

    if (referenceType === "WorkOrder") {
      actions.push({ key: "SCHEDULE_TASK", label: "Schedule Task" });
      actions.push({ key: "ASSIGN_USER", label: "Assign User" });
    }

    if (
      type === NotificationType.UTILITY_BILL_DUE ||
      type === NotificationType.CLEANING_MISSED ||
      type === NotificationType.SLA_BREACH_WARNING ||
      type === NotificationType.CLEANING_SLA_BREACH
    ) {
      actions.push({ key: "CREATE_WORK_ORDER", label: "Create Work Order" });
    }

    if (referenceType === "FacilityIssue") {
      actions.push({ key: "ASSIGN_USER", label: "Assign User" });
      actions.push({ key: "SCHEDULE_TASK", label: "Schedule Task" });
    }

    return actions;
  }

  private async resolveContext(
    referenceType?: string | null,
    referenceId?: string | null,
    metadata?: Prisma.JsonValue | null
  ) {
    const fallback = {
      entityType: referenceType ?? null,
      entityId: referenceId ?? null,
      entityName: null as string | null,
      deadline: null as Date | null,
      preview: null as string | null,
      deepLink: this.resolveDeepLink(referenceType, referenceId),
      data: ((metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>
    };

    if (!referenceType || !referenceId) {
      return fallback;
    }

    if (referenceType === "WorkOrder") {
      const workOrder = await this.prisma.workOrder.findUnique({
        where: { id: referenceId },
        include: {
          technician: {
            select: { firstName: true, lastName: true }
          }
        }
      });

      if (!workOrder) {
        return fallback;
      }

      const technicianName = workOrder.technician
        ? `${workOrder.technician.firstName} ${workOrder.technician.lastName}`
        : "Unassigned";
      const dueText = workOrder.dueDate ? ` due ${this.relativeTime(workOrder.dueDate)}` : "";

      return {
        entityType: "WorkOrder",
        entityId: workOrder.id,
        entityName: workOrder.title,
        deadline: workOrder.dueDate,
        preview: `${workOrder.woNumber} assigned to ${technicianName}${dueText}`,
        deepLink: `/work-orders?highlight=${workOrder.id}`,
        data: {
          woNumber: workOrder.woNumber,
          status: workOrder.status,
          priority: workOrder.priority
        }
      };
    }

    if (referenceType === "Vehicle") {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: referenceId },
        select: {
          id: true,
          registrationNo: true,
          make: true,
          vehicleModel: true,
          nextServiceDate: true,
          status: true
        }
      });

      if (!vehicle) {
        return fallback;
      }

      return {
        entityType: "Vehicle",
        entityId: vehicle.id,
        entityName: `${vehicle.make} ${vehicle.vehicleModel}`,
        deadline: vehicle.nextServiceDate,
        preview: `${vehicle.registrationNo} service ${vehicle.nextServiceDate ? this.relativeTime(vehicle.nextServiceDate) : "schedule pending"}`,
        deepLink: `/vehicles/${vehicle.id}`,
        data: vehicle as Record<string, unknown>
      };
    }

    if (referenceType === "UtilityBill") {
      const bill = await this.prisma.utilityBill.findUnique({
        where: { id: referenceId },
        include: {
          meter: {
            select: {
              id: true,
              meterNumber: true,
              location: true,
              type: true
            }
          }
        }
      });

      if (!bill) {
        return fallback;
      }

      return {
        entityType: "UtilityBill",
        entityId: bill.id,
        entityName: bill.meter?.meterNumber ?? "Utility Bill",
        deadline: bill.dueDate,
        preview: `${bill.meter?.location ?? "Utility"} bill ${bill.dueDate ? this.relativeTime(bill.dueDate) : "due soon"}`,
        deepLink: bill.meterId ? `/utilities/meters/${bill.meterId}` : "/utilities",
        data: {
          meterNumber: bill.meter?.meterNumber,
          utilityType: bill.meter?.type,
          totalAmount: bill.totalAmount.toString(),
          status: bill.status
        }
      };
    }

    if (referenceType === "UtilityMeter") {
      const meter = await this.prisma.utilityMeter.findUnique({
        where: { id: referenceId },
        select: {
          id: true,
          meterNumber: true,
          location: true,
          type: true,
          isActive: true
        }
      });

      if (!meter) {
        return fallback;
      }

      return {
        entityType: "UtilityMeter",
        entityId: meter.id,
        entityName: meter.meterNumber,
        deadline: null,
        preview: `${meter.type} meter ${meter.meterNumber} at ${meter.location}`,
        deepLink: `/utilities/meters/${meter.id}`,
        data: meter as Record<string, unknown>
      };
    }

    if (referenceType === "FacilityIssue") {
      const issue = await this.prisma.facilityIssue.findUnique({
        where: { id: referenceId },
        include: {
          location: {
            select: {
              name: true
            }
          }
        }
      });

      if (!issue) {
        return fallback;
      }

      return {
        entityType: "FacilityIssue",
        entityId: issue.id,
        entityName: issue.title,
        deadline: issue.slaTargetAt,
        preview: `${issue.title}${issue.location?.name ? ` at ${issue.location.name}` : ""}`,
        deepLink: `/cleaning/issues?issueId=${issue.id}`,
        data: {
          status: issue.status,
          severity: issue.severity,
          locationName: issue.location?.name
        }
      };
    }

    if (referenceType === "CleaningVisit") {
      const visit = await this.prisma.cleaningVisit.findUnique({
        where: { id: referenceId },
        include: {
          location: {
            select: { name: true }
          },
          cleaner: {
            select: { firstName: true, lastName: true }
          }
        }
      });

      if (!visit) {
        return fallback;
      }

      return {
        entityType: "CleaningVisit",
        entityId: visit.id,
        entityName: visit.location.name,
        deadline: null,
        preview: `${visit.location.name} visited by ${visit.cleaner.firstName} ${visit.cleaner.lastName}`,
        deepLink: `/cleaning/visits?visitId=${visit.id}`,
        data: {
          status: visit.status,
          scheduleStatus: visit.scheduleStatus,
          scannedAt: visit.scannedAt
        }
      };
    }

    return fallback;
  }

  private relativeTime(value: Date) {
    const diffMs = value.getTime() - Date.now();
    const absHours = Math.round(Math.abs(diffMs) / (60 * 60 * 1000));

    if (absHours < 1) {
      return diffMs >= 0 ? "in <1h" : "<1h ago";
    }

    if (absHours < 24) {
      return diffMs >= 0 ? `in ${absHours}h` : `${absHours}h ago`;
    }

    const days = Math.round(absHours / 24);
    return diffMs >= 0 ? `in ${days}d` : `${days}d ago`;
  }

  private async createWorkOrderFromNotification(
    notification: Prisma.NotificationGetPayload<Record<string, never>>,
    actorId: string,
    payload: Record<string, unknown>
  ) {
    const woNumber = await this.nextWorkOrderNumber();
    const type = this.toWorkOrderType(payload.type);
    const priority = this.toWorkOrderPriority(payload.priority, notification.priority);

    const created = await this.prisma.workOrder.create({
      data: {
        woNumber,
        title:
          typeof payload.title === "string" && payload.title.trim()
            ? payload.title.trim()
            : `Follow-up: ${notification.title}`,
        description:
          typeof payload.description === "string" && payload.description.trim()
            ? payload.description.trim()
            : notification.message,
        type,
        priority,
        createdById: actorId,
        dueDate:
          typeof payload.dueDate === "string"
            ? new Date(payload.dueDate)
            : notification.dueAt ?? undefined,
        assetId:
          typeof payload.assetId === "string"
            ? payload.assetId
            : notification.referenceType === "Asset"
              ? notification.referenceId ?? undefined
              : undefined,
        vehicleId:
          typeof payload.vehicleId === "string"
            ? payload.vehicleId
            : notification.referenceType === "Vehicle"
              ? notification.referenceId ?? undefined
              : undefined
      }
    });

    if (typeof payload.technicianId === "string" && payload.technicianId) {
      await this.prisma.workOrder.update({
        where: { id: created.id },
        data: { technicianId: payload.technicianId }
      });

      await this.createNotification({
        userId: payload.technicianId,
        title: "Work order assigned",
        message: `Work order ${created.woNumber} has been assigned to you`,
        type: NotificationType.WORK_ORDER_ASSIGNED,
        priority: NotificationPriority.WARNING,
        referenceId: created.id,
        referenceType: "WorkOrder",
        dueAt: created.dueDate ?? null
      });
    }

    return created;
  }

  private async scheduleTask(
    notification: Prisma.NotificationGetPayload<Record<string, never>>,
    actorId: string,
    payload: Record<string, unknown>
  ) {
    if (notification.referenceType === "WorkOrder" && notification.referenceId) {
      const dueDate =
        typeof payload.dueDate === "string"
          ? new Date(payload.dueDate)
          : notification.dueAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

      return this.prisma.workOrder.update({
        where: { id: notification.referenceId },
        data: {
          dueDate
        }
      });
    }

    return this.createWorkOrderFromNotification(notification, actorId, {
      ...payload,
      title:
        typeof payload.title === "string" && payload.title
          ? payload.title
          : `Scheduled task: ${notification.title}`
    });
  }

  private async assignUserFromNotification(
    notification: Prisma.NotificationGetPayload<Record<string, never>>,
    payload: Record<string, unknown>
  ) {
    const targetUserId =
      typeof payload.userId === "string" && payload.userId.trim() ? payload.userId.trim() : null;

    if (!targetUserId) {
      throw new BadRequestException("userId is required for ASSIGN_USER action");
    }

    if (notification.referenceType === "WorkOrder" && notification.referenceId) {
      const updated = await this.prisma.workOrder.update({
        where: { id: notification.referenceId },
        data: {
          technicianId: targetUserId
        }
      });

      await this.createNotification({
        userId: targetUserId,
        title: "Work order assigned",
        message: `Work order ${updated.woNumber} has been assigned to you`,
        type: NotificationType.WORK_ORDER_ASSIGNED,
        priority: NotificationPriority.WARNING,
        referenceId: updated.id,
        referenceType: "WorkOrder",
        dueAt: updated.dueDate ?? null
      });

      return updated;
    }

    if (notification.referenceType === "FacilityIssue" && notification.referenceId) {
      return this.prisma.facilityIssue.update({
        where: { id: notification.referenceId },
        data: {
          assignedToId: targetUserId
        }
      });
    }

    throw new BadRequestException("ASSIGN_USER is not supported for this notification type");
  }

  private toWorkOrderType(value: unknown): WorkOrderType {
    if (typeof value === "string") {
      const normalized = value.trim().toUpperCase();
      if ((Object.values(WorkOrderType) as string[]).includes(normalized)) {
        return normalized as WorkOrderType;
      }
    }

    return WorkOrderType.CORRECTIVE;
  }

  private toWorkOrderPriority(value: unknown, fallback: NotificationPriority): Priority {
    if (typeof value === "string") {
      const normalized = value.trim().toUpperCase();
      if ((Object.values(Priority) as string[]).includes(normalized)) {
        return normalized as Priority;
      }
    }

    if (fallback === NotificationPriority.CRITICAL) {
      return Priority.CRITICAL;
    }

    if (fallback === NotificationPriority.WARNING) {
      return Priority.HIGH;
    }

    return Priority.MEDIUM;
  }

  private async nextWorkOrderNumber() {
    const year = new Date().getFullYear();
    const count = await this.prisma.workOrder.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lte: new Date(`${year}-12-31T23:59:59.999Z`)
        }
      }
    });

    const sequence = String(count + 1).padStart(4, "0");
    return `WO-${year}-${sequence}`;
  }

  private async getUserSetting<T>(userId: string, key: string) {
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        scope_scopeId_key: {
          scope: AppSettingScope.USER,
          scopeId: userId,
          key
        }
      }
    });

    return (setting?.value as T | undefined) ?? null;
  }

  private async setUserSetting(userId: string, key: string, value: unknown) {
    await this.prisma.appSetting.upsert({
      where: {
        scope_scopeId_key: {
          scope: AppSettingScope.USER,
          scopeId: userId,
          key
        }
      },
      create: {
        scope: AppSettingScope.USER,
        scopeId: userId,
        key,
        value: value as Prisma.InputJsonValue
      },
      update: {
        value: value as Prisma.InputJsonValue
      }
    });
  }
}
