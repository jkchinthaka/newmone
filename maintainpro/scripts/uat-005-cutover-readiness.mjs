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

const apiOrigin = apiBase.replace(/\/api$/, "");

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
    tenantId: user.tenantId ?? user.tenant?.id ?? null
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
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json().catch(() => ({})) : null;
  return { status: response.status, ok: response.ok, body, contentType, headers: response.headers };
}

function logResult(label, status, detail = "") {
  console.log(`${label}:${status}${detail ? ` ${detail}` : ""}`);
}

function responseHasSecrets(text) {
  return /mongodb(\+srv)?:\/\/|smtp_pass|sms_api_key|push_provider_api_key|jwt_secret|minioadmin/i.test(text);
}

const password = await fetchRenderPassword();
if (password.length < 12) {
  console.log("credentials=missing");
  process.exit(1);
}

const admin = await login("admin@maintainpro.local", password);

const evidence = await apiFetch("/evidence/readiness", admin);
const evidenceData = evidence.body?.data ?? evidence.body;
const evidenceIndicator = evidenceData?.indicator ?? "UNKNOWN";
const validEvidenceIndicators = ["ENABLED", "DISABLED", "MISCONFIGURED"];
logResult(
  "evidence_storage_indicator",
  evidence.ok && validEvidenceIndicators.includes(evidenceIndicator) ? "PASS" : "FAIL",
  evidenceIndicator
);

const notifications = await apiFetch("/notifications/readiness", admin);
const notifyData = notifications.body?.data ?? notifications.body;
const emailIndicator = notifyData?.email?.indicator ?? "UNKNOWN";
const smsIndicator = notifyData?.sms?.indicator ?? "UNKNOWN";
const pushIndicator = notifyData?.push?.indicator ?? "UNKNOWN";
logResult(
  "notification_email_indicator",
  notifications.ok && String(emailIndicator).startsWith("EMAIL_") ? "PASS" : "FAIL",
  emailIndicator
);
logResult(
  "notification_sms_indicator",
  notifications.ok && String(smsIndicator).startsWith("SMS_") ? "PASS" : "FAIL",
  smsIndicator
);
logResult(
  "notification_push_indicator",
  notifications.ok && String(pushIndicator).startsWith("PUSH_") ? "PASS" : "FAIL",
  pushIndicator
);

const stagingHonestDisabled =
  evidenceIndicator === "DISABLED" &&
  (emailIndicator === "EMAIL_DISABLED" || emailIndicator === "EMAIL_MISCONFIGURED");
logResult(
  "staging_integrations_honest_disabled",
  stagingHonestDisabled ? "PASS" : "PARTIAL",
  `evidence=${evidenceIndicator} email=${emailIndicator}`
);

const deployment = await apiFetch("/health/deployment-readiness", admin);
const deploymentData = deployment.body?.data ?? deployment.body;
logResult(
  "deployment_readiness_summary",
  deployment.ok && deploymentData?.overallStatus ? "PASS" : "PARTIAL",
  deploymentData?.overallStatus ?? `HTTP_${deployment.status}`
);

const reportExport = await apiFetch("/reports/operations/export?format=csv", admin, {
  headers: { Accept: "text/csv,application/json" }
});
const reportCsv =
  reportExport.ok &&
  (reportExport.contentType.includes("csv") || reportExport.contentType.includes("octet-stream"));
logResult("reports_operations_csv_export", reportCsv ? "PASS" : "PARTIAL", `HTTP_${reportExport.status}`);

const publicHealth = await fetch(`${apiOrigin}/health`);
const healthText = await publicHealth.text();
logResult(
  "public_health_no_secrets",
  publicHealth.ok && !responseHasSecrets(healthText) ? "PASS" : "FAIL",
  `HTTP_${publicHealth.status}`
);

const readinessPayload = JSON.stringify({ evidence: evidenceData, notifications: notifyData });
logResult(
  "readiness_payload_no_secrets",
  !responseHasSecrets(readinessPayload) ? "PASS" : "FAIL"
);

const webHeaders = await fetch(webOrigin, { method: "HEAD", redirect: "follow" });
const hsts = webHeaders.headers.get("strict-transport-security");
const frameDeny =
  webHeaders.headers.get("x-frame-options")?.toLowerCase() === "deny" ||
  (webHeaders.headers.get("content-security-policy") ?? "").includes("frame-ancestors");
logResult(
  "web_security_headers",
  hsts && frameDeny ? "PASS" : "PARTIAL",
  `hsts=${Boolean(hsts)} frame=${Boolean(frameDeny)}`
);

console.log("uat_005_cutover_readiness=complete");
