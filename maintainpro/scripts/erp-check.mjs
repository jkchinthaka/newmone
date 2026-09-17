#!/usr/bin/env node
/**
 * Read-only Bileeta / ERP connectivity check.
 * Refuses write/apply modes. Redacts secrets from output.
 *
 * Usage:
 *   npm run erp:check
 *   ERP_CHECK_ITEM_CODE=TEST npm run erp:check
 */
const mode = String(process.env.ERP_CHECK_MODE || "read").toLowerCase();
if (["write", "apply", "mutate", "post", "put", "delete"].includes(mode)) {
  console.error("REFUSED: erp:check is read-only. Unset ERP_CHECK_MODE write/apply.");
  process.exit(2);
}

function redact(value) {
  if (!value) return "(missing)";
  const s = String(value);
  if (s.length <= 8) return "***";
  return `${s.slice(0, 4)}…${s.slice(-2)} (len=${s.length})`;
}

const baseUrl = process.env.BILEETA_BASE_URL || process.env.ERP_BASE_URL || "";
const apiKey = process.env.BILEETA_API_KEY || process.env.ERP_API_KEY || "";
const enabled = String(process.env.ERP_ENABLED || process.env.BILEETA_ENABLED || "").toLowerCase() === "true";

console.log("MaintainPro ERP read-only check");
console.log(`  enabled: ${enabled}`);
console.log(`  baseUrl: ${baseUrl ? redact(baseUrl) : "(not set)"}`);
console.log(`  apiKey:  ${redact(apiKey)}`);

if (!enabled || !baseUrl || !apiKey) {
  console.log("RESULT: EXTERNAL — live credentials/config not available in this environment.");
  console.log("Architecture (adapter/mock/exception center) remains separately verified.");
  process.exit(0);
}

const itemCode = process.env.ERP_CHECK_ITEM_CODE || "";
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), Number(process.env.ERP_CHECK_TIMEOUT_MS || 8000));

(async () => {
  try {
    const url = itemCode
      ? `${baseUrl.replace(/\/$/, "")}/items/${encodeURIComponent(itemCode)}`
      : `${baseUrl.replace(/\/$/, "")}/health`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    console.log(`  httpStatus: ${res.status}`);
    if (res.ok) {
      console.log("RESULT: PASSED — read-only connectivity succeeded.");
      process.exit(0);
    }
    console.log("RESULT: FAILED — non-OK response (credentials/endpoint may be wrong).");
    process.exit(1);
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`RESULT: FAILED — ${msg.replace(apiKey, "***")}`);
    process.exit(1);
  }
})();
