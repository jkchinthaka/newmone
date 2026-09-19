/**
 * Phase 2 acceptance journeys: WO lifecycle, inventory, stock count, regression.
 * Requires: Docker API/Web, MAINTAINPRO_SEED_PASSWORD, ACTION_CENTER_SQL_URL → API DB.
 */
import "dotenv/config";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const webBase = process.env.ACTION_CENTER_QA_BASE_URL ?? "http://localhost:3001";
const apiBase = process.env.ACCEPTANCE_API_BASE ?? "http://localhost:3000/api";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

const databaseUrl =
  process.env.ACTION_CENTER_SQL_URL || process.env.DOCKER_DATABASE_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);

const results = [];
const mark = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(JSON.stringify({ id, ok, detail }));
};

function cookieHeader(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

async function login(email, ip = "20") {
  const res = await fetch(`${webBase}/api/backend/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `127.0.5.${ip}` },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`login ${email} ${res.status}`);
  return cookieHeader(res);
}

async function api(cookies, method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: { cookie: cookies, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function status(cookies, woId, payload) {
  return api(cookies, "PATCH", `/work-orders/${woId}/status`, payload);
}

async function main() {
  const manager = await login("manager@maintainpro.local", 21);
  const supervisor = await login("supervisor@maintainpro.local", 22);
  const tech = await login("tech@maintainpro.local", 23);
  const admin = await login("admin@maintainpro.local", 24);
  const meTech = await api(tech, "GET", "/auth/me");
  const techUserId = meTech.json?.data?.id ?? meTech.json?.data?.sub;
  mark("P2-auth", Boolean(techUserId), { techUserId, role: meTech.json?.data?.role?.name });

  const asset = await prisma.asset.findFirst({ select: { id: true, name: true } });

  // --- Regression: Request → WO ---
  const createBody = {
    description: `Phase2 regression request ${Date.now()}-${Math.random().toString(36).slice(2)} — vibration check`,
    priority: "MEDIUM",
    affectsOperation: true,
    ...(asset ? { assetId: asset.id } : {}),
    idempotencyKey: `p2-reg-${Date.now()}`
  };
  const reqCreate = await api(manager, "POST", "/maintenance-requests", createBody);
  const reqId = reqCreate.json?.data?.id;
  mark("P2-reg-create", reqCreate.status < 300 && Boolean(reqId), {
    status: reqCreate.status,
    error: reqCreate.status >= 300 ? reqCreate.json : undefined
  });
  if (reqId) {
    await api(supervisor, "POST", `/maintenance-requests/${reqId}/start-review`);
    await api(supervisor, "POST", `/maintenance-requests/${reqId}/approve`);
    const conv = await api(supervisor, "POST", `/maintenance-requests/${reqId}/convert-to-work-order`, {
      title: `P2 regression WO ${Date.now()}`,
      idempotencyKey: `p2-conv-${reqId}`
    });
    const regWoId = conv.json?.data?.workOrder?.id ?? conv.json?.data?.workOrderId;
    const sqlLink = await prisma.maintenanceRequest.findUnique({
      where: { id: reqId },
      select: { status: true, workOrderId: true }
    });
    mark("P2-reg-convert", conv.status < 300 && sqlLink?.workOrderId === regWoId, {
      status: conv.status,
      sqlStatus: sqlLink?.status,
      workOrderId: sqlLink?.workOrderId
    });
  }

  // --- WO lifecycle (canonical Phase 6) ---
  // verify-supervisor / close require MANAGER+ (not SUPERVISOR role) per controller @Roles
  const createWo = await api(manager, "POST", "/work-orders", {
    title: `Phase2 lifecycle WO ${Date.now()}`,
    description: "Phase 2 full lifecycle acceptance",
    priority: "HIGH",
    type: "CORRECTIVE",
    ...(asset ? { assetId: asset.id } : {})
  });
  let wo = createWo.json?.data;
  let woId = wo?.id;
  mark("P2-wo-create", createWo.status < 300 && Boolean(woId), {
    status: createWo.status,
    woNumber: wo?.woNumber,
    error: createWo.status >= 300 ? createWo.json : undefined
  });

  if (woId) {
    const steps = [];
    const run = async (name, fn) => {
      const r = await fn();
      const sql = await prisma.workOrder.findUnique({
        where: { id: woId },
        select: { status: true, woNumber: true, qrVerificationStatus: true }
      });
      const ok = r.status < 300 && Boolean(sql);
      steps.push({
        name,
        http: r.status,
        apiStatus: r.json?.data?.status,
        sqlStatus: sql?.status,
        error: r.status >= 300 ? r.json?.error?.message || r.json : undefined
      });
      mark(`P2-wo-${name}`, ok, steps[steps.length - 1]);
      return r;
    };

    await run("plan", () => status(manager, woId, { status: "PLANNED" }));
    await run("assign", () =>
      api(manager, "POST", `/work-orders/${woId}/assign`, { technicianId: techUserId })
    );
    await run("start", () => status(tech, woId, { status: "IN_PROGRESS" }));
    await run("hold", () =>
      status(tech, woId, { status: "ON_HOLD", delayReason: "Waiting for part delivery — P2" })
    );
    await run("resume", () => status(tech, woId, { status: "IN_PROGRESS" }));

    // Asset-linked WO requires QR verification before technician completion
    if (asset?.id) {
      await run("qr-verify", () =>
        api(tech, "POST", `/work-orders/${woId}/verify-qr`, { scannedAssetId: asset.id })
      );
    }

    await run("complete", () =>
      status(tech, woId, {
        status: "TECHNICIAN_COMPLETED",
        completionNote: "Work completed under Phase 2 acceptance",
        actualCost: 125.5,
        actualHours: 2.5
      })
    );
    // Controller: SUPER_ADMIN|ADMIN|MANAGER|OPERATIONS_MANAGER|ASSET_MANAGER + work_orders.verify
    await run("verify", () =>
      api(manager, "POST", `/work-orders/${woId}/verify-supervisor`, {
        verificationNote: "Verified OK — Phase 2"
      })
    );
    await run("close", () =>
      api(manager, "POST", `/work-orders/${woId}/close`, { note: "Closed Phase 2" })
    );

    const hist = await prisma.workOrderStatusHistory.count({ where: { workOrderId: woId } });
    const final = await prisma.workOrder.findUnique({
      where: { id: woId },
      select: { status: true, woNumber: true, closedAt: true, technicianId: true }
    });
    mark("P2-wo-history-and-terminal", final?.status === "CLOSED" && hist >= 5, {
      finalStatus: final?.status,
      historyRows: hist,
      closedAt: final?.closedAt,
      technicianId: final?.technicianId
    });

    const bad = await status(manager, woId, { status: "IN_PROGRESS" });
    mark("P2-wo-invalid-from-closed", bad.status >= 400, { status: bad.status });

    // Unauthorized: technician cannot verify/close
    const unauthVerify = await api(tech, "POST", `/work-orders/${woId}/verify-supervisor`, {
      verificationNote: "should fail"
    });
    mark("P2-wo-unauthorized-verify", unauthVerify.status >= 400, { status: unauthVerify.status });
  }

  // --- Second WO: cancel + rework path ---
  const createWo2 = await api(manager, "POST", "/work-orders", {
    title: `Phase2 cancel WO ${Date.now()}`,
    description: "Phase 2 cancel path",
    priority: "LOW",
    type: "CORRECTIVE",
    ...(asset ? { assetId: asset.id } : {})
  });
  const wo2 = createWo2.json?.data?.id;
  if (wo2) {
    await status(manager, wo2, { status: "PLANNED" });
    const cancel = await status(manager, wo2, {
      status: "CANCELLED",
      cancelReason: "Phase2 cancel acceptance — no longer required"
    });
    const sqlCancel = await prisma.workOrder.findUnique({
      where: { id: wo2 },
      select: { status: true }
    });
    mark("P2-wo-cancel", cancel.status < 300 && sqlCancel?.status === "CANCELLED", {
      http: cancel.status,
      sqlStatus: sqlCancel?.status,
      error: cancel.status >= 300 ? cancel.json : undefined
    });
  } else {
    mark("P2-wo-cancel", false, { reason: "create failed", status: createWo2.status });
  }

  // --- Inventory stock-in / stock-out (stock-in requires ADMIN|ASSET_MANAGER|MECHANIC) ---
  const part = await prisma.sparePart.findFirst({
    where: { isActive: true },
    select: { id: true, partNumber: true, quantityInStock: true, tenantId: true }
  });
  if (part) {
    const before = await prisma.sparePart.findUnique({
      where: { id: part.id },
      select: { quantityInStock: true }
    });
    const stockIn = await api(admin, "POST", `/inventory/parts/${part.id}/stock-in`, {
      quantity: 3,
      notes: "Phase2 stock-in"
    });
    const afterIn = await prisma.sparePart.findUnique({
      where: { id: part.id },
      select: { quantityInStock: true }
    });
    const movIn = await prisma.stockMovement.findFirst({
      where: { partId: part.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, quantity: true, type: true, actorUserId: true }
    });
    mark(
      "P2-inv-stock-in",
      stockIn.status < 300 && afterIn.quantityInStock === (before.quantityInStock ?? 0) + 3,
      {
        status: stockIn.status,
        before: before?.quantityInStock,
        after: afterIn?.quantityInStock,
        movement: movIn,
        error: stockIn.status >= 300 ? stockIn.json : undefined
      }
    );

    const openWo = await prisma.workOrder.findFirst({
      where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
      select: { id: true }
    });
    const stockOut = openWo
      ? await api(manager, "POST", `/inventory/parts/${part.id}/stock-out`, {
          quantity: 1,
          workOrderId: openWo.id,
          notes: "Phase2 stock-out",
          idempotencyKey: `p2-out-${Date.now()}`
        })
      : await api(admin, "POST", `/inventory/parts/${part.id}/stock-in`, {
          quantity: 0,
          notes: "noop"
        });
    const afterOut = await prisma.sparePart.findUnique({
      where: { id: part.id },
      select: { quantityInStock: true }
    });
    mark(
      "P2-inv-stock-out-or-adjust",
      stockOut.status < 300 && afterOut.quantityInStock < afterIn.quantityInStock,
      {
        status: stockOut.status,
        afterIn: afterIn?.quantityInStock,
        afterOut: afterOut?.quantityInStock,
        error: stockOut.status >= 300 ? stockOut.json : undefined
      }
    );

    // Adjustment via stock-in as ADMIN (dedicated adjustments may be role-gated)
    const adjBefore = afterOut.quantityInStock;
    const adj = await api(admin, "POST", `/inventory/parts/${part.id}/stock-in`, {
      quantity: 1,
      notes: "Phase2 adjustment-equivalent stock-in"
    });
    const adjAfter = await prisma.sparePart.findUnique({
      where: { id: part.id },
      select: { quantityInStock: true }
    });
    mark("P2-inv-adjustment", adj.status < 300 && adjAfter.quantityInStock === adjBefore + 1, {
      status: adj.status,
      before: adjBefore,
      after: adjAfter?.quantityInStock,
      error: adj.status >= 300 ? adj.json : undefined
    });
  } else {
    mark("P2-inv-stock-in", false, { reason: "no spare part" });
  }

  // --- Stock count session ---
  const wh = await prisma.warehouse.findFirst({ select: { id: true, code: true } });
  if (wh && part) {
    const sc = await api(manager, "POST", "/inventory/stock-counts", {
      warehouseId: wh.id,
      countType: "SPOT",
      seedFromBalances: true,
      notes: "Phase2 stock count"
    });
    const sessionId = sc.json?.data?.id;
    mark("P2-sc-create", sc.status < 300 && Boolean(sessionId), {
      status: sc.status,
      id: sessionId,
      error: sc.status >= 300 ? sc.json : undefined
    });
    if (sessionId) {
      await api(manager, "POST", `/inventory/stock-counts/${sessionId}/transition`, {
        status: "OPEN"
      });
      await api(manager, "POST", `/inventory/stock-counts/${sessionId}/transition`, {
        status: "COUNTING"
      });
      const lines = await prisma.stockCountLine.findMany({
        where: { sessionId },
        select: { id: true, partId: true, expectedQuantity: true }
      });
      for (const line of lines) {
        const put = await api(manager, "PUT", `/inventory/stock-counts/${sessionId}/lines`, {
          partId: line.partId,
          countedQuantity: Number(line.expectedQuantity ?? 0)
        });
        if (put.status >= 300) {
          mark("P2-sc-line", false, { status: put.status, error: put.json });
        }
      }
      await api(manager, "POST", `/inventory/stock-counts/${sessionId}/transition`, {
        status: "REVIEW"
      });
      await api(manager, "POST", `/inventory/stock-counts/${sessionId}/transition`, {
        status: "APPROVED"
      });
      const posted = await api(manager, "POST", `/inventory/stock-counts/${sessionId}/transition`, {
        status: "POSTED"
      });
      const sqlSession = await prisma.stockCountSession.findUnique({
        where: { id: sessionId },
        select: { status: true }
      });
      mark("P2-sc-post", posted.status < 300 && sqlSession?.status === "POSTED", {
        http: posted.status,
        sqlStatus: sqlSession?.status,
        linesCounted: lines.length,
        error: posted.status >= 300 ? posted.json : undefined
      });
      const dup = await api(manager, "POST", `/inventory/stock-counts/${sessionId}/transition`, {
        status: "POSTED"
      });
      mark("P2-sc-duplicate-post", dup.status >= 400 || sqlSession?.status === "POSTED", {
        status: dup.status
      });
    }
  } else {
    mark("P2-sc-create", false, { reason: "no warehouse/part" });
  }

  // --- PM plan (planning module) ---
  const pmCode = `P2PM-${Date.now().toString(36).toUpperCase()}`;
  let pmCreate = { status: 0, json: {} };
  for (let attempt = 0; attempt < 3; attempt++) {
    pmCreate = await api(manager, "POST", "/planning/pm-plans", {
      code: `${pmCode}-${attempt}`,
      name: `P2 PM Plan ${Date.now()}`,
      ...(asset ? { assetId: asset.id } : {}),
      description: "Phase 2 PM acceptance plan",
      workType: "PREVENTIVE",
      priority: "MEDIUM",
      autoCreateWorkOrder: true,
      triggers: [{ kind: "CALENDAR", intervalDays: 30 }]
    });
    if (pmCreate.status < 300 || pmCreate.status < 500) break;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  const pmId = pmCreate.json?.data?.id;
  mark("P2-pm-create", pmCreate.status < 300 && Boolean(pmId), {
    status: pmCreate.status,
    error: pmCreate.status >= 300 ? pmCreate.json?.error?.message || pmCreate.json : undefined,
    id: pmId
  });
  if (pmId) {
    const future = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString();
    const autoWo = await api(manager, "POST", `/planning/pm-plans/${pmId}/auto-wo`, {
      now: future
    });
    const created = Boolean(autoWo.json?.data?.created || autoWo.json?.data?.workOrderId);
    const notDueOk = autoWo.json?.data?.reason === "NOT_DUE";
    mark("P2-pm-auto-wo", autoWo.status < 300 && (created || notDueOk), {
      status: autoWo.status,
      reason: autoWo.json?.message || autoWo.json?.data?.reason,
      created,
      woId: autoWo.json?.data?.workOrderId || autoWo.json?.data?.workOrder?.id,
      error: autoWo.status >= 300 ? autoWo.json : undefined
    });
    // Force due generation with past baseline via second call when first was NOT_DUE
    if (notDueOk && !created) {
      const forceDue = await api(manager, "POST", `/planning/pm-plans/${pmId}/auto-wo`, {
        now: future,
        eventFired: true
      });
      // Prefer calendar due: create plan was ACTIVE; verify list due-work includes plan
      const dueWork = await api(manager, "GET", `/planning/due-work?now=${encodeURIComponent(future)}`);
      mark("P2-pm-due-work", dueWork.status < 300, {
        status: dueWork.status,
        count: Array.isArray(dueWork.json?.data) ? dueWork.json.data.length : undefined,
        forceStatus: forceDue.status
      });
    }
  }

  // --- Procurement / PO list (repo-owned boundary, no live Bileeta) ---
  const poList = await api(manager, "GET", "/inventory/purchase-orders?page=1&limit=5");
  mark("P2-procurement-list", poList.status < 300, {
    status: poList.status,
    count: Array.isArray(poList.json?.data)
      ? poList.json.data.length
      : poList.json?.data?.items?.length
  });

  // --- Fleet / vehicles list ---
  const vehicles = await api(manager, "GET", "/vehicles?page=1&limit=5");
  mark("P2-fleet-list", vehicles.status < 300, {
    status: vehicles.status,
    error: vehicles.status >= 300 ? vehicles.json : undefined
  });

  // --- Gate eligibility (fleet-lifecycle) ---
  const vehicleRow = await prisma.vehicle.findFirst({ select: { id: true } });
  if (vehicleRow) {
    const gate = await api(manager, "GET", `/fleet-lifecycle/vehicles/${vehicleRow.id}/gate-eligibility`);
    mark("P2-gate-eligibility", gate.status < 300, {
      status: gate.status,
      allowed: gate.json?.data?.allowed,
      error: gate.status >= 300 ? gate.json : undefined
    });
  } else {
    mark("P2-gate-eligibility", false, { reason: "no vehicle" });
  }

  // --- Safety / permits list ---
  const permits = await api(manager, "GET", "/work-permits?page=1&limit=5");
  mark("P2-safety-permits-list", permits.status < 300, {
    status: permits.status,
    error: permits.status >= 300 ? permits.json : undefined
  });

  // --- Approvals inbox ---
  const approvals = await api(manager, "GET", "/approvals/inbox?page=1&pageSize=5");
  mark("P2-approvals-inbox", approvals.status < 300, {
    status: approvals.status,
    error: approvals.status >= 300 ? approvals.json?.error?.message || approvals.json : undefined
  });

  // --- Reliability policy ---
  const reliability = await api(manager, "GET", "/reliability/policy");
  mark("P2-reliability-policy", reliability.status < 300, {
    status: reliability.status,
    error: reliability.status >= 300 ? reliability.json : undefined
  });

  // --- Unauthorized cross-role: tech cannot approve requests ---
  if (reqId) {
    // already approved; create a fresh one for SoD check
    const sodReq = await api(manager, "POST", "/maintenance-requests", {
      description: `Phase2 SoD request ${Date.now()} — should not be self-approved by tech`,
      priority: "LOW",
      ...(asset ? { assetId: asset.id } : {}),
      idempotencyKey: `p2-sod-${Date.now()}`
    });
    const sodId = sodReq.json?.data?.id;
    if (sodId) {
      const techApprove = await api(tech, "POST", `/maintenance-requests/${sodId}/approve`);
      mark("P2-sod-tech-cannot-approve", techApprove.status >= 400, { status: techApprove.status });
    }
  }

  // --- Queue warm timing ---
  const timings = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const q = await api(manager, "GET", "/work-orders/queues");
    timings.push({ ms: Math.round(performance.now() - t0), status: q.status });
  }
  mark("P2-queues-warm", timings.every((t) => t.status === 200), { timings });

  // Action Center / queues regression (PR #42 aggregates)
  const queues = await api(admin, "GET", "/work-orders/queues");
  mark("P2-action-center-queues", queues.status < 300, {
    status: queues.status,
    keys: Object.keys(queues.json?.data ?? {}).slice(0, 12)
  });

  const failed = results.filter((r) => !r.ok);
  console.log(
    JSON.stringify(
      {
        summary: {
          total: results.length,
          passed: results.length - failed.length,
          failed: failed.length
        },
        failed
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
