#!/usr/bin/env node
/**
 * Three-level E2E auth-path diagnostic (A=API, B=BFF, C=Nginx).
 * Never prints email, password, tokens, cookies, Authorization, or response bodies.
 */

import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
const { loadE2eEnvOnly } = await import("./lib/e2e-guards.mjs");
const {
  resolveBffUpstreamApiBase,
  loginUpstreamUrl,
  describeUpstreamUrl
} = require("./lib/bff-upstream-url.cjs");
const { AUTH_LOGIN_SUCCESS_HTTP_STATUS } = require("./lib/auth-login-status-contract.cjs");

function fail(message) {
  console.error(`AUTH-PATH-DIAG FAIL — ${message}`);
  process.exit(1);
}

function safeStatusLine(level, targetCategory, status, durationMs, requestId, jsonLike, cookieNames) {
  console.log(
    [
      `probe=${level}`,
      `target=${targetCategory}`,
      `status=${status}`,
      `duration_ms=${durationMs}`,
      `request_id=${requestId || "none"}`,
      `json=${jsonLike ? "yes" : "no"}`,
      `cookie_names=${cookieNames.length ? cookieNames.join(",") : "none"}`
    ].join(" ")
  );
}

function cookieNamesFromHeaders(headers) {
  const raw = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const list = Array.isArray(raw) && raw.length ? raw : [];
  if (!list.length) {
    const single = headers.get("set-cookie");
    if (single) list.push(single);
  }
  const names = [];
  for (const line of list) {
    const name = String(line).split("=")[0]?.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

async function postLogin(url, email, password, requestId) {
  const started = Date.now();
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-request-id": requestId
      },
      body: JSON.stringify({ email, password })
    });
  } catch {
    return {
      status: 0,
      durationMs: Date.now() - started,
      requestId,
      jsonLike: false,
      cookieNames: [],
      category: "connectivity"
    };
  }

  const text = await response.text();
  let jsonLike = false;
  try {
    JSON.parse(text);
    jsonLike = true;
  } catch {
    jsonLike = false;
  }

  return {
    status: response.status,
    durationMs: Date.now() - started,
    requestId: response.headers.get("x-request-id") || requestId,
    jsonLike,
    cookieNames: cookieNamesFromHeaders(response.headers),
    category: "http"
  };
}

loadE2eEnvOnly();

const runId = String(process.env.E2E_RUN_ID || "").trim();
const domain = String(process.env.E2E_SEED_EMAIL_DOMAIN || "e2e.maintainpro.test").trim();
const password = String(process.env.E2E_SEED_PASSWORD || "").trim();
if (!runId || !password) {
  fail("Required disposable E2E credentials are unavailable.");
}

const email = `admin-a.${runId}@${domain}`.toLowerCase();

const mode = String(process.env.E2E_AUTH_DIAG_MODE || "network").trim();
const baseUrl = String(process.env.E2E_BASE_URL || "http://127.0.0.1:18080").trim();

let apiLoginUrl;
let bffLoginUrl;
let nginxLoginUrl;

if (mode === "network") {
  const resolved = resolveBffUpstreamApiBase(process.env, { requireDockerApiHost: true });
  apiLoginUrl = loginUpstreamUrl(resolved.base);
  bffLoginUrl = "http://web:3001/api/backend/auth/login";
  nginxLoginUrl = "http://nginx/api/backend/auth/login";
  const meta = describeUpstreamUrl(resolved.base);
  console.log(
    `upstream_meta protocol=${meta.protocol} hostname=${meta.hostname} port=${meta.port} pathname=${meta.pathname}`
  );
} else {
  // Host-side: only Nginx loopback is published.
  apiLoginUrl = "";
  bffLoginUrl = "";
  nginxLoginUrl = `${baseUrl.replace(/\/+$/, "")}/api/backend/auth/login`;
  console.log("upstream_meta mode=host_nginx_only");
}

const results = {};

if (apiLoginUrl) {
  const id = randomUUID();
  const r = await postLogin(apiLoginUrl, email, password, id);
  safeStatusLine("A", "api_direct", r.status, r.durationMs, r.requestId, r.jsonLike, r.cookieNames);
  results.A = r.status;
}

if (bffLoginUrl) {
  const id = randomUUID();
  const r = await postLogin(bffLoginUrl, email, password, id);
  safeStatusLine("B", "bff_direct", r.status, r.durationMs, r.requestId, r.jsonLike, r.cookieNames);
  results.B = r.status;
}

if (nginxLoginUrl) {
  const id = randomUUID();
  const r = await postLogin(nginxLoginUrl, email, password, id);
  safeStatusLine("C", "nginx_public", r.status, r.durationMs, r.requestId, r.jsonLike, r.cookieNames);
  results.C = r.status;
}

// Gate policy for CI network mode:
// - A must be reachable (canonical success or genuine 4xx)
// - Successful login must be exactly AUTH_LOGIN_SUCCESS_HTTP_STATUS (200)
// - B must match A (never convert 4xx to 502; never rewrite success status)
// - C must match B exactly on success
function family(status) {
  if (status === AUTH_LOGIN_SUCCESS_HTTP_STATUS) return "ok";
  if (status >= 400 && status < 500) return "client";
  if (status === 502 || status === 504 || status === 0) return "gateway";
  if (status >= 500) return "server";
  return "other";
}

if (mode === "network") {
  if (!results.A || results.A === 0) {
    fail("Probe A: direct API unreachable");
  }
  if (results.A === 201) {
    fail(
      `Probe A: login returned 201 Created; canonical contract is HTTP ${AUTH_LOGIN_SUCCESS_HTTP_STATUS}`
    );
  }
  if (family(results.A) === "client" && results.B === 502) {
    fail("Probe B: BFF converted upstream 4xx into 502");
  }
  if (family(results.A) === "ok" && results.B === 502) {
    fail("Probe B: BFF returned 502 while direct API succeeded");
  }
  if (family(results.A) === "ok" && results.B !== AUTH_LOGIN_SUCCESS_HTTP_STATUS) {
    fail(
      `Probe B: expected exact status ${AUTH_LOGIN_SUCCESS_HTTP_STATUS}, got ${results.B}`
    );
  }
  if (results.B && results.C && results.B !== results.C) {
    fail(`Probe C status (${results.C}) differs from Probe B (${results.B})`);
  }
  if (family(results.A) === "ok" && family(results.B) === "ok" && results.C === 502) {
    fail("Probe C: Nginx proxy defect on successful BFF login");
  }
  if (
    family(results.A) === "ok" &&
    results.C !== undefined &&
    results.C !== AUTH_LOGIN_SUCCESS_HTTP_STATUS
  ) {
    fail(
      `Probe C: expected exact status ${AUTH_LOGIN_SUCCESS_HTTP_STATUS}, got ${results.C}`
    );
  }
}

console.log(
  `AUTH-PATH-DIAG SUMMARY A=${results.A ?? "skip"} B=${results.B ?? "skip"} C=${results.C ?? "skip"} canonical=${AUTH_LOGIN_SUCCESS_HTTP_STATUS}`
);

if (mode === "network" && (family(results.C) === "gateway" || family(results.B) === "gateway")) {
  process.exit(1);
}

console.log("AUTH-PATH-DIAG PASS");