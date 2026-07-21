import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const maintainproRoot = path.resolve(__dirname, "..", "..");

/**
 * Load key=value pairs from a dotenv-style file into process.env when unset.
 * Does not override existing environment variables.
 */
export function loadEnvFileIfPresent(filePath) {
  if (!existsSync(filePath)) return false;
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
}

export function loadMaintainProEnv() {
  const candidates = [
    path.join(maintainproRoot, ".env"),
    path.join(maintainproRoot, ".env.local"),
    path.join(maintainproRoot, "apps", "api", ".env"),
    path.join(maintainproRoot, "apps", "api", ".env.local")
  ];
  const loaded = [];
  for (const candidate of candidates) {
    if (loadEnvFileIfPresent(candidate)) {
      loaded.push(path.relative(maintainproRoot, candidate));
    }
  }
  return loaded;
}

export function parseMongoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return null;
  }
  try {
    const normalized = rawUrl.replace(/^mongodb\+srv:\/\//i, "https://").replace(/^mongodb:\/\//i, "http://");
    const u = new URL(normalized);
    const dbFromPath = decodeURIComponent((u.pathname || "").replace(/^\//, "").split("/")[0] || "");
    const dbFromQuery = u.searchParams.get("authSource") || "";
    return {
      protocol: rawUrl.startsWith("mongodb+srv") ? "mongodb+srv" : "mongodb",
      host: u.host || "unknown",
      databaseName: dbFromPath || dbFromQuery || "unknown",
      hasCredentials: Boolean(u.username || u.password)
    };
  } catch {
    return null;
  }
}

export function classifyEnvironment({ nodeEnv, appEnvironment, host, databaseName }) {
  const labels = [nodeEnv, appEnvironment, host, databaseName]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  const joined = labels.join(" ");

  // Explicit production signals always win.
  if (
    (/production|\bprod\b/.test(joined) && !/staging|stage|dev|test|local|ci/.test(joined)) ||
    nodeEnv === "production" ||
    appEnvironment === "production" ||
    appEnvironment === "prod"
  ) {
    return "production";
  }
  if (/staging|stage/.test(joined)) return "staging";
  if (/test|ci|e2e|ephemeral/.test(joined)) return "test";
  if (/local|127\.0\.0\.1|localhost/.test(joined)) return "local";
  if (/dev|development/.test(joined)) return "development";

  // Unlabeled remote / Atlas targets must fail closed as unknown.
  if (/mongodb\.net|atlas/i.test(host || "")) {
    return "unknown-remote";
  }
  return "unknown";
}

export function resolveDatabaseTarget() {
  const nodeEnv = (process.env.NODE_ENV || "").trim();
  const appEnvironment = (process.env.APP_ENVIRONMENT || "").trim();
  const url =
    (process.env.PRIMARY_DATABASE_URL || "").trim() ||
    (process.env.DATABASE_URL || "").trim() ||
    (process.env.MONGODB_URI || "").trim();

  const parsed = parseMongoUrl(url);
  const explicitName =
    (process.env.PRIMARY_DATABASE_NAME || "").trim() ||
    (process.env.MONGO_DATABASE_NAME || "").trim() ||
    "";

  const databaseName = explicitName || parsed?.databaseName || "unknown";
  const host = parsed?.host || "unknown";
  const classification = classifyEnvironment({
    nodeEnv,
    appEnvironment,
    host,
    databaseName
  });

  return {
    provider: "mongodb",
    urlPresent: Boolean(url),
    url,
    host,
    databaseName,
    protocol: parsed?.protocol || "unknown",
    nodeEnv: nodeEnv || "(unset)",
    appEnvironment: appEnvironment || "(unset)",
    classification,
    identityFingerprint: createHash("sha256")
      .update(`${host}|${databaseName}|${classification}`)
      .digest("hex")
      .slice(0, 12)
  };
}

export function printRedactedIdentity(target) {
  console.log("=== Database identity (redacted) ===");
  console.log(`provider: ${target.provider}`);
  console.log(`databaseName: ${target.databaseName}`);
  console.log(`host: ${target.host}`);
  console.log(`protocol: ${target.protocol}`);
  console.log(`NODE_ENV: ${target.nodeEnv}`);
  console.log(`APP_ENVIRONMENT: ${target.appEnvironment}`);
  console.log(`classification: ${target.classification}`);
  console.log(`identityFingerprint: ${target.identityFingerprint}`);
  console.log(`urlPresent: ${target.urlPresent}`);
}

export function assertResetConfirmations() {
  const allow = (process.env.ALLOW_DATABASE_RESET || "").trim();
  const confirm = (process.env.CONFIRM_DATABASE_RESET || "").trim();
  if (allow !== "true") {
    throw new Error("Refusing reset: ALLOW_DATABASE_RESET must be exactly 'true'.");
  }
  if (confirm !== "DELETE_ALL_MAINTAINPRO_DATA") {
    throw new Error(
      "Refusing reset: CONFIRM_DATABASE_RESET must be exactly 'DELETE_ALL_MAINTAINPRO_DATA'."
    );
  }
}

export function assertNotProduction(target) {
  if (target.classification === "production") {
    throw new Error("Refusing reset: classified as production. Automatic production resets are blocked.");
  }
  const nodeEnv = String(process.env.NODE_ENV || "").toLowerCase();
  const appEnv = String(process.env.APP_ENVIRONMENT || "").toLowerCase();
  if (nodeEnv === "production" || appEnv === "production" || appEnv === "prod") {
    throw new Error("Refusing reset: NODE_ENV/APP_ENVIRONMENT indicates production.");
  }
}

export function assertIdentifiable(target) {
  if (!target.urlPresent) {
    throw new Error("Refusing reset: database URL is missing (PRIMARY_DATABASE_URL/DATABASE_URL/MONGODB_URI).");
  }
  if (!target.databaseName || target.databaseName === "unknown") {
    throw new Error("Refusing reset: database name could not be identified.");
  }
  if (target.classification === "unknown" || target.classification === "unknown-remote") {
    throw new Error(
      `Refusing reset: database identity is unknown (${target.classification}). Set APP_ENVIRONMENT explicitly (e.g. local|test|staging) and retry.`
    );
  }
}

export function listPrismaModelsFromSchema(schemaPath) {
  const text = readFileSync(schemaPath, "utf8");
  const models = [];
  const re = /^model\s+(\w+)\s*\{/gm;
  let match;
  while ((match = re.exec(text)) !== null) {
    models.push(match[1]);
  }
  return models;
}

export function backupDirFor(target) {
  const base =
    (process.env.MAINTAINPRO_BACKUP_DIR || "").trim() ||
    path.join(path.resolve(maintainproRoot, "..", ".."), "maintainpro-backups");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(base, `${target.databaseName}-${stamp}-${target.identityFingerprint}`);
}

export function newRequestId() {
  return randomUUID();
}