/**
 * Newline-safe E2E env file materialization.
 * Never logs secret values. Never prints full env-file contents.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SENSITIVE_KEY_RE = /(PASSWORD|SECRET|TOKEN|COOKIE|KEY|CREDENTIAL)/i;

function safeFail(message) {
  const err = new Error(message);
  err.name = "E2eEnvMaterializeError";
  throw err;
}

function endsWithLf(buf) {
  return buf.length > 0 && buf[buf.length - 1] === 0x0a;
}

function assertExampleEndsWithLf(filePath) {
  const buf = fs.readFileSync(filePath);
  if (!endsWithLf(buf)) {
    safeFail("E2E environment template must end with a final LF newline.");
  }
}

function assertSafeAssignmentValue(key, value) {
  if (typeof value !== "string") {
    safeFail("E2E materialize: " + key + " must be a string.");
  }
  if (value.includes("\n") || value.includes("\r") || value.includes("\0")) {
    safeFail("E2E materialize: " + key + " must not contain newline or control characters.");
  }
  if (value.includes("=")) {
    safeFail("E2E materialize: " + key + " must not contain '='.");
  }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) {
    safeFail("E2E materialize: " + key + " must not contain shell control characters.");
  }
}

function assertSafeE2eRunId(value) {
  assertSafeAssignmentValue("E2E_RUN_ID", value);
  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(value)) {
    safeFail("E2E materialize: E2E_RUN_ID has an invalid format.");
  }
}

function assertSafeComposeProjectName(value) {
  assertSafeAssignmentValue("COMPOSE_PROJECT_NAME", value);
  if (!value.startsWith("maintainpro-e2e-")) {
    safeFail("E2E materialize: COMPOSE_PROJECT_NAME must start with 'maintainpro-e2e-'.");
  }
}

function parseAssignmentLines(text) {
  const map = new Map();
  const order = [];
  const duplicates = new Set();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (map.has(key)) {
      duplicates.add(key);
    } else {
      order.push(key);
    }
    map.set(key, value);
  }

  return { map, order, duplicates };
}

function valueLooksConcatenated(value) {
  return /[A-Za-z_][A-Za-z0-9_]*=/.test(value);
}

function assertMaterializedSeparation(parsed, options) {
  options = options || {};
  const domain = parsed.map.get("E2E_SEED_EMAIL_DOMAIN");
  if (domain === undefined) {
    safeFail("E2E materialize: E2E_SEED_EMAIL_DOMAIN is missing.");
  }
  if (valueLooksConcatenated(domain)) {
    safeFail("E2E materialize: E2E_SEED_EMAIL_DOMAIN contains concatenated assignment text.");
  }
  if (options.expectDomainExact && domain !== "e2e.maintainpro.test") {
    safeFail("E2E materialize: E2E_SEED_EMAIL_DOMAIN is not the approved disposable domain.");
  }
  const runId = parsed.map.get("E2E_RUN_ID");
  if (runId === undefined) {
    safeFail("E2E materialize: E2E_RUN_ID is missing.");
  }
  if (valueLooksConcatenated(runId)) {
    safeFail("E2E materialize: E2E_RUN_ID contains concatenated assignment text.");
  }
  if (parsed.duplicates.has("E2E_RUN_ID")) {
    safeFail("E2E materialize: duplicate E2E_RUN_ID assignment exists.");
  }
}

function buildEmailLocal(emailLocal, runId, domain) {
  return (emailLocal + "." + runId + "@" + domain).toLowerCase();
}

function assertGeneratedEmailStructure(email) {
  if (/e2e_run_id=|E2E_RUN_ID=/i.test(email)) {
    safeFail("E2E materialize: generated email contains concatenated assignment text.");
  }
  if (!/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
    safeFail("E2E materialize: generated email structure is invalid.");
  }
}

function withForcedTrailingLf(content) {
  const text = typeof content === "string" ? content : content.toString("utf8");
  if (text.endsWith("\n")) return text;
  return text + "\n";
}

function materializeE2eEnvFile(options) {
  const templatePath = path.resolve(options.templatePath);
  const destPath = path.resolve(options.destPath);
  const overrides = options.overrides || {};

  if (!fs.existsSync(templatePath)) {
    safeFail("E2E materialize: template file is unavailable.");
  }

  const raw = withForcedTrailingLf(fs.readFileSync(templatePath, "utf8"));
  const parsed = parseAssignmentLines(raw);

  for (const key of Object.keys(overrides)) {
    const value = overrides[key];
    if (key === "E2E_RUN_ID") assertSafeE2eRunId(value);
    else if (key === "COMPOSE_PROJECT_NAME") assertSafeComposeProjectName(value);
    else assertSafeAssignmentValue(key, value);

    if (!parsed.map.has(key)) {
      parsed.order.push(key);
    }
    parsed.map.set(key, value);
    parsed.duplicates.delete(key);
  }

  assertMaterializedSeparation(parsed, {
    expectDomainExact: options.expectDomainExact !== false
  });

  const templateLines = raw.split(/\r?\n/);
  const emitted = new Set();
  const out = [];

  for (const line of templateLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    if (trimmed.startsWith("#")) {
      out.push(trimmed);
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      out.push(trimmed);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      out.push(trimmed);
      continue;
    }
    if (emitted.has(key)) {
      continue;
    }
    const value = parsed.map.get(key);
    if (value === undefined) continue;
    out.push(key + "=" + value);
    emitted.add(key);
  }

  for (const key of parsed.order) {
    if (emitted.has(key)) continue;
    out.push(key + "=" + parsed.map.get(key));
    emitted.add(key);
  }

  while (out.length > 0 && out[out.length - 1] === "") {
    out.pop();
  }
  const body = out.join("\n") + "\n";
  fs.writeFileSync(destPath, body, "utf8");

  const verify = parseAssignmentLines(body);
  assertMaterializedSeparation(verify, {
    expectDomainExact: options.expectDomainExact !== false
  });
  if (!endsWithLf(Buffer.from(body, "utf8"))) {
    safeFail("E2E materialize: destination must end with LF.");
  }

  return {
    destPath: destPath,
    keys: Array.from(verify.map.keys()),
    runIdPresent: verify.map.has("E2E_RUN_ID"),
    domainOk: verify.map.get("E2E_SEED_EMAIL_DOMAIN") === "e2e.maintainpro.test",
    duplicateRunId: verify.duplicates.has("E2E_RUN_ID")
  };
}

function validateWorkflowAppendSafety(workflowText) {
  const fragile =
    /echo\s+[\"']?E2E_RUN_ID=\$\{?E2E_RUN_ID\}?[\"']?\s*>>/.test(workflowText) ||
    /echo\s+[\"']E2E_RUN_ID=/.test(workflowText);
  const usesMaterialize =
    workflowText.includes("e2e-materialize-env") ||
    /printf\s+'\\nE2E_RUN_ID=%s\\n'/.test(workflowText);
  return { fragile: fragile, usesMaterialize: usesMaterialize, ok: !fragile && usesMaterialize };
}

module.exports = {
  assertExampleEndsWithLf: assertExampleEndsWithLf,
  assertSafeAssignmentValue: assertSafeAssignmentValue,
  assertSafeE2eRunId: assertSafeE2eRunId,
  assertSafeComposeProjectName: assertSafeComposeProjectName,
  parseAssignmentLines: parseAssignmentLines,
  valueLooksConcatenated: valueLooksConcatenated,
  assertMaterializedSeparation: assertMaterializedSeparation,
  buildEmailLocal: buildEmailLocal,
  assertGeneratedEmailStructure: assertGeneratedEmailStructure,
  withForcedTrailingLf: withForcedTrailingLf,
  materializeE2eEnvFile: materializeE2eEnvFile,
  validateWorkflowAppendSafety: validateWorkflowAppendSafety,
  endsWithLf: endsWithLf
};