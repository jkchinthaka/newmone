import { EvidenceType, EvidenceVerificationStatus, Prisma } from "@prisma/client";

import {
  EVIDENCE_REQUIRED_WORK_ORDER_TYPES,
  isStorageUploadsEnabled
} from "../../common/utils/work-order-evidence-governance";
import {
  assignedToActorScope,
  businessDayWindow,
  type MyJobView,
  MY_JOB_VIEWS
} from "./my-jobs.rules";

const TERMINAL = ["CLOSED", "CANCELLED", "COMPLETED"] as const;
const REQUIRED_TYPES = [...EVIDENCE_REQUIRED_WORK_ORDER_TYPES];

export const MY_JOB_COUNT_FIELD = {
  active: "active",
  overdue: "overdue",
  "due-today": "dueToday",
  "waiting-parts": "waitingParts",
  "evidence-needed": "evidenceNeeded",
  "rework-required": "reworkRequired",
  "in-progress": "inProgress",
  completed: "completed"
} as const satisfies Record<MyJobView, string>;

export type MyJobListFilters = {
  search?: string;
  status?: string;
  priority?: string;
  due?: string;
};

function andWhere(parts: Prisma.WorkOrderWhereInput[]): Prisma.WorkOrderWhereInput {
  const present = parts.filter((part) => Object.keys(part).length > 0);
  if (present.length === 0) return {};
  if (present.length === 1) return present[0];
  return { AND: present };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_\[\]]/g, (char) => `\\${char}`);
}

function terminalWhere(): Prisma.WorkOrderWhereInput {
  return { status: { notIn: [...TERMINAL] } };
}

const terminalSql = Prisma.sql`[status] NOT IN (N'CLOSED', N'CANCELLED', N'COMPLETED')`;

export function myJobScopeWhere(tenantId: string, userId: string): Prisma.WorkOrderWhereInput {
  return { tenantId, ...assignedToActorScope(userId) };
}

function scopeSql(tenantId: string, userId: string): Prisma.Sql {
  return Prisma.sql`[tenantId] = ${tenantId} AND ([technicianId] = ${userId} OR EXISTS (
    SELECT 1 FROM [WorkOrderAssignee] AS [a]
    INNER JOIN [Employee] AS [e] ON [e].[id] = [a].[employeeId]
    WHERE [a].[workOrderId] = [WorkOrder].[id]
      AND [a].[assignmentStatus] <> N'REMOVED'
      AND [e].[linkedUserId] = ${userId}
  ))`;
}

export function myJobOverdueWhere(now: Date): Prisma.WorkOrderWhereInput {
  const start = businessDayWindow(now).start;
  return andWhere([
    terminalWhere(),
    { OR: [{ status: "OVERDUE" }, { dueDate: { lt: start } }] }
  ]);
}

function overdueSql(now: Date): Prisma.Sql {
  const start = businessDayWindow(now).start;
  return Prisma.sql`${terminalSql} AND ([status] = N'OVERDUE' OR [dueDate] < ${start})`;
}

function dueTodayWhere(now: Date): Prisma.WorkOrderWhereInput {
  const window = businessDayWindow(now);
  return { dueDate: { gte: window.start, lte: window.end } };
}

function dueTodaySql(now: Date): Prisma.Sql {
  const window = businessDayWindow(now);
  return Prisma.sql`[dueDate] >= ${window.start} AND [dueDate] <= ${window.end}`;
}

function waitingPartsWhere(): Prisma.WorkOrderWhereInput {
  return andWhere([
    terminalWhere(),
    {
      OR: [
        { partIssues: { some: {} } },
        { parts: { some: { lineStatus: "REQUESTED" } } },
        { parts: { some: { pendingReturnQuantity: { gt: 0 } } } },
        {
          parts: {
            some: { lineStatus: "APPROVED", issuedQuantity: 0, requestedQuantity: { gt: 0 } }
          }
        }
      ]
    }
  ]);
}

function waitingPartsSql(): Prisma.Sql {
  return Prisma.sql`${terminalSql} AND (
    EXISTS (SELECT 1 FROM [PartIssue] AS [issue] WHERE [issue].[workOrderId] = [WorkOrder].[id])
    OR EXISTS (
      SELECT 1 FROM [WorkOrderPart] AS [part]
      WHERE [part].[workOrderId] = [WorkOrder].[id]
        AND (
          [part].[lineStatus] = N'REQUESTED'
          OR [part].[pendingReturnQuantity] > 0
          OR ([part].[lineStatus] = N'APPROVED' AND [part].[issuedQuantity] = 0 AND [part].[requestedQuantity] > 0)
        )
    )
  )`;
}

function rejectedEvidenceWhere(): Prisma.WorkOrderWhereInput {
  return {
    evidenceAttachments: {
      some: {
        deletedAt: null,
        status: { not: "DELETED" },
        verificationStatus: EvidenceVerificationStatus.REJECTED
      }
    }
  };
}

const rejectedEvidenceSql = Prisma.sql`EXISTS (
  SELECT 1 FROM [EvidenceAttachment] AS [ev]
  WHERE [ev].[workOrderId] = [WorkOrder].[id]
    AND [ev].[deletedAt] IS NULL
    AND [ev].[status] <> N'DELETED'
    AND [ev].[verificationStatus] = N'REJECTED'
)`;

function uploadedPhotoWhere(evidenceType: EvidenceType): Prisma.WorkOrderWhereInput {
  return {
    evidenceAttachments: {
      some: {
        deletedAt: null,
        status: "UPLOADED",
        evidenceType,
        verificationStatus: { not: EvidenceVerificationStatus.REJECTED }
      }
    }
  };
}

function uploadedPhotoSql(evidenceType: string): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM [EvidenceAttachment] AS [ev]
    WHERE [ev].[workOrderId] = [WorkOrder].[id]
      AND [ev].[deletedAt] IS NULL
      AND [ev].[status] = N'UPLOADED'
      AND [ev].[evidenceType] = ${evidenceType}
      AND [ev].[verificationStatus] <> N'REJECTED'
  )`;
}

function evidenceNeededWhere(): Prisma.WorkOrderWhereInput {
  const storageEnabled = isStorageUploadsEnabled();
  const production = String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
  const rejected = rejectedEvidenceWhere();
  if (!storageEnabled && !production) {
    return andWhere([terminalWhere(), rejected]);
  }
  const incomplete: Prisma.WorkOrderWhereInput = storageEnabled
    ? {
        type: { in: REQUIRED_TYPES },
        NOT: {
          AND: [
            uploadedPhotoWhere(EvidenceType.BEFORE_PHOTO),
            uploadedPhotoWhere(EvidenceType.AFTER_PHOTO)
          ]
        }
      }
    : { type: { in: REQUIRED_TYPES } };
  return andWhere([terminalWhere(), { OR: [rejected, incomplete] }]);
}

function evidenceNeededSql(): Prisma.Sql {
  const storageEnabled = isStorageUploadsEnabled();
  const production = String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
  if (!storageEnabled && !production) {
    return Prisma.sql`${terminalSql} AND ${rejectedEvidenceSql}`;
  }
  const types = Prisma.join(REQUIRED_TYPES.map((type) => Prisma.sql`${type}`));
  const incomplete = storageEnabled
    ? Prisma.sql`[type] IN (${types}) AND NOT (${uploadedPhotoSql(EvidenceType.BEFORE_PHOTO)} AND ${uploadedPhotoSql(EvidenceType.AFTER_PHOTO)})`
    : Prisma.sql`[type] IN (${types})`;
  return Prisma.sql`${terminalSql} AND (${rejectedEvidenceSql} OR (${incomplete}))`;
}

type Clause = { where: Prisma.WorkOrderWhereInput; sql: Prisma.Sql };

function viewClause(view: MyJobView, now: Date): Clause {
  if (view === "active") return { where: terminalWhere(), sql: terminalSql };
  if (view === "completed") {
    return {
      where: { status: { in: ["COMPLETED", "CLOSED"] } },
      sql: Prisma.sql`[status] IN (N'COMPLETED', N'CLOSED')`
    };
  }
  if (view === "in-progress") return { where: { status: "IN_PROGRESS" }, sql: Prisma.sql`[status] = N'IN_PROGRESS'` };
  if (view === "rework-required") {
    return { where: { status: "REWORK_REQUIRED" }, sql: Prisma.sql`[status] = N'REWORK_REQUIRED'` };
  }
  if (view === "overdue") return { where: myJobOverdueWhere(now), sql: overdueSql(now) };
  if (view === "waiting-parts") return { where: waitingPartsWhere(), sql: waitingPartsSql() };
  if (view === "evidence-needed") return { where: evidenceNeededWhere(), sql: evidenceNeededSql() };
  return { where: dueTodayWhere(now), sql: dueTodaySql(now) };
}

export function myJobViewWhere(view: MyJobView, now = new Date()): Prisma.WorkOrderWhereInput {
  return viewClause(view, now).where;
}

function filterClauses(filters: MyJobListFilters, now: Date): Clause[] {
  const clauses: Clause[] = [];
  if (filters.status) {
    clauses.push({ where: { status: filters.status }, sql: Prisma.sql`[status] = ${filters.status}` });
  }
  if (filters.priority) {
    clauses.push({ where: { priority: filters.priority }, sql: Prisma.sql`[priority] = ${filters.priority}` });
  }
  if (filters.due === "none") clauses.push({ where: { dueDate: null }, sql: Prisma.sql`[dueDate] IS NULL` });
  if (filters.due === "overdue") clauses.push({ where: myJobOverdueWhere(now), sql: overdueSql(now) });
  if (filters.due === "today") clauses.push({ where: dueTodayWhere(now), sql: dueTodaySql(now) });
  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    clauses.push({
      where: {
        OR: [
          { woNumber: { contains: search } },
          { title: { contains: search } },
          { asset: { is: { OR: [{ name: { contains: search } }, { assetTag: { contains: search } }] } } }
        ]
      },
      sql: Prisma.sql`(
        [woNumber] LIKE ${pattern} ESCAPE N'\\'
        OR [title] LIKE ${pattern} ESCAPE N'\\'
        OR EXISTS (
          SELECT 1 FROM [Asset] AS [asset]
          WHERE [asset].[id] = [WorkOrder].[assetId]
            AND (
              [asset].[name] LIKE ${pattern} ESCAPE N'\\'
              OR [asset].[assetTag] LIKE ${pattern} ESCAPE N'\\'
            )
        )
      )`
    });
  }
  return clauses;
}

export function myJobPageWhere(
  tenantId: string,
  userId: string,
  view: MyJobView,
  filters: MyJobListFilters,
  now: Date
): Prisma.WorkOrderWhereInput {
  const viewWhere = viewClause(view, now).where;
  const filtersWhere = filterClauses(filters, now).map((clause) => clause.where);
  return andWhere([myJobScopeWhere(tenantId, userId), viewWhere, ...filtersWhere]);
}

export function myJobCountWhere(tenantId: string, userId: string, view: MyJobView, now: Date): Prisma.WorkOrderWhereInput {
  return andWhere([myJobScopeWhere(tenantId, userId), viewClause(view, now).where]);
}

function pageSqlText(tenantId: string, userId: string, view: MyJobView, filters: MyJobListFilters, now: Date): Prisma.Sql {
  const parts = [scopeSql(tenantId, userId), viewClause(view, now).sql, ...filterClauses(filters, now).map((clause) => clause.sql)];
  return Prisma.join(
    parts.map((part) => Prisma.sql`(${part})`),
    " AND "
  );
}

export function myJobPageSql(input: {
  tenantId: string;
  userId: string;
  view: MyJobView;
  filters: MyJobListFilters;
  now: Date;
  skip: number;
  take: number;
}): Prisma.Sql {
  const start = businessDayWindow(input.now).start;
  const where = pageSqlText(input.tenantId, input.userId, input.view, input.filters, input.now);
  return Prisma.sql`
    SELECT [id] FROM [WorkOrder]
    WHERE ${where}
    ORDER BY
      CASE WHEN ${terminalSql} AND ([status] = N'OVERDUE' OR [dueDate] < ${start}) THEN 0 ELSE 1 END,
      CASE [priority]
        WHEN N'CRITICAL' THEN 0
        WHEN N'HIGH' THEN 1
        WHEN N'MEDIUM' THEN 2
        WHEN N'LOW' THEN 3
        ELSE 9
      END,
      CASE WHEN [dueDate] IS NULL THEN 1 ELSE 0 END,
      [dueDate],
      [id]
    OFFSET ${input.skip} ROWS FETCH NEXT ${input.take} ROWS ONLY
  `;
}

export function myJobViews(): readonly MyJobView[] {
  return MY_JOB_VIEWS;
}
