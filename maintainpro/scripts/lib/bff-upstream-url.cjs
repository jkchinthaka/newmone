/**
 * Safe BFF upstream API base URL resolution.
 * Never logs secret values or full URLs containing credentials.
 */

"use strict";

function safeFail(message) {
  const err = new Error(message);
  err.name = "BffUpstreamUrlError";
  throw err;
}

/**
 * @returns {{ protocol: string, hostname: string, port: string, pathname: string }}
 */
function describeUpstreamUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    safeFail("BFF upstream URL is not a valid absolute URL.");
  }
  if (parsed.username || parsed.password) {
    safeFail("BFF upstream URL must not embed username or password.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    safeFail("BFF upstream URL must use http or https.");
  }
  const pathname = parsed.pathname.replace(/\/+$/, "") || "";
  return {
    protocol: parsed.protocol.replace(":", ""),
    hostname: parsed.hostname.toLowerCase(),
    port: parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
    pathname
  };
}

function normalizeApiBase(raw) {
  const trimmed = String(raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    safeFail("BFF upstream API base is missing.");
  }
  if (trimmed.startsWith("/")) {
    safeFail("BFF upstream API base must be absolute (not a relative path).");
  }
  const described = describeUpstreamUrl(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
  // Re-parse after optional scheme injection only when caller passed host:port (not used for production).
  const absolute = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
  const base = absolute.replace(/\/+$/, "");
  const withApi = base.endsWith("/api") ? base : `${base}/api`;
  // Reject duplicate /api/api
  if (/\/api\/api(\/|$)/i.test(withApi)) {
    safeFail("BFF upstream API base must not contain duplicate /api path segments.");
  }
  describeUpstreamUrl(withApi);
  return withApi;
}

/**
 * Resolve server-side upstream for BFF. Prefer API_INTERNAL_URL only.
 * Do not fall back to NEXT_PUBLIC relative values (causes Invalid URL → opaque 502).
 */
function resolveBffUpstreamApiBase(env, options) {
  env = env || process.env;
  options = options || {};
  const raw = String(env.API_INTERNAL_URL || "").trim();
  if (!raw) {
    safeFail("API_INTERNAL_URL is required for BFF upstream routing.");
  }
  const base = normalizeApiBase(raw);
  const meta = describeUpstreamUrl(base);

  const e2eMode =
    String(env.E2E_TEST_MODE || "").trim().toLowerCase() === "true" ||
    options.requireDockerApiHost === true;

  if (e2eMode) {
    if (meta.hostname !== "api") {
      safeFail("E2E BFF upstream hostname must be the Docker service name 'api'.");
    }
    if (meta.protocol !== "http") {
      safeFail("E2E BFF upstream must use http inside the Docker network.");
    }
    if (meta.port !== "3000") {
      safeFail("E2E BFF upstream must target port 3000.");
    }
    if (meta.pathname !== "/api") {
      safeFail("E2E BFF upstream pathname must be /api.");
    }
  }

  if (meta.hostname === "localhost" || meta.hostname === "127.0.0.1") {
    if (e2eMode || String(env.NODE_ENV || "").trim() === "production") {
      safeFail("BFF upstream must not use localhost inside container/production runtime.");
    }
  }

  return { base, meta };
}

function joinUpstreamPath(base, pathSegments) {
  const suffix = (pathSegments || []).map((part) => encodeURIComponent(String(part))).join("/");
  const url = `${base.replace(/\/+$/, "")}/${suffix}`;
  // Guard against /api/api/
  if (/\/api\/api\//i.test(url)) {
    safeFail("BFF upstream join produced duplicate /api path segments.");
  }
  return url;
}

function loginUpstreamUrl(base) {
  return joinUpstreamPath(base, ["auth", "login"]);
}

module.exports = {
  describeUpstreamUrl,
  normalizeApiBase,
  resolveBffUpstreamApiBase,
  joinUpstreamPath,
  loginUpstreamUrl
};