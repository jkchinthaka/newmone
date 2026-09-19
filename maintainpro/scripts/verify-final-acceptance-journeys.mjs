import "dotenv/config";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;

const webBase = process.env.ACTION_CENTER_QA_BASE_URL ?? "http://localhost:3001";
const apiBase = process.env.ACCEPTANCE_API_BASE ?? "http://localhost:3000/api";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

const databaseUrl =
  process.env.ACTION_CENTER_SQL_URL ||
  process.env.DOCKER_DATABASE_URL ||
  process.env.DATABASE_URL;
const prisma = new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);

function cookieHeader(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

async function login(email, ipSuffix = "10") {
  const res = await fetch(`${webBase}/api/backend/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `127.0.3.${ipSuffix}` },
    body: JSON.stringify({ email, password })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`login ${email} ${res.status} ${JSON.stringify(body)}`);
  return { cookies: cookieHeader(res), body };
}

async function api(cookies, method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      cookie: cookies,
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const results = [];
  const mark = (id, ok, detail) => {
    results.push({ id, ok, detail });
    console.log(JSON.stringify({ id, ok, detail }));
  };

  // --- Auth + session ---
  const manager = await login("manager@maintainpro.local", 11);
  const supervisor = await login("supervisor@maintainpro.local", 12);
  mark("AUTH-manager", Boolean(manager.cookies.includes("maintainpro_access")), {
    hasAccessCookie: manager.cookies.includes("maintainpro_access")
  });

  const me = await api(manager.cookies, "GET", "/auth/me");
  mark("AUTH-me", me.status === 200, { status: me.status, role: me.json?.data?.role?.name });

  // --- Blank validation ---
  const blank = await api(manager.cookies, "POST", "/maintenance-requests", { description: "x" });
  mark("REQ-validation-short-description", blank.status >= 400, { status: blank.status });

  // --- Create request ---
  const asset = await prisma.asset.findFirst({ select: { id: true, name: true, tenantId: true } });
  const createBody = {
    description: `Final acceptance journey ${Date.now()}-${Math.random().toString(36).slice(2)} — pump vibration check`,
    priority: "HIGH",
    affectsOperation: true,
    businessImpact: "Line slowdown risk",
    ...(asset ? { assetId: asset.id } : {}),
    idempotencyKey: `fa-req-${Date.now()}-${Math.random().toString(36).slice(2)}`
  };
  const created = await api(manager.cookies, "POST", "/maintenance-requests", createBody);
  const request = created.json?.data;
  mark("REQ-create", created.status < 300 && Boolean(request?.id), {
    status: created.status,
    id: request?.id,
    number: request?.requestNumber ?? request?.number,
    statusValue: request?.status,
    error: created.status >= 300 ? created.json : undefined
  });
  if (!request?.id) {
    console.log(JSON.stringify({ results }, null, 2));
    process.exit(1);
  }

  const sqlReq = await prisma.maintenanceRequest.findUnique({
    where: { id: request.id },
    select: {
      id: true,
      status: true,
      description: true,
      tenantId: true,
      priority: true,
      requestNumber: true,
      assetId: true,
      reportedById: true,
      workOrderId: true
    }
  });
  mark("REQ-sql-persist", Boolean(sqlReq) && sqlReq.description === createBody.description, {
    apiDescription: request.description,
    sqlDescription: sqlReq?.description,
    apiStatus: request.status,
    sqlStatus: sqlReq?.status,
    tenantMatch: Boolean(sqlReq?.tenantId),
    requestNumber: sqlReq?.requestNumber
  });

  // Duplicate idempotency (same key)
  const dup = await api(manager.cookies, "POST", "/maintenance-requests", createBody);
  mark("REQ-idempotency", dup.status < 300, {
    status: dup.status,
    sameId: dup.json?.data?.id === request.id,
    message: dup.json?.message
  });

  // --- Supervisor triage path ---
  const startReview = await api(supervisor.cookies, "POST", `/maintenance-requests/${request.id}/start-review`);
  mark("REQ-start-review", startReview.status < 300, {
    status: startReview.status,
    newStatus: startReview.json?.data?.status
  });

  const approve = await api(supervisor.cookies, "POST", `/maintenance-requests/${request.id}/approve`);
  mark("REQ-approve", approve.status < 300, {
    status: approve.status,
    newStatus: approve.json?.data?.status
  });

  const convert = await api(supervisor.cookies, "POST", `/maintenance-requests/${request.id}/convert-to-work-order`, {
    title: `FA WO from ${sqlReq?.requestNumber ?? request.id}`,
    idempotencyKey: `fa-convert-${request.id}`
  });
  const wo = convert.json?.data?.workOrder ?? convert.json?.data;
  mark("REQ-convert-wo", convert.status < 300 && Boolean(wo?.id || convert.json?.data?.workOrderId), {
    status: convert.status,
    bodyKeys: Object.keys(convert.json?.data ?? {}),
    alreadyConverted: convert.json?.data?.alreadyConverted,
    woId: wo?.id ?? convert.json?.data?.workOrderId,
    woNumber: wo?.woNumber
  });

  const woId = wo?.id ?? convert.json?.data?.workOrderId;
  let sqlWo = null;
  if (woId) {
    sqlWo = await prisma.workOrder.findUnique({
      where: { id: woId },
      select: {
        id: true,
        woNumber: true,
        status: true,
        priority: true,
        tenantId: true,
        title: true
      }
    });
    mark("WO-sql-persist", Boolean(sqlWo), {
      apiWoNumber: wo?.woNumber,
      sqlWoNumber: sqlWo?.woNumber,
      apiStatus: wo?.status,
      sqlStatus: sqlWo?.status,
      priority: sqlWo?.priority
    });

    const linked = await prisma.maintenanceRequest.findUnique({
      where: { id: request.id },
      select: { status: true, workOrderId: true }
    });
    mark("REQ-WO-linkage", Boolean(linked?.workOrderId) && linked.workOrderId === woId, {
      requestStatus: linked?.status,
      workOrderId: linked?.workOrderId
    });

    // Duplicate convert should be idempotent
    const convert2 = await api(supervisor.cookies, "POST", `/maintenance-requests/${request.id}/convert-to-work-order`, {
      title: "duplicate convert attempt"
    });
    mark("REQ-convert-idempotent", convert2.status < 300 && (convert2.json?.data?.alreadyConverted === true || (convert2.json?.data?.workOrder?.id ?? convert2.json?.data?.workOrderId) === woId), {
      status: convert2.status,
      alreadyConverted: convert2.json?.data?.alreadyConverted,
      woId: convert2.json?.data?.workOrder?.id ?? convert2.json?.data?.workOrderId
    });
  }

  // --- Queues aggregate still consistent ---
  const queues = await api(manager.cookies, "GET", "/work-orders/queues");
  mark("WO-queues", queues.status === 200 && Array.isArray(queues.json?.data?.queues), {
    status: queues.status,
    highPriorityOpen: queues.json?.data?.summary?.highPriorityOpen,
    open: queues.json?.data?.queues?.find((q) => q.key === "open-requests")?.count
  });

  // --- Cancel path does not create WO when cancelled early (separate request) ---
  const cancelCreate = await api(manager.cookies, "POST", "/maintenance-requests", {
    description: `Final acceptance cancel path ${Date.now()} — should not convert`,
    priority: "LOW",
    idempotencyKey: `fa-cancel-${Date.now()}`
  });
  const cancelId = cancelCreate.json?.data?.id;
  if (cancelId) {
    const cancelled = await api(manager.cookies, "POST", `/maintenance-requests/${cancelId}/cancel`, {
      reason: "Acceptance cancel — no WO expected"
    });
    const sqlCancel = await prisma.maintenanceRequest.findUnique({
      where: { id: cancelId },
      select: { status: true, workOrderId: true }
    });
    mark("REQ-cancel-no-wo", cancelled.status < 300 && !sqlCancel?.workOrderId, {
      apiStatus: cancelled.status,
      sqlStatus: sqlCancel?.status
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ summary: { total: results.length, passed: results.length - failed.length, failed: failed.length }, failed }, null, 2));
  await prisma.$disconnect();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
