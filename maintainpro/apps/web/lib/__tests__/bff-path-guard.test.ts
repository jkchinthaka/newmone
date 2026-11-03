import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { isBffCsrfExempt } from "../bff-auth";
import { hasUnsafePathSegment, joinUpstreamPath } from "../bff-upstream-url";

test("dot segments and slashes in a proxied path are refused", () => {
  assert.equal(hasUnsafePathSegment(["billing", "webhooks", "..", "..", "admin", "users"]), true);
  assert.equal(hasUnsafePathSegment(["work-orders", "."]), true);
  assert.equal(hasUnsafePathSegment(["a", ""]), true);
  assert.equal(hasUnsafePathSegment(["a/b"]), true);
  assert.equal(hasUnsafePathSegment(["a\\b"]), true);
  assert.equal(hasUnsafePathSegment(["work-orders", "wo-1", "assign"]), false);
  assert.equal(hasUnsafePathSegment(["billing", "webhooks", "stripe"]), false);
});

test("without the guard the CSRF-exempt webhook prefix could be walked out of; the guard runs before the CSRF check", () => {
  const walk = ["billing", "webhooks", "..", "..", "admin", "users"];
  assert.equal(isBffCsrfExempt(walk.join("/")), true); // prefix match is exactly why the guard matters
  assert.match(joinUpstreamPath("http://127.0.0.1:3040/api", walk), /\.\./); // URL() would resolve this upward
  const proxy = readFileSync(path.resolve(__dirname, "../bff-proxy.ts"), "utf8");
  const guardAt = proxy.indexOf("hasUnsafePathSegment(pathSegments)");
  assert.ok(guardAt > 0);
  assert.ok(guardAt < proxy.indexOf("isBffCsrfExempt(path)"), "guard must come before the CSRF exemption check");
});
