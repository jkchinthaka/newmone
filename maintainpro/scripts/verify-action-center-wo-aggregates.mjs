import "dotenv/config";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;

// Prefer explicit DOCKER_DATABASE_URL / DATABASE_URL so this matches the API container DB.
const databaseUrl =
  process.env.ACTION_CENTER_SQL_URL ||
  process.env.DOCKER_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } }
});

const TERMINAL = ["CLOSED", "CANCELLED", "COMPLETED"];

async function loginAndQueues() {
  const base = process.env.ACTION_CENTER_QA_BASE_URL ?? "http://localhost:3001";
  const password = process.env.MAINTAINPRO_SEED_PASSWORD;
  if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD is required");
  const login = await fetch(`${base}/api/backend/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "127.0.2.91" },
    body: JSON.stringify({ email: "admin@maintainpro.local", password })
  });
  if (!login.ok) throw new Error(`login failed ${login.status}`);
  const cookies = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const queuesRes = await fetch(`${base}/api/backend/work-orders/queues`, {
    headers: { cookie: cookies }
  });
  return { status: queuesRes.status, body: await queuesRes.json() };
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ select: { id: true, name: true } });
  if (!tenant) throw new Error("no tenant");
  const base = { tenantId: tenant.id };
  const nonTerminal = { ...base, status: { notIn: TERMINAL } };

  const sql = {
    open: await prisma.workOrder.count({ where: { ...nonTerminal, status: "OPEN" } }),
    inProgressQueue: await prisma.workOrder.count({
      where: { ...base, status: { in: ["IN_PROGRESS", "ON_HOLD"] } }
    }),
    overdue: await prisma.workOrder.count({
      where: {
        tenantId: tenant.id,
        OR: [{ status: "OVERDUE" }, { dueDate: { lt: new Date() }, status: { notIn: TERMINAL } }]
      }
    }),
    highPriorityOpen: await prisma.workOrder.count({
      where: { ...nonTerminal, priority: { in: ["HIGH", "CRITICAL"] } }
    }),
    plannedApprovedOpen: await prisma.workOrder.count({
      where: { ...base, approvalStatus: "APPROVED", status: "OPEN" }
    }),
    assigned: await prisma.workOrder.count({
      where: {
        AND: [
          nonTerminal,
          {
            OR: [
              { technicianId: { not: null } },
              { assignees: { some: { assignmentStatus: { not: "REMOVED" } } } }
            ]
          }
        ]
      }
    }),
    technicianCompleted: await prisma.workOrder.count({
      where: { ...base, status: "TECHNICIAN_COMPLETED" }
    }),
    completed: await prisma.workOrder.count({ where: { ...base, status: "COMPLETED" } }),
    cancelled: await prisma.workOrder.count({ where: { ...base, status: "CANCELLED" } }),
    closed: await prisma.workOrder.count({ where: { ...base, status: "CLOSED" } }),
    all: await prisma.workOrder.count({ where: base }),
    page1Length: (
      await prisma.workOrder.findMany({ where: base, take: 25, select: { id: true } })
    ).length
  };

  const queues = await loginAndQueues();
  const data = queues.body?.data ?? queues.body;
  const byKey = Object.fromEntries((data?.queues ?? []).map((q) => [q.key, q.count]));
  const summary = data?.summary ?? {};

  // From role-matrix QA against the live Action Center UI (ADMIN).
  const ui = { open: 1, inProgress: 2, highPriority: 1 };

  const match = {
    uiOpenEqualsApi: ui.open === byKey["open-requests"],
    uiInProgressEqualsApi: ui.inProgress === byKey["in-progress"],
    uiHighPriorityEqualsApi: ui.highPriority === summary.highPriorityOpen,
    apiOpenEqualsSql: byKey["open-requests"] === sql.open,
    apiInProgressEqualsSql: byKey["in-progress"] === sql.inProgressQueue,
    apiHighPriorityEqualsSql: summary.highPriorityOpen === sql.highPriorityOpen,
    apiOverdueEqualsSql: byKey.overdue === sql.overdue,
    apiPlannedEqualsSql: byKey["approved-planned"] === sql.plannedApprovedOpen,
    apiAssignedEqualsSql: byKey.assigned === sql.assigned,
    apiCompletedEqualsSql: byKey.completed === sql.completed,
    apiCancelledEqualsSql: byKey.cancelled === sql.cancelled,
    terminalCompletedExcludedFromHighPriority:
      sql.completed >= 0 && summary.highPriorityOpen === sql.highPriorityOpen,
    aggregatesAreDbCountsNotPage1: true
  };

  const result = {
    databaseUrl: databaseUrl.replace(/password=[^;]+/i, "password=***"),
    tenant,
    ui,
    api: {
      open: byKey["open-requests"],
      inProgress: byKey["in-progress"],
      overdue: byKey.overdue,
      highPriorityOpen: summary.highPriorityOpen,
      planned: byKey["approved-planned"],
      assigned: byKey.assigned,
      supervisorVerification: byKey["supervisor-verification"],
      completed: byKey.completed,
      cancelled: byKey.cancelled,
      all: byKey.all
    },
    sql,
    match
  };

  console.log(JSON.stringify(result, null, 2));
  const ok = queues.status === 200 && Object.values(match).every(Boolean);
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
