/**
 * Production configuration contract helpers (fixture-safe; never prints secret values).
 */

export const CLASSIFICATION = {
  REQUIRED_SECRET: "REQUIRED_SECRET",
  REQUIRED_NON_SECRET: "REQUIRED_NON_SECRET",
  OPTIONAL_FEATURE: "OPTIONAL_FEATURE",
  DERIVED_RELEASE_METADATA: "DERIVED_RELEASE_METADATA",
  DEPRECATED: "DEPRECATED",
  DEVELOPMENT_ONLY: "DEVELOPMENT_ONLY",
  E2E_ONLY: "E2E_ONLY",
  FORBIDDEN_IN_PRODUCTION: "FORBIDDEN_IN_PRODUCTION"
};

export const VARIABLE_CATALOG = [
  { name: "NODE_ENV", classification: CLASSIFICATION.REQUIRED_NON_SECRET },
  { name: "APP_ENVIRONMENT", classification: CLASSIFICATION.REQUIRED_NON_SECRET },
  { name: "APP_VERSION", classification: CLASSIFICATION.DERIVED_RELEASE_METADATA },
  { name: "APP_COMMIT_SHA", classification: CLASSIFICATION.DERIVED_RELEASE_METADATA },
  { name: "APP_BUILD_TIMESTAMP", classification: CLASSIFICATION.DERIVED_RELEASE_METADATA },
  { name: "FRONTEND_URL", classification: CLASSIFICATION.REQUIRED_NON_SECRET },
  { name: "CORS_ORIGIN", classification: CLASSIFICATION.REQUIRED_NON_SECRET },
  { name: "API_INTERNAL_URL", classification: CLASSIFICATION.REQUIRED_NON_SECRET },
  { name: "NEXT_PUBLIC_API_ORIGIN", classification: CLASSIFICATION.REQUIRED_NON_SECRET },
  { name: "NEXT_PUBLIC_API_BASE_URL", classification: CLASSIFICATION.REQUIRED_NON_SECRET },
  { name: "COOKIE_SECURE", classification: CLASSIFICATION.REQUIRED_NON_SECRET },
  { name: "ALLOW_INSECURE_HTTP", classification: CLASSIFICATION.OPTIONAL_FEATURE },
  { name: "JWT_ACCESS_SECRET", classification: CLASSIFICATION.REQUIRED_SECRET },
  { name: "JWT_REFRESH_SECRET", classification: CLASSIFICATION.REQUIRED_SECRET },
  { name: "PRIMARY_DATABASE_URL", classification: CLASSIFICATION.REQUIRED_SECRET },
  { name: "BACKUP_DATABASE_URL", classification: CLASSIFICATION.REQUIRED_SECRET },
  { name: "DATABASE_URL", classification: CLASSIFICATION.REQUIRED_SECRET },
  { name: "REDIS_URL", classification: CLASSIFICATION.REQUIRED_SECRET },
  { name: "MINIO_ACCESS_KEY", classification: CLASSIFICATION.REQUIRED_SECRET },
  { name: "MINIO_SECRET_KEY", classification: CLASSIFICATION.REQUIRED_SECRET },
  { name: "READINESS_API_KEY", classification: CLASSIFICATION.REQUIRED_SECRET },
  { name: "E2E_TEST_MODE", classification: CLASSIFICATION.E2E_ONLY },
  { name: "RECOVERY_REHEARSAL", classification: CLASSIFICATION.E2E_ONLY },
  { name: "OPERATIONS_REHEARSAL", classification: CLASSIFICATION.E2E_ONLY },
  { name: "ALLOW_MOCK_IN_PRODUCTION", classification: CLASSIFICATION.FORBIDDEN_IN_PRODUCTION }
];

const PLACEHOLDER_RE = /(changeme|replace_me|your_|example|todo|placeholder|xxxx|dummy|testsecret)/i;
const WEAK_PASSWORDS = new Set([
  "password",
  "passw0rd",
  "admin",
  "admin123",
  "root",
  "secret",
  "maintainpro",
  "minioadmin"
]);
const SHA40 = /^[a-f0-9]{40}$/i;

function truthy(v) {
  return ["true", "1", "yes", "on"].includes(String(v || "").trim().toLowerCase());
}

function falsy(v) {
  return ["false", "0", "no", "off"].includes(String(v || "").trim().toLowerCase());
}

export function parseEnvText(text) {
  const out = {};
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

export function classifyFinding(name) {
  const hit = VARIABLE_CATALOG.find((x) => x.name === name);
  return hit?.classification || "UNCLASSIFIED";
}

/**
 * Validate a production-like env object. Never returns secret values.
 */
export function validateProductionConfig(env, options = {}) {
  const findings = [];
  const requireAll = options.requireAll !== false;
  const push = (variable, category, message) => {
    findings.push({
      variable,
      classification: classifyFinding(variable),
      category,
      message
    });
  };

  if (requireAll) {
    for (const item of VARIABLE_CATALOG) {
      const needed =
        item.classification === CLASSIFICATION.REQUIRED_SECRET ||
        item.classification === CLASSIFICATION.REQUIRED_NON_SECRET ||
        item.classification === CLASSIFICATION.DERIVED_RELEASE_METADATA;
      if (needed && (!env[item.name] || String(env[item.name]).trim() === "")) {
        push(item.name, "missing_required", "Required production variable is missing");
      }
    }
  }

  if (env.NODE_ENV && env.NODE_ENV !== "production") {
    push("NODE_ENV", "invalid_environment", "NODE_ENV must be production for this contract");
  }

  const access = env.JWT_ACCESS_SECRET || "";
  const refresh = env.JWT_REFRESH_SECRET || "";
  if (access && access.length < 32) {
    push("JWT_ACCESS_SECRET", "short_secret", "Secret below minimum length");
  }
  if (refresh && refresh.length < 32) {
    push("JWT_REFRESH_SECRET", "short_secret", "Secret below minimum length");
  }
  if (access && PLACEHOLDER_RE.test(access)) {
    push("JWT_ACCESS_SECRET", "placeholder_secret", "Placeholder secret rejected");
  }
  if (refresh && PLACEHOLDER_RE.test(refresh)) {
    push("JWT_REFRESH_SECRET", "placeholder_secret", "Placeholder secret rejected");
  }
  if (access && refresh && access === refresh) {
    push("JWT_REFRESH_SECRET", "repeated_secrets", "Access and refresh secrets must differ");
  }

  for (const key of [
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY",
    "MONGO_INITDB_ROOT_PASSWORD",
    "MONGO_APP_PASSWORD",
    "READINESS_API_KEY"
  ]) {
    const v = env[key];
    if (!v) continue;
    if (
      PLACEHOLDER_RE.test(v) ||
      WEAK_PASSWORDS.has(String(v).toLowerCase()) ||
      String(v).length < 12
    ) {
      push(key, "weak_or_placeholder_secret", "Weak or placeholder secret rejected");
    }
  }

  for (const key of [
    "FRONTEND_URL",
    "CORS_ORIGIN",
    "NEXT_PUBLIC_API_ORIGIN",
    "NEXT_PUBLIC_API_BASE_URL"
  ]) {
    const v = env[key];
    if (!v) continue;
    if (/localhost|127\.0\.0\.1/i.test(v)) {
      push(key, "localhost_url", "Localhost URL rejected in production");
    }
    if (v.includes("*")) {
      push(key, "wildcard_cors", "Wildcard CORS/origin rejected");
    }
  }

  if (env.CORS_ORIGIN) {
    for (const part of String(env.CORS_ORIGIN)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      try {
        const u = new URL(part);
        if (!["http:", "https:"].includes(u.protocol)) {
          push("CORS_ORIGIN", "malformed_cors", "Malformed CORS origin protocol");
        }
      } catch {
        push("CORS_ORIGIN", "malformed_cors", "Malformed CORS origin");
      }
    }
  }

  if (env.APP_COMMIT_SHA && !SHA40.test(env.APP_COMMIT_SHA)) {
    push("APP_COMMIT_SHA", "malformed_release_sha", "APP_COMMIT_SHA must be exact 40-hex");
  }
  if (env.APP_BUILD_TIMESTAMP) {
    const t = Date.parse(env.APP_BUILD_TIMESTAMP);
    if (Number.isNaN(t)) {
      push(
        "APP_BUILD_TIMESTAMP",
        "malformed_timestamp",
        "APP_BUILD_TIMESTAMP must be valid ISO datetime"
      );
    }
  }

  const cookieSecure = env.COOKIE_SECURE;
  const allowInsecure = truthy(env.ALLOW_INSECURE_HTTP);
  if (falsy(cookieSecure) && !allowInsecure) {
    push(
      "COOKIE_SECURE",
      "insecure_cookie_mismatch",
      "COOKIE_SECURE=false requires ALLOW_INSECURE_HTTP=true"
    );
  }
  const httpsOrigins = ["FRONTEND_URL", "CORS_ORIGIN", "NEXT_PUBLIC_API_ORIGIN"]
    .map((k) => env[k])
    .filter(Boolean)
    .some((v) => String(v).startsWith("https://"));
  if (httpsOrigins && falsy(cookieSecure)) {
    push("COOKIE_SECURE", "https_insecure_cookie", "HTTPS origins require COOKIE_SECURE=true");
  }

  for (const flag of ["E2E_TEST_MODE", "RECOVERY_REHEARSAL", "OPERATIONS_REHEARSAL"]) {
    if (truthy(env[flag])) {
      push(flag, "e2e_flag_in_production", "E2E/mock rehearsal flag forbidden in production");
    }
  }

  if (truthy(env.ALLOW_MOCK_IN_PRODUCTION)) {
    push(
      "ALLOW_MOCK_IN_PRODUCTION",
      "unsafe_mock_allow",
      "ALLOW_MOCK_IN_PRODUCTION is forbidden in live production fixtures"
    );
  }
  if (
    String(env.ERP_MODE || "").toLowerCase() === "mock" &&
    !truthy(env.ALLOW_NON_INTEGRATED_PILOT)
  ) {
    push(
      "ERP_MODE",
      "mock_erp_forbidden",
      "MOCK ERP forbidden unless non-integrated pilot explicitly designated"
    );
  }

  if (truthy(env.SWAGGER_ENABLED) && !env.SWAGGER_USER && !env.SWAGGER_PASSWORD) {
    push("SWAGGER_ENABLED", "swagger_unprotected", "Swagger enabled without credentials");
  }

  for (const key of ["PRIMARY_DATABASE_URL", "DATABASE_URL", "REDIS_URL", "MONGODB_URI"]) {
    const v = env[key];
    if (!v) continue;
    if (/0\.0\.0\.0/i.test(v)) {
      push(key, "public_admin_host", "0.0.0.0 host rejected");
    }
  }

  for (const name of Object.keys(env)) {
    if (/_PASSWORD$|_SECRET$|_KEY$|TOKEN/i.test(name) && PLACEHOLDER_RE.test(env[name] || "")) {
      push(name, "placeholder_secret", "Placeholder secret rejected");
    }
  }

  return { ok: findings.length === 0, findings };
}
