import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  UPSTREAM_MAX_ATTEMPTS,
  classifyUpstreamError,
  fetchUpstreamWithRetry,
  shouldRetryUpstream,
  toRouteTemplate,
  type UpstreamAttemptLog
} from "../bff-upstream-fetch";

function undiciError(code: string): Error {
  const error = new TypeError("fetch failed") as Error & { cause?: unknown };
  error.cause = Object.assign(new Error(code.toLowerCase()), { code });
  return error;
}

function timeoutError(): Error {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

type Call = { method?: string; body: Uint8Array | null };

function scriptedFetch(script: Array<Error | number>) {
  const calls: Call[] = [];
  const impl = (async (_url: unknown, init?: RequestInit) => {
    const body = init?.body ? new Uint8Array(init.body as Uint8Array) : null;
    calls.push({ method: init?.method, body });
    const step = script[Math.min(calls.length - 1, script.length - 1)];
    if (step instanceof Error) throw step;
    return new Response(JSON.stringify({ ok: true }), { status: step });
  }) as typeof fetch;
  return { impl, calls };
}

function run(method: string, script: Array<Error | number>, opts: { idempotencyKey?: string; body?: string } = {}) {
  const { impl, calls } = scriptedFetch(script);
  const headers = new Headers();
  if (opts.idempotencyKey) headers.set("Idempotency-Key", opts.idempotencyKey);
  const logs: UpstreamAttemptLog[] = [];
  const sleeps: number[] = [];
  const body = opts.body !== undefined ? new TextEncoder().encode(opts.body).buffer : undefined;
  const result = fetchUpstreamWithRetry({
    url: "http://127.0.0.1:9/api/work-orders",
    method,
    headers,
    body,
    requestId: "req-1",
    route: "/work-orders/:id",
    fetchImpl: impl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    log: (entry) => logs.push(entry)
  });
  return { result, calls, logs, sleeps };
}

describe("classifyUpstreamError", () => {
  it("reads undici cause.code instead of the generic message", () => {
    assert.equal(classifyUpstreamError(undiciError("ECONNREFUSED")).kind, "refused");
    assert.equal(classifyUpstreamError(undiciError("ECONNRESET")).kind, "reset");
    assert.equal(classifyUpstreamError(undiciError("UND_ERR_SOCKET")).kind, "socket");
    assert.equal(classifyUpstreamError(undiciError("UND_ERR_HEADERS_TIMEOUT")).kind, "timeout");
    assert.equal(classifyUpstreamError(timeoutError()).kind, "timeout");
  });

  it("maps connectivity to 503 and timeouts to 504", () => {
    assert.equal(classifyUpstreamError(undiciError("ECONNREFUSED")).status, 503);
    assert.equal(classifyUpstreamError(timeoutError()).status, 504);
  });
});

describe("shouldRetryUpstream", () => {
  const refused = classifyUpstreamError(undiciError("ECONNREFUSED"));
  const reset = classifyUpstreamError(undiciError("ECONNRESET"));
  it("never retries a mutation after a reset, even with a key", () => {
    assert.equal(shouldRetryUpstream("POST", reset, true), false);
  });
  it("retries a mutation on refused only with an Idempotency-Key", () => {
    assert.equal(shouldRetryUpstream("PATCH", refused, false), false);
    assert.equal(shouldRetryUpstream("PATCH", refused, true), true);
  });
});

describe("fetchUpstreamWithRetry", () => {
  it("GET with ECONNREFUSED then success is retried and returns 200", async () => {
    const { result, calls, sleeps } = run("GET", [undiciError("ECONNREFUSED"), 200]);
    const out = await result;
    assert.equal(out.ok, true);
    assert.equal(out.ok && out.response.status, 200);
    assert.equal(calls.length, 2);
    assert.deepEqual(sleeps, [250]);
  });

  it("GET failing every attempt returns an UPSTREAM_UNAVAILABLE 503 failure", async () => {
    const { result, calls, logs } = run("GET", [undiciError("ECONNRESET")]);
    const out = await result;
    assert.equal(out.ok, false);
    assert.equal(!out.ok && out.failure.status, 503);
    assert.equal(!out.ok && out.failure.code, "UPSTREAM_UNAVAILABLE");
    assert.equal(calls.length, UPSTREAM_MAX_ATTEMPTS);
    assert.equal(logs.length, UPSTREAM_MAX_ATTEMPTS);
    assert.equal(logs.at(-1)?.willRetry, false);
  });

  it("POST without Idempotency-Key on ECONNREFUSED is not retried", async () => {
    const { result, calls } = run("POST", [undiciError("ECONNREFUSED"), 201], { body: "{}" });
    const out = await result;
    assert.equal(out.ok, false);
    assert.equal(calls.length, 1);
  });

  it("POST with Idempotency-Key on ECONNREFUSED is retried and succeeds", async () => {
    const { result, calls } = run("POST", [undiciError("ECONNREFUSED"), 201], { idempotencyKey: "k-1", body: "{}" });
    const out = await result;
    assert.equal(out.ok, true);
    assert.equal(out.ok && out.response.status, 201);
    assert.equal(calls.length, 2);
  });

  it("POST on ECONNRESET is not retried", async () => {
    const { result, calls } = run("POST", [undiciError("ECONNRESET"), 201], { idempotencyKey: "k-1", body: "{}" });
    const out = await result;
    assert.equal(out.ok, false);
    assert.equal(calls.length, 1);
  });

  it("a timeout returns 504 and is not retried", async () => {
    const { result, calls } = run("GET", [timeoutError(), 200]);
    const out = await result;
    assert.equal(out.ok, false);
    assert.equal(!out.ok && out.failure.status, 504);
    assert.equal(calls.length, 1);
  });

  it("replays the body byte-identical on retry", async () => {
    const payload = "--b\r\nContent-Disposition: form-data; name=\"file\"\r\n\r\nÿØÿ binary\r\n--b--";
    const { result, calls } = run("PUT", [undiciError("ECONNREFUSED"), 200], { idempotencyKey: "k-2", body: payload });
    await result;
    assert.equal(calls.length, 2);
    assert.ok(calls[0].body && calls[1].body);
    assert.deepEqual(Buffer.from(calls[1].body!), Buffer.from(calls[0].body!));
    assert.deepEqual(Buffer.from(calls[0].body!), Buffer.from(new TextEncoder().encode(payload)));
  });

  it("logs a route template without ids or query", async () => {
    const { result, logs } = run("GET", [undiciError("ECONNREFUSED"), 200]);
    await result;
    assert.equal(logs[0].route, "/work-orders/:id");
    assert.equal(logs[0].causeCode, "ECONNREFUSED");
    assert.equal(logs[0].attempt, 1);
  });
});

describe("toRouteTemplate", () => {
  it("replaces ids and record numbers", () => {
    assert.equal(
      toRouteTemplate(["work-orders", "cmv9cevur01iv8kmfzfngzwzy", "evidence", "3f2b6c1e-1a2b-4c3d-8e9f-001122334455", "file"]),
      "/work-orders/:id/evidence/:id/file"
    );
    assert.equal(toRouteTemplate(["work-orders", "WO-2026-00012"]), "/work-orders/:id");
    assert.equal(toRouteTemplate(["inventory", "parts"]), "/inventory/parts");
  });
});
