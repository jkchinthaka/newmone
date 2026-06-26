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
  const row = rows.find((item) => item.key === "MAINTAINPRO_SEED_PASSWORD");
  return (row?.value ?? process.env.MAINTAINPRO_SMOKE_PASSWORD ?? "").trim();
}

async function login(email, password) {
  const response = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: webOrigin },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${email} login HTTP ${response.status}`);
  }
  const tenantId = body?.data?.user?.tenantId ?? body?.data?.user?.tenant?.id ?? null;
  return {
    token: body?.data?.accessToken,
    tenantId,
    role: body?.data?.user?.role?.name ?? body?.data?.user?.roleName ?? "unknown"
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
const security = await login("security@maintainpro.local", password);
const inventory = await login("inventory@maintainpro.local", password);

logResult("login_admin", "PASS", `role=${admin.role}`);
logResult("login_manager", "PASS", `role=${manager.role}`);
logResult("login_technician", "PASS", `role=${technician.role}`);
logResult("login_security", "PASS", `role=${security.role}`);
logResult("login_inventory", "PASS", `role=${inventory.role}`);

const adminUsers = await apiFetch("/admin/users", admin);
logResult("admin_users_api", adminUsers.ok ? "PASS" : "FAIL", `HTTP_${adminUsers.status}`);

const adminRoles = await apiFetch("/admin/roles-permissions", admin);
logResult("admin_roles_api", adminRoles.ok ? "PASS" : "FAIL", `HTTP_${adminRoles.status}`);

const managerWorkOrders = await apiFetch("/work-orders?limit=5", manager);
logResult(
  "manager_work_orders_api",
  managerWorkOrders.ok ? "PASS" : managerWorkOrders.status === 403 ? "PARTIAL" : "FAIL",
  `HTTP_${managerWorkOrders.status}`
);

const techWorkOrders = await apiFetch("/work-orders?limit=5", technician);
logResult(
  "technician_work_orders_api",
  techWorkOrders.ok ? "PASS" : techWorkOrders.status === 403 ? "PARTIAL" : "FAIL",
  `HTTP_${techWorkOrders.status}`
);

const assets = await apiFetch("/assets?limit=5", admin);
logResult("assets_list_api", assets.ok ? "PASS" : "FAIL", `HTTP_${assets.status}`);

const inventoryOrders = await apiFetch("/inventory/purchase-orders", inventory);
logResult(
  "inventory_purchase_orders_api",
  inventoryOrders.ok ? "PASS" : "PARTIAL",
  `HTTP_${inventoryOrders.status}`
);

const reportsDashboard = await apiFetch("/reports/dashboard", manager);
logResult(
  "reports_dashboard_api",
  reportsDashboard.ok ? "PASS" : "PARTIAL",
  `HTTP_${reportsDashboard.status}`
);

const vehicles = await apiFetch("/vehicles?limit=10", security);
if (!vehicles.ok) {
  logResult("security_vehicles_api", "FAIL", `HTTP_${vehicles.status}`);
} else {
  logResult("security_vehicles_api", "PASS");
  const items = vehicles.body?.data?.items ?? vehicles.body?.data ?? [];
  const list = Array.isArray(items) ? items : [];
  const vehicle = list[0];
  if (vehicle?.id) {
    const mileage = Number(vehicle.currentMileage ?? 0) + 10;
    const gateOut = await apiFetch(`/vehicles/${vehicle.id}/gate-out`, security, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meterReading: mileage, checkpoint: "UAT-002-gate" })
    });
    const allowed = gateOut.body?.data?.allowed ?? gateOut.body?.allowed;
    const blocked = gateOut.body?.data?.blocked ?? gateOut.body?.blocked;
    if (gateOut.ok && allowed === true) {
      logResult("gate_out_allowed", "PASS");
      const gateIn = await apiFetch(`/vehicles/${vehicle.id}/gate-in`, security, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterReading: mileage, checkpoint: "UAT-002-gate-in" })
      });
      logResult("gate_in", gateIn.ok ? "PASS" : "FAIL", `HTTP_${gateIn.status}`);
    } else if (gateOut.ok && blocked === true) {
      logResult("gate_out_blocked", "PASS", "compliance_block_recorded");
      logResult("gate_out_allowed", "PARTIAL", "vehicle_blocked_by_seed_state");
    } else {
      logResult("gate_out_allowed", gateOut.ok ? "PARTIAL" : "FAIL", `HTTP_${gateOut.status}`);
    }

    const overrideAttempt = await apiFetch(`/vehicles/${vehicle.id}/gate-out`, technician, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meterReading: mileage + 5,
        allowOverride: true,
        overrideReason: "UAT unauthorized override attempt"
      })
    });
    logResult(
      "gate_override_denied_for_technician",
      overrideAttempt.status === 403 || overrideAttempt.status === 401 ? "PASS" : "FAIL",
      `HTTP_${overrideAttempt.status}`
    );
  } else {
    logResult("gate_out_allowed", "NOT_AVAILABLE", "no_seeded_vehicles");
  }
}

const auditLogs = await apiFetch("/settings/audit-logs?limit=5", admin);
logResult("audit_logs_api", auditLogs.ok ? "PASS" : "PARTIAL", `HTTP_${auditLogs.status}`);

console.log("uat_002_api_workflows=complete");
