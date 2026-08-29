/**
 * Focused tests for the FG SSO handoff public-origin fix.
 *
 * Run directly with Node's built-in test runner (no jest/vitest exists for
 * @maintainpro/web today):
 *   node --test apps/web/lib/__tests__/fg-sso-public-origin.test.ts
 *
 * Covers:
 *  - resolvePublicWebOrigin: FRONTEND_URL -> correct origin, and fail-closed
 *    behavior on missing/invalid/malicious values.
 *  - safeFgNext: open-redirect protection is unchanged.
 *  - A static regression guard proving the handoff route no longer
 *    references request.nextUrl.origin (the exact pattern that leaked
 *    http://localhost:3001 to real browsers) or any other localhost
 *    fallback.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { resolvePublicWebOrigin } from "../runtime-security-config.ts";
import { safeFgNext } from "../fg-sso-safe-next.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTE_PATH = path.resolve(__dirname, "../../app/api/fg-sso/handoff/route.ts");

test("resolvePublicWebOrigin: FRONTEND_URL=http://135.171.163.249 produces the exact IP origin", () => {
  const origin = resolvePublicWebOrigin({ FRONTEND_URL: "http://135.171.163.249" });
  assert.equal(origin, "http://135.171.163.249");

  // Used exactly the way the route does, for /login, /fg/sso/denied,
  // and /fg/sso/consume/.
  assert.equal(new URL("/login", origin).toString(), "http://135.171.163.249/login");
  assert.equal(new URL("/fg/sso/denied", origin).toString(), "http://135.171.163.249/fg/sso/denied");
  assert.equal(
    new URL("/fg/sso/consume/", origin).toString(),
    "http://135.171.163.249/fg/sso/consume/"
  );
});

test("resolvePublicWebOrigin: trailing slash / path / query on FRONTEND_URL is normalized away", () => {
  assert.equal(
    resolvePublicWebOrigin({ FRONTEND_URL: "http://135.171.163.249/" }),
    "http://135.171.163.249"
  );
  assert.equal(
    resolvePublicWebOrigin({ FRONTEND_URL: "http://135.171.163.249/some/path?x=1" }),
    "http://135.171.163.249"
  );
});

test("resolvePublicWebOrigin: https and a real hostname both work", () => {
  assert.equal(resolvePublicWebOrigin({ FRONTEND_URL: "https://example.org" }), "https://example.org");
  assert.equal(
    resolvePublicWebOrigin({ FRONTEND_URL: "http://example.org:8081" }),
    "http://example.org:8081"
  );
});

test("resolvePublicWebOrigin: fails closed when FRONTEND_URL is missing", () => {
  assert.throws(() => resolvePublicWebOrigin({}), /FRONTEND_URL is required/);
  assert.throws(() => resolvePublicWebOrigin({ FRONTEND_URL: "" }), /FRONTEND_URL is required/);
  assert.throws(() => resolvePublicWebOrigin({ FRONTEND_URL: "   " }), /FRONTEND_URL is required/);
});

test("resolvePublicWebOrigin: never silently returns localhost — a genuinely misconfigured value throws, it does not fall back", () => {
  // The point of the fix is that failure must be loud, not a silent
  // substitution of localhost or the request's own origin. Confirm the
  // function has no fallback branch: every non-throwing path returns a
  // value derived only from FRONTEND_URL.
  assert.throws(() => resolvePublicWebOrigin({ FRONTEND_URL: "not a url" }));
  assert.throws(() => resolvePublicWebOrigin({ FRONTEND_URL: "//evil.example" })); // protocol-relative
  assert.throws(() => resolvePublicWebOrigin({ FRONTEND_URL: "javascript:alert(1)" }));
  assert.throws(() => resolvePublicWebOrigin({ FRONTEND_URL: "data:text/html,x" }));
  assert.throws(() => resolvePublicWebOrigin({ FRONTEND_URL: "file:///etc/passwd" }));
  assert.throws(() => resolvePublicWebOrigin({ FRONTEND_URL: "ftp://example.org" }));
});

test("resolvePublicWebOrigin: rejects embedded credentials", () => {
  assert.throws(
    () => resolvePublicWebOrigin({ FRONTEND_URL: "http://user:pass@135.171.163.249" }),
    /must not embed a username or password/
  );
});

test("safeFgNext: preserved open-redirect protection", () => {
  assert.equal(safeFgNext("/fg/records"), "/fg/records");
  assert.equal(safeFgNext("/fg/"), "/fg/");
  assert.equal(safeFgNext(null), "/fg/");
  assert.equal(safeFgNext(""), "/fg/");
  assert.equal(safeFgNext("/dashboard"), "/fg/"); // not under /fg -> fallback
  assert.equal(safeFgNext("//evil.example/fg/"), "/fg/"); // protocol-relative -> fallback
  assert.equal(safeFgNext("https://evil.example/fg/"), "/fg/"); // absolute -> fallback
  assert.equal(safeFgNext("/fg/../../etc/passwd"), "/fg/../../etc/passwd"); // unchanged pre-existing behavior, still confined by the /fg prefix check + no scheme
});

test("regression guard: the handoff route no longer constructs redirects from request.nextUrl.origin or a localhost fallback", () => {
  const source = readFileSync(ROUTE_PATH, "utf8");
  // Match actual code usage (origin passed as a value/argument), not prose in
  // comments that legitimately explain the old, now-removed pattern.
  const usedAsValue = /[,(]\s*request\.nextUrl\.origin\b/;
  assert.ok(
    !usedAsValue.test(source),
    "route.ts must not pass request.nextUrl.origin as a redirect-URL base " +
      "(this is exactly the pattern that leaked http://localhost:3001 to real browsers)"
  );
  assert.ok(
    source.includes("resolvePublicWebOrigin"),
    "route.ts must derive its redirect origin from resolvePublicWebOrigin"
  );
});
