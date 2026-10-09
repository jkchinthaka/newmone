import { PmPlanStatus, Prisma } from "@prisma/client";

export type PmPlanListFilters = {
  status?: PmPlanStatus;
  siteId?: string;
  assetId?: string;
  vehicleId?: string;
  search?: string;
  trigger?: string;
  dueWindow?: string;
  autoWo?: string;
  page?: number;
  pageSize?: number;
};

const DAY_MS = 86_400_000;

function baseWhere(tenantId: string, filters?: PmPlanListFilters): Prisma.PmPlanWhereInput {
  const search = filters?.search?.trim();
  return {
    tenantId,
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.siteId ? { siteId: filters.siteId } : {}),
    ...(filters?.assetId ? { assetId: filters.assetId } : {}),
    ...(filters?.vehicleId ? { vehicleId: filters.vehicleId } : {}),
    ...(filters?.autoWo === "true" ? { autoCreateWorkOrder: true } : {}),
    ...(filters?.autoWo === "false" ? { autoCreateWorkOrder: false } : {}),
    ...(filters?.trigger
      ? { triggers: { some: { kind: filters.trigger as never, isActive: true } } }
      : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search } },
            { name: { contains: search } },
            { description: { contains: search } },
            { asset: { name: { contains: search } } },
            { asset: { assetTag: { contains: search } } },
            { vehicle: { registrationNo: { contains: search } } },
            { vehicle: { make: { contains: search } } }
          ]
        }
      : {})
  };
}

/** Same attention rule as the list decoration: active, missing scope, missing trigger, or calendar with no due date. */
export function pmPlanAttentionWhere(now = new Date()): Prisma.PmPlanWhereInput {
  return {
    status: PmPlanStatus.ACTIVE,
    OR: [
      { triggers: { none: {} } },
      { AND: [{ assetId: null }, { vehicleId: null }] },
      {
        AND: [
          { nextDueAt: null },
          { triggers: { some: { kind: "CALENDAR" as never, isActive: true } } }
        ]
      }
    ]
  };
}

export function pmPlanOverdueWhere(now = new Date()): Prisma.PmPlanWhereInput {
  return {
    status: PmPlanStatus.ACTIVE,
    nextDueAt: { lt: now },
    triggers: { some: {} },
    NOT: { AND: [{ assetId: null }, { vehicleId: null }] }
  };
}

export function pmPlanDueSoonWhere(now = new Date()): Prisma.PmPlanWhereInput {
  return {
    status: PmPlanStatus.ACTIVE,
    nextDueAt: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) },
    triggers: { some: {} },
    NOT: { AND: [{ assetId: null }, { vehicleId: null }] }
  };
}

function dueWhere(dueWindow: string | undefined, now: Date): Prisma.PmPlanWhereInput | undefined {
  if (dueWindow === "overdue") return pmPlanOverdueWhere(now);
  if (dueWindow === "7" || dueWindow === "soon") return pmPlanDueSoonWhere(now);
  if (dueWindow === "attention") return pmPlanAttentionWhere(now);
  return undefined;
}

export function buildPmPlanListQuery(tenantId: string, filters: PmPlanListFilters | undefined, now = new Date()) {
  const pageNumber = Number(filters?.page);
  const pageSizeNumber = Number(filters?.pageSize);
  const page = Number.isFinite(pageNumber) && pageNumber > 0 ? Math.floor(pageNumber) : 1;
  const pageSize = Number.isFinite(pageSizeNumber) && pageSizeNumber > 0 ? Math.min(Math.floor(pageSizeNumber), 100) : 25;
  const shared = baseWhere(tenantId, { ...filters, status: undefined, dueWindow: undefined });
  const window = dueWhere(filters?.dueWindow, now);
  const where = Prisma.validator<Prisma.PmPlanWhereInput>()({
    AND: [baseWhere(tenantId, filters), ...(window ? [window] : [])]
  });
  return {
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    page,
    pageSize,
    counts: {
      active: { AND: [shared, { status: PmPlanStatus.ACTIVE }] },
      dueSoon: { AND: [shared, pmPlanDueSoonWhere(now)] },
      overdue: { AND: [shared, pmPlanOverdueWhere(now)] },
      attention: { AND: [shared, pmPlanAttentionWhere(now)] }
    }
  };
}
