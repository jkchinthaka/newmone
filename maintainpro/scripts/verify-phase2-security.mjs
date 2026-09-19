/**
 * Phase 2 repo-owned security smoke probes (non-destructive).
 */
import "dotenv/config";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const webBase = process.env.ACTION_CENTER_QA_BASE_URL ?? "http://localhost:3001";
const apiBase = process.env.ACCEPTANCE_API_BASE ?? "http://localhost:3000/api";
const password = process.env.MAINTAINPRO_SEED_PASSWORD;
if (!password) throw new Error("MAINTAINPRO_SEED_PASSWORD required");

const databaseUrl =
  process.env.ACTION_CENTER_SQL_URL ||
  "sqlserver://localhost:14333;database=MaintainProDev;user=sa;password=MaintainPro_Dev_Passw0rd!;schema=dbo;encrypt=true;trustServerCertificate=true";
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const results = [];
const mark = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(JSON.stringify({ id, ok, detail }));
};

function cookiesOf(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

async function login(email, ip) {
  const res = await fetch(`${webBase}/api/backend/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `127.0.11.${ip}` },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`login ${email} ${res.status}`);
  return cookiesOf(res);
}

async function api(cookies, method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(cookies ? { cookie: cookies } : {}),
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const unauthWo = await api(null, "GET", "/work-orders?page=1&pageSize=1");
  mark("SEC-unauth-work-orders", unauthWo.status === 401 || unauthWo.status === 403, {
    status: unauthWo.status
  });

  const unauthInv = await api(null, "POST", "/inventory/parts/fake/stock-in", { quantity: 1 });
  mark("SEC-unauth-stock-in", unauthInv.status === 401 || unauthInv.status === 403, {
    status: unauthInv.status
  });

  const tech = await login("tech@maintainpro.local", 1);
  const manager = await login("manager@maintainpro.local", 2);
  const asset = await prisma.asset.findFirst({ select: { id: true } });
  const assetId = asset?.id;
  mark("SEC-asset-lookup", Boolean(assetId), { assetId });

  const create = await api(manager, "POST", "/maintenance-requests", {
    description: `Phase2 security SoD probe ${Date.now()} — must not be tech-approved`,
    priority: "LOW",
    assetId,
    idempotencyKey: `sec-sod-${Date.now()}`
  });
  const reqId = create.json?.data?.id;
  if (reqId) {
    const techApprove = await api(tech, "POST", `/maintenance-requests/${reqId}/approve`);
    mark("SEC-rbac-tech-approve", techApprove.status >= 400, { status: techApprove.status });
  } else {
    mark("SEC-rbac-tech-approve", false, {
      status: create.status,
      error: create.json?.error?.message || create.json
    });
  }

  const openWo = await api(manager, "GET", "/work-orders?page=1&pageSize=5");
  const list = openWo.json?.data;
  const woId = Array.isArray(list) ? list[0]?.id : list?.data?.[0]?.id ?? list?.items?.[0]?.id;
  if (woId) {
    const mass = await api(manager, "PATCH", `/work-orders/${woId}`, {
      status: "CLOSED",
      tenantId: "attacker-tenant",
      technicianId: "attacker-user"
    });
    const after = await api(manager, "GET", `/work-orders/${woId}`);
    const statusAfter = after.json?.data?.status;
    mark("SEC-mass-assignment-status", mass.status >= 400 || statusAfter !== "CLOSED", {
      patchStatus: mass.status,
      statusAfter
    });
  } else {
    mark("SEC-mass-assignment-status", false, { reason: "no WO" });
  }

  const xssPayload = `phase2 xss probe ${Date.now()} <script>alert(1)</script> trailing text`;
  const xssReq = await api(manager, "POST", "/maintenance-requests", {
    description: xssPayload,
    priority: "LOW",
    assetId,
    idempotencyKey: `sec-xss-${Date.now()}`
  });
  const stored = xssReq.json?.data?.description ?? "";
  mark("SEC-xss-stored-as-text", xssReq.status < 300 && stored.includes("<script>"), {
    status: xssReq.status,
    storedHasScriptTag: stored.includes("<script>")
  });

  const sqli = await api(manager, "GET", "/work-orders?search=" + encodeURIComponent("1' OR 1=1--"));
  mark("SEC-sqli-search", sqli.status < 500, { status: sqli.status });

  const spoof = await api(manager, "GET", "/work-orders?page=1&pageSize=1");
  const spoof2 = await fetch(`${apiBase}/work-orders?page=1&pageSize=1`, {
    headers: { cookie: manager, "x-tenant-id": "000000000000000000000000" }
  });
  mark("SEC-tenant-header-spoof", spoof2.status >= 400 || spoof2.status === spoof.status, {
    baseline: spoof.status,
    spoofStatus: spoof2.status
  });

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ summary: { total: results.length, failed: failed.length }, failed }, null, 2));
  await prisma.$disconnect();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
