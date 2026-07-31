/**
 * Central runtime cookie / HTTP compatibility configuration.
 *
 * HTTPS with Secure cookies is the production default.
 * Public HTTP is NOT secure transport — it is an explicit operator-approved
 * compatibility mode that requires dual opt-in:
 *   ALLOW_INSECURE_HTTP=true
 *   COOKIE_SECURE=false
 */
export type RuntimeSecurityEnv = {
  NODE_ENV?: string;
  COOKIE_SECURE?: string;
  ALLOW_INSECURE_HTTP?: string;
  NEXT_PUBLIC_API_ORIGIN?: string;
  FRONTEND_URL?: string;
  CORS_ORIGIN?: string;
};

export type CookieSecurityConfig = {
  secureCookies: boolean;
  allowInsecureHttp: boolean;
  httpCompatibilityMode: boolean;
  nodeEnv: string;
};

function parseOptionalBoolean(raw: string | undefined, varName: string): boolean | undefined {
  if (raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  throw new Error(
    `Invalid boolean for ${varName}. Use true/false. Remediation: set ${varName}=true or ${varName}=false.`
  );
}

function isProduction(nodeEnv: string): boolean {
  return nodeEnv === "production";
}

/**
 * Resolve whether Set-Cookie must include the Secure attribute.
 * Fail-closed for production insecure requests without explicit dual approval.
 */
export function resolveCookieSecurityConfig(
  env: RuntimeSecurityEnv = process.env as RuntimeSecurityEnv
): CookieSecurityConfig {
  const nodeEnv = (env.NODE_ENV || "development").trim() || "development";
  const cookieSecure = parseOptionalBoolean(env.COOKIE_SECURE, "COOKIE_SECURE");
  const allowInsecureHttp = parseOptionalBoolean(env.ALLOW_INSECURE_HTTP, "ALLOW_INSECURE_HTTP") === true;

  if (isProduction(nodeEnv)) {
    if (cookieSecure === false && !allowInsecureHttp) {
      throw new Error(
        "COOKIE_SECURE=false is rejected in production unless ALLOW_INSECURE_HTTP=true. " +
          "Remediation: set COOKIE_SECURE=true (recommended HTTPS), or set both " +
          "ALLOW_INSECURE_HTTP=true and COOKIE_SECURE=false for approved HTTP compatibility only. " +
          "HTTP does not encrypt credentials or sessions."
      );
    }

    const secureCookies = cookieSecure !== false;
    return {
      secureCookies,
      allowInsecureHttp,
      httpCompatibilityMode: allowInsecureHttp && cookieSecure === false,
      nodeEnv
    };
  }

  // Development: default non-secure unless COOKIE_SECURE=true
  const secureCookies = cookieSecure === true;
  return {
    secureCookies,
    allowInsecureHttp,
    httpCompatibilityMode: allowInsecureHttp && cookieSecure === false,
    nodeEnv
  };
}

export function cookiesShouldBeSecure(env?: RuntimeSecurityEnv): boolean {
  return resolveCookieSecurityConfig(env).secureCookies;
}

/**
 * Structural consistency checks for public origins vs cookie mode.
 * Never logs secret values — only protocols and variable names.
 */
export type UrlCookieConsistencyResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function extractProtocol(url: string | undefined): "http" | "https" | "other" | "missing" {
  if (!url || !url.trim()) return "missing";
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === "http:") return "http";
    if (parsed.protocol === "https:") return "https";
    return "other";
  } catch {
    return "other";
  }
}

export function validateUrlCookieConsistency(
  env: RuntimeSecurityEnv = process.env as RuntimeSecurityEnv
): UrlCookieConsistencyResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config = resolveCookieSecurityConfig(env);
  const origins = [
    { name: "NEXT_PUBLIC_API_ORIGIN", value: env.NEXT_PUBLIC_API_ORIGIN },
    { name: "FRONTEND_URL", value: env.FRONTEND_URL },
    { name: "CORS_ORIGIN", value: env.CORS_ORIGIN }
  ];

  for (const { name, value } of origins) {
    const protocol = extractProtocol(value);
    if (protocol === "missing" || protocol === "other") continue;

    if (config.nodeEnv === "production" && protocol === "http" && config.secureCookies) {
      errors.push(
        `${name} uses http: while Secure cookies are enabled. Browsers will drop session cookies over cleartext HTTP. ` +
          `Remediation: use https: for ${name}, or approved HTTP mode with ALLOW_INSECURE_HTTP=true and COOKIE_SECURE=false.`
      );
    }

    if (config.nodeEnv === "production" && protocol === "https" && !config.secureCookies) {
      errors.push(
        `${name} uses https: while COOKIE_SECURE=false. This weakens HTTPS deployments. ` +
          `Remediation: set COOKIE_SECURE=true (default), or use a documented non-production test profile.`
      );
    }
  }

  if (config.allowInsecureHttp && config.secureCookies) {
    warnings.push(
      "ALLOW_INSECURE_HTTP=true with COOKIE_SECURE=true: insecure HTTP compatibility mode is NOT active; Secure cookies remain on."
    );
  }

  if (config.httpCompatibilityMode) {
    warnings.push(
      "HTTP compatibility mode is active (ALLOW_INSECURE_HTTP=true, COOKIE_SECURE=false). " +
        "HTTP does not encrypt credentials, does not protect sessions from interception, and does not verify server identity. Prefer HTTPS."
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Fail-closed guard for production cookie/URL contradictions.
 * Safe to call from BFF — never includes secret values in the message.
 */
export function assertProductionRuntimeSecurity(
  env: RuntimeSecurityEnv = process.env as RuntimeSecurityEnv
): void {
  // Always resolve cookie config first (throws on invalid COOKIE_SECURE production pair).
  resolveCookieSecurityConfig(env);
  const consistency = validateUrlCookieConsistency(env);
  if (!consistency.ok) {
    throw new Error(consistency.errors.join(" "));
  }
}