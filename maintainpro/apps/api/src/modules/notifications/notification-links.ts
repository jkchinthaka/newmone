import { NotificationPriority, NotificationType, Prisma } from "@prisma/client";

export type NotificationListQuery = {
  status?: "ALL" | "READ" | "UNREAD";
  type?: string;
  priority?: string;
  search?: string;
  module?: string;
  acknowledged?: "yes" | "no";
  overdue?: boolean;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

const MODULE_TYPES: Record<string, NotificationType[]> = {
  maintenance: [
    NotificationType.MAINTENANCE_DUE,
    NotificationType.WORK_ORDER_ASSIGNED,
    NotificationType.WORK_ORDER_UPDATED,
    NotificationType.SLA_BREACH_WARNING
  ],
  inventory: [
    NotificationType.LOW_STOCK,
    NotificationType.PART_REQUEST_SUBMITTED,
    NotificationType.PART_REQUEST_APPROVED,
    NotificationType.PART_REQUEST_REJECTED,
    NotificationType.PART_ISSUE_COMPLETED,
    NotificationType.PURCHASE_ORDER_APPROVED,
    NotificationType.PURCHASE_ORDER_REJECTED,
    NotificationType.ERP_SYNC_FAILED,
    NotificationType.ERP_SYNC_SUCCESS
  ],
  fleet: [
    NotificationType.VEHICLE_SERVICE_DUE,
    NotificationType.LICENSE_EXPIRY,
    NotificationType.INSURANCE_EXPIRY
  ],
  utilities: [NotificationType.UTILITY_BILL_DUE],
  facilities: [
    NotificationType.CLEANING_VISIT_SUBMITTED,
    NotificationType.CLEANING_SIGN_OFF,
    NotificationType.CLEANING_REJECTED,
    NotificationType.FACILITY_ISSUE_REPORTED,
    NotificationType.CLEANING_MISSED,
    NotificationType.CLEANING_LATE_VISIT,
    NotificationType.CLEANING_HIGH_ISSUE,
    NotificationType.CLEANING_SLA_BREACH
  ],
  system: [NotificationType.SYSTEM_ALERT]
};

export function notificationListPage(query: NotificationListQuery) {
  const page = Number.isFinite(query.page) && query.page && query.page > 0 ? Math.floor(query.page) : 1;
  const requested = Number.isFinite(query.pageSize) && query.pageSize && query.pageSize > 0 ? Math.floor(query.pageSize) : 20;
  const pageSize = requested === 50 || requested === 100 ? requested : 20;
  return { page, pageSize };
}

function parseTypes(value?: string): NotificationType[] {
  if (!value || value === "ALL") return [];
  const allowed = new Set<string>(Object.values(NotificationType));
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => allowed.has(entry)) as NotificationType[];
}

function parsePriorities(value?: string): NotificationPriority[] {
  if (!value || value === "ALL") return [];
  const allowed = new Set<string>(Object.values(NotificationPriority));
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => allowed.has(entry)) as NotificationPriority[];
}

export function notificationListWhere(
  userId: string,
  query: NotificationListQuery,
  now = new Date()
): Prisma.NotificationWhereInput {
  const where: Prisma.NotificationWhereInput = { userId };
  if (query.status === "READ") where.isRead = true;
  if (query.status === "UNREAD") where.isRead = false;

  let types = parseTypes(query.type);
  if (query.module && MODULE_TYPES[query.module]) {
    const moduleTypes = MODULE_TYPES[query.module];
    types = types.length > 0 ? types.filter((type) => moduleTypes.includes(type)) : moduleTypes;
    if (types.length === 0) {
      where.id = "__no_matching_notification_type__";
    }
  }
  if (types.length > 0) where.type = { in: types };

  const priorities = parsePriorities(query.priority);
  if (priorities.length > 0) where.priority = { in: priorities };

  if (query.acknowledged === "yes") where.acknowledgedAt = { not: null };
  if (query.acknowledged === "no") where.acknowledgedAt = null;
  if (query.overdue) where.dueAt = { lt: now };

  const createdAt: Prisma.DateTimeFilter = {};
  if (query.from) {
    const from = new Date(query.from);
    if (!Number.isNaN(from.getTime())) createdAt.gte = from;
  }
  if (query.to) {
    const to = new Date(query.to);
    if (!Number.isNaN(to.getTime())) createdAt.lte = to;
  }
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;

  const term = query.search?.trim();
  if (term) {
    where.OR = [
      { title: { contains: term } },
      { message: { contains: term } },
      { referenceId: { contains: term } }
    ];
  }

  return where;
}

export function notificationContextHref(input: {
  type?: string | null;
  title?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}): string {
  const id = input.referenceId?.trim();
  const type = input.type ?? "";
  const title = input.title ?? "";

  if (input.referenceType === "WorkOrder" && id) {
    if (type === "LOW_STOCK") return `/work-orders?wo=${id}&tab=parts`;
    if (/verif/i.test(title) || /verif/i.test(type)) return `/work-orders?wo=${id}&tab=evidence`;
    return `/work-orders?wo=${id}`;
  }

  if (input.referenceType === "Vehicle" && id) {
    if (/gate/i.test(title) || /gate/i.test(type)) return `/fleet/gate?vehicle=${id}`;
    return `/vehicles/${id}`;
  }

  if (input.referenceType === "MaintenancePlan" && id) {
    return `/maintenance/plans?q=${encodeURIComponent(id)}`;
  }
  if (type === "MAINTENANCE_DUE") {
    return "/maintenance/plans?due=overdue";
  }

  if (input.referenceType === "InventoryPart" && id) {
    return `/inventory?q=${encodeURIComponent(id)}`;
  }
  if (type === "LOW_STOCK" && id) {
    return `/inventory?q=${encodeURIComponent(id)}`;
  }

  if (input.referenceType === "UtilityMeter" && id) return `/utilities/meters/${id}`;
  if (input.referenceType === "UtilityBill" && id) return `/utilities?billId=${id}`;
  if (input.referenceType === "FacilityIssue" && id) return `/cleaning/issues?issueId=${id}`;
  if (input.referenceType === "CleaningVisit" && id) return `/cleaning/visits?visitId=${id}`;

  return "/notifications";
}

export function notificationNextAction(input: {
  type?: string | null;
  title?: string | null;
  referenceType?: string | null;
}): string {
  const type = input.type ?? "";
  const title = input.title ?? "";
  if (/gate/i.test(title) || /gate/i.test(type)) return "Open vehicle gate";
  if (/verif/i.test(title) || /verif/i.test(type)) return "Open work order verification";
  if (type === "LOW_STOCK") return "Open parts";
  if (type === "MAINTENANCE_DUE" || input.referenceType === "MaintenancePlan") return "Open PM plan";
  if (input.referenceType === "WorkOrder" || type.startsWith("WORK_ORDER")) return "Open work order";
  if (input.referenceType === "Vehicle") return "Open vehicle";
  if (input.referenceType === "FacilityIssue") return "Open request";
  return "Open context";
}
