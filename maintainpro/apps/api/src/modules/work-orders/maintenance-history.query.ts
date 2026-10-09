import { Prisma } from "@prisma/client";

export const HISTORY_SUCCESS_STATUSES = ["COMPLETED", "CLOSED"] as const;
export const HISTORY_PAGE_SIZES = [25, 50, 100] as const;

export type MaintenanceHistoryFilters = {
  q?: string;
  scope?: "asset" | "vehicle";
  status?: "COMPLETED" | "CLOSED" | "CANCELLED";
  from?: string;
  to?: string;
  category?: string;
  technician?: string;
  vendor?: string;
  priority?: string;
  costMin?: number;
  costMax?: number;
  type?: string;
  location?: string;
  page: number;
  pageSize: number;
};

export type MaintenanceHistoryItem = {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  assetLabel: string;
  assetCode: string;
  category: string;
  finalizedAt: string | null;
  technician: string;
  cost: number | null;
  vendor: string;
};

const PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const TYPES = new Set([
  "CORRECTIVE",
  "PREVENTIVE",
  "EMERGENCY",
  "INSPECTION",
  "ACCIDENT_REPAIR",
  "INSTALLATION"
]);

export function historyStatuses(status?: string): Array<"COMPLETED" | "CLOSED" | "CANCELLED"> {
  if (status === "COMPLETED" || status === "CLOSED" || status === "CANCELLED") return [status];
  return ["COMPLETED", "CLOSED"];
}

export function parseMaintenanceHistoryQuery(raw: Record<string, string | undefined>): MaintenanceHistoryFilters {
  const page = Number(raw.page);
  const pageSize = Number(raw.pageSize);
  const costMin = raw.costMin?.trim() ? Number(raw.costMin) : Number.NaN;
  const costMax = raw.costMax?.trim() ? Number(raw.costMax) : Number.NaN;
  const status = raw.status?.trim().toUpperCase();
  const priority = raw.priority?.trim().toUpperCase();
  const type = raw.type?.trim().toUpperCase();
  const scope = raw.scope?.trim().toLowerCase();
  return {
    q: raw.q?.trim() || raw.search?.trim() || undefined,
    scope: scope === "asset" || scope === "vehicle" ? scope : undefined,
    status: status === "COMPLETED" || status === "CLOSED" || status === "CANCELLED" ? status : undefined,
    from: raw.from?.trim() || raw.dateFrom?.trim() || undefined,
    to: raw.to?.trim() || raw.dateTo?.trim() || undefined,
    category: raw.category?.trim() || undefined,
    technician: raw.technician?.trim() || undefined,
    vendor: raw.vendor?.trim() || undefined,
    priority: priority && PRIORITIES.has(priority) ? priority : undefined,
    costMin: Number.isFinite(costMin) ? costMin : undefined,
    costMax: Number.isFinite(costMax) ? costMax : undefined,
    type: type && TYPES.has(type) ? type : undefined,
    location: raw.location?.trim() || undefined,
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    pageSize: HISTORY_PAGE_SIZES.includes(pageSize as (typeof HISTORY_PAGE_SIZES)[number]) ? pageSize : 25
  };
}

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};
  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) range.gte = start;
  }
  if (to) {
    const end = new Date(to.includes("T") ? to : `${to}T23:59:59.999Z`);
    if (!Number.isNaN(end.getTime())) range.lte = end;
  }
  return range.gte || range.lte ? range : undefined;
}

function andWhere(where: Prisma.WorkOrderWhereInput, clause: Prisma.WorkOrderWhereInput) {
  const current = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  where.AND = [...current, clause];
}

export function buildMaintenanceHistoryWhere(input: {
  tenantId: string;
  role: string;
  userId: string;
  query: MaintenanceHistoryFilters;
  statuses: string[];
}): Prisma.WorkOrderWhereInput {
  const where: Prisma.WorkOrderWhereInput = {
    tenantId: input.tenantId,
    status: { in: input.statuses }
  };

  if (input.query.scope === "asset") where.assetId = { not: null };
  if (input.query.scope === "vehicle") where.vehicleId = { not: null };
  if (input.query.priority) where.priority = input.query.priority;
  if (input.query.type) where.type = input.query.type;
  if (input.query.category) where.categoryNameSnapshot = { contains: input.query.category };
  if (input.query.costMin != null || input.query.costMax != null) {
    where.actualCost = {
      ...(input.query.costMin != null ? { gte: input.query.costMin } : {}),
      ...(input.query.costMax != null ? { lte: input.query.costMax } : {})
    };
  }

  const range = dateRange(input.query.from, input.query.to);
  if (range) {
    const finalized: Prisma.WorkOrderWhereInput[] = [];
    if (input.statuses.some((status) => status !== "CANCELLED")) {
      finalized.push(
        { AND: [{ status: { not: "CANCELLED" } }, { completedDate: range }] },
        { AND: [{ status: { not: "CANCELLED" } }, { completedDate: null }, { closedAt: range }] },
        {
          AND: [
            { status: { not: "CANCELLED" } },
            { completedDate: null },
            { closedAt: null },
            { repairCompletedAt: range }
          ]
        }
      );
    }
    if (input.statuses.includes("CANCELLED")) {
      finalized.push({ AND: [{ status: "CANCELLED" }, { updatedAt: range }] });
    }
    andWhere(where, { OR: finalized });
  }

  if (input.query.vendor) {
    where.vendorSupplier = { name: { contains: input.query.vendor } };
  }
  if (input.query.technician) {
    andWhere(where, {
      OR: [
        { technician: { firstName: { contains: input.query.technician } } },
        { technician: { lastName: { contains: input.query.technician } } },
        {
          assignees: {
            some: {
              assignmentStatus: { not: "REMOVED" },
              employee: { fullName: { contains: input.query.technician } }
            }
          }
        }
      ]
    });
  }
  if (input.query.location) {
    andWhere(where, {
      OR: [
        { department: { name: { contains: input.query.location } } },
        { functionalLocation: { name: { contains: input.query.location } } },
        { site: { name: { contains: input.query.location } } }
      ]
    });
  }

  const search = input.query.q;
  if (search && search.length >= 2) {
    andWhere(where, {
      OR: [
        { woNumber: { contains: search } },
        { title: { contains: search } },
        { asset: { OR: [{ name: { contains: search } }, { assetTag: { contains: search } }] } },
        { vehicle: { registrationNo: { contains: search } } },
        { technician: { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }] } },
        {
          assignees: {
            some: { assignmentStatus: { not: "REMOVED" }, employee: { fullName: { contains: search } } }
          }
        },
        { vendorSupplier: { name: { contains: search } } }
      ]
    });
  }

  if (input.role === "TECHNICIAN" || input.role === "MECHANIC") {
    andWhere(where, {
      OR: [
        { technicianId: input.userId },
        {
          assignees: {
            some: { employee: { linkedUserId: input.userId }, assignmentStatus: { not: "REMOVED" } }
          }
        }
      ]
    });
  }

  return where;
}

export const maintenanceHistorySelect = {
  id: true,
  woNumber: true,
  title: true,
  status: true,
  type: true,
  categoryNameSnapshot: true,
  completedDate: true,
  closedAt: true,
  repairCompletedAt: true,
  actualCost: true,
  asset: { select: { name: true, assetTag: true } },
  vehicle: { select: { registrationNo: true } },
  technician: { select: { firstName: true, lastName: true } },
  assignees: {
    where: { assignmentStatus: { not: "REMOVED" } },
    orderBy: { isPrimary: "desc" as const },
    take: 1,
    select: { employee: { select: { fullName: true } } }
  },
  vendorSupplier: { select: { name: true } }
} satisfies Prisma.WorkOrderSelect;

type HistoryRow = {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  type: string;
  categoryNameSnapshot: string | null;
  completedDate: Date | null;
  closedAt: Date | null;
  repairCompletedAt: Date | null;
  actualCost: { toString(): string } | number | null;
  asset: { name: string; assetTag: string } | null;
  vehicle: { registrationNo: string } | null;
  technician: { firstName: string; lastName: string } | null;
  assignees: Array<{ employee: { fullName: string } }>;
  vendorSupplier: { name: string } | null;
};

export function toMaintenanceHistoryItem(row: HistoryRow): MaintenanceHistoryItem {
  const finalized =
    row.status === "CANCELLED" ? null : row.completedDate ?? row.closedAt ?? row.repairCompletedAt ?? null;
  const technicianName = [row.technician?.firstName, row.technician?.lastName].filter(Boolean).join(" ");
  const cost = row.actualCost == null ? null : Number(row.actualCost.toString());
  return {
    id: row.id,
    woNumber: row.woNumber,
    title: row.title,
    status: row.status,
    assetLabel: row.asset?.name || row.vehicle?.registrationNo || "Unassigned",
    assetCode: row.asset?.assetTag || (row.asset ? "" : row.vehicle?.registrationNo || ""),
    category: row.categoryNameSnapshot || row.type,
    finalizedAt: finalized ? finalized.toISOString() : null,
    technician: row.assignees[0]?.employee.fullName || technicianName,
    cost: cost != null && Number.isFinite(cost) ? cost : null,
    vendor: row.vendorSupplier?.name || ""
  };
}
