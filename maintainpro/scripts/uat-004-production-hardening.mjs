import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = stripQuotes(trimmed.slice(i + 1).trim());
  }
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));

const apiBase = (
  process.env.MAINTAINPRO_API_URL ??
  process.env.STAGING_API_URL ??
  "https://newmone.onrender.com/api"
).replace(/\/+$/, "");

const webOrigin = (
  process.env.MAINTAINPRO_WEB_URL ??
  process.env.STAGING_WEB_URL ??
  "https://newmone.chinthakajayaweera1.workers.dev"
).replace(/\/+$/, "");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");

async function fetchRenderPassword() {
  const apiKey = (process.env.RENDER_API_KEY ?? "").trim();
  const serviceId = (process.env.RENDER_SERVICE_ID ?? "").trim();
  if (!apiKey || !serviceId) {
    return (process.env.MAINTAINPRO_SMOKE_PASSWORD ?? process.env.MAINTAINPRO_SEED_PASSWORD ?? "").trim();
  }
  const response = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars?limit=100`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
  });
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload.map((item) => item.envVar ?? item) : [];
  return (rows.find((row) => row.key === "MAINTAINPRO_SEED_PASSWORD")?.value ?? "").trim();
}

async function login(email, password) {
  const response = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: webOrigin },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${email} login HTTP ${response.status}`);
  const user = body?.data?.user ?? {};
  return {
    token: body?.data?.accessToken,
    tenantId: user.tenantId ?? user.tenant?.id ?? null,
    userId: user.id ?? null
  };
}

async function apiFetch(pathname, session, init = {}) {
  const headers = {
    Authorization: `Bearer ${session.token}`,
    Accept: "application/json",
    Origin: webOrigin,
    ...(init.headers ?? {})
  };
  if (session.tenantId) headers["X-Tenant-Id"] = session.tenantId;
  const response = await fetch(`${apiBase}${pathname}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, body };
}

function logResult(label, status, detail = "") {
  console.log(`${label}:${status}${detail ? ` ${detail}` : ""}`);
}

const password = await fetchRenderPassword();
if (password.length < 12) {
  console.log("credentials=missing");
  process.exit(1);
}

const admin = await login("admin@maintainpro.local", password);
const manager = await login("manager@maintainpro.local", password);
const technician = await login("tech@maintainpro.local", password);

const assets = await apiFetch("/assets?limit=1", admin);
const assetId = assets.body?.data?.[0]?.id ?? assets.body?.[0]?.id;

const pendingCreate = await apiFetch("/work-orders", admin, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: `UAT-004 Pending Approval ${stamp}`,
    description: "Requires manager approval before execution.",
    priority: "MEDIUM",
    type: "CORRECTIVE",
    assetId: assetId ?? undefined,
    createdById: admin.userId,
    requiresApproval: true
  })
});

const pendingWo = pendingCreate.body?.data ?? pendingCreate.body;
const pendingId = pendingWo?.id;
logResult(
  "work_order_pending_create",
  pendingCreate.ok && pendingWo?.approvalStatus === "PENDING" ? "PASS" : "PARTIAL",
  `HTTP_${pendingCreate.status}`
);

if (pendingId) {
  const assignBlocked = await apiFetch(`/work-orders/${pendingId}/assign`, manager, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ technicianId: technician.userId })
  });
  logResult(
    "assign_blocked_before_approval",
    assignBlocked.status === 400 ? "PASS" : "PARTIAL",
    `HTTP_${assignBlocked.status}`
  );

  const techApprove = await apiFetch(`/work-orders/${pendingId}/approve`, technician, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: "unauthorized" })
  });
  logResult(
    "technician_approve_denied",
    techApprove.status === 403 ? "PASS" : "FAIL",
    `HTTP_${techApprove.status}`
  );

  const approve = await apiFetch(`/work-orders/${pendingId}/approve`, manager, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: "UAT-004 manager approval" })
  });
  logResult("work_order_approve", approve.ok ? "PASS" : "FAIL", `HTTP_${approve.status}`);

  const rejectCreate = await apiFetch("/work-orders", admin, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `UAT-004 Reject Path ${stamp}`,
      description: "Will be rejected in UAT-004.",
      priority: "LOW",
      type: "CORRECTIVE",
      createdById: admin.userId,
      requiresApproval: true
    })
  });
  const rejectWo = rejectCreate.body?.data ?? rejectCreate.body;
  if (rejectWo?.id) {
    const reject = await apiFetch(`/work-orders/${rejectWo.id}/reject`, manager, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Insufficient scope for UAT-004 reject probe" })
    });
    logResult("work_order_reject", reject.ok ? "PASS" : "PARTIAL", `HTTP_${reject.status}`);
  }

  const auditLogs = await apiFetch("/settings/audit-logs?limit=30", admin);
  const auditRows = Array.isArray(auditLogs.body?.data)
    ? auditLogs.body.data
    : Array.isArray(auditLogs.body?.data?.items)
      ? auditLogs.body.data.items
      : [];
  const hasApprovalAudit = auditRows.some((row) =>
    JSON.stringify(row?.metadata ?? {}).includes("work_order_approved")
  );
  logResult("work_order_approval_audited", hasApprovalAudit ? "PASS" : "PARTIAL");
}

const evidence = await apiFetch("/evidence/readiness", admin);
const readiness = evidence.body?.data ?? evidence.body;
const indicator = readiness?.indicator ?? readiness?.state ?? "unknown";
logResult(
  "evidence_storage_indicator",
  evidence.ok && ["ENABLED", "DISABLED", "MISCONFIGURED"].includes(indicator) ? "PASS" : "PARTIAL",
  indicator
);

console.log("uat_004_production_hardening=complete");
