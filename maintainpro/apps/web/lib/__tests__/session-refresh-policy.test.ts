import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyRefreshFailure,
  createRefreshCoordinator,
  isTransientSessionError,
  shouldRedirectToLogin,
  TRANSIENT_SESSION_ERROR_FLAG,
  type RefreshOutcome
} from "../session-refresh-policy";

describe("QA-MANUAL-001 classifyRefreshFailure", () => {
  it("treats a 409 refresh conflict as transient, never as session expiry", () => {
    assert.equal(classifyRefreshFailure(409, "CONFLICT"), "transient");
  });

  it("treats throttling, stale CSRF, 5xx and network failures as transient", () => {
    assert.equal(classifyRefreshFailure(429, "RATE_LIMITED"), "transient");
    assert.equal(classifyRefreshFailure(403, "CSRF_INVALID"), "transient");
    assert.equal(classifyRefreshFailure(503, "DEPENDENCY_UNAVAILABLE"), "transient");
    assert.equal(classifyRefreshFailure(undefined, undefined), "transient");
  });

  it("treats a sibling rotation as refreshed", () => {
    assert.equal(classifyRefreshFailure(401, "REFRESH_TOKEN_ROTATED"), "refreshed");
  });

  it("treats proven-invalid refresh tokens as invalid", () => {
    assert.equal(classifyRefreshFailure(401, "REFRESH_TOKEN_REUSED"), "invalid");
    assert.equal(classifyRefreshFailure(401, "AUTHENTICATION_REQUIRED"), "invalid");
    assert.equal(classifyRefreshFailure(401, undefined), "invalid");
    assert.equal(classifyRefreshFailure(400, "VALIDATION_ERROR"), "invalid");
  });
});

describe("QA-MANUAL-001 shouldRedirectToLogin", () => {
  it("redirects only when refresh is invalid AND the session probe is 401", () => {
    assert.equal(shouldRedirectToLogin("invalid", 401), true);
    assert.equal(shouldRedirectToLogin("invalid", 200), false);
    assert.equal(shouldRedirectToLogin("invalid", undefined), false);
    assert.equal(shouldRedirectToLogin("transient", 401), false);
    assert.equal(shouldRedirectToLogin("refreshed", 401), false);
  });
});

describe("QA-MANUAL-001 createRefreshCoordinator", () => {
  it("lets exactly one caller own rotation when 401s arrive concurrently", async () => {
    let calls = 0;
    let release!: (value: RefreshOutcome) => void;
    const coordinator = createRefreshCoordinator(() => {
      calls += 1;
      return new Promise<RefreshOutcome>((resolve) => {
        release = resolve;
      });
    });

    const results = Promise.all([coordinator.refresh(), coordinator.refresh(), coordinator.refresh()]);
    release("refreshed");
    assert.deepEqual(await results, ["refreshed", "refreshed", "refreshed"]);
    assert.equal(calls, 1);
  });

  it("does not rotate again for a request sent before the last successful rotation", async () => {
    let clock = 1_000;
    let calls = 0;
    const coordinator = createRefreshCoordinator(
      async () => {
        calls += 1;
        return "refreshed";
      },
      { now: () => clock, reuseWindowMs: 5_000 }
    );

    const staleRequestSentAt = 990;
    assert.equal(await coordinator.refresh(995), "refreshed");
    clock = 1_200;
    assert.equal(await coordinator.refresh(staleRequestSentAt), "refreshed");
    assert.equal(calls, 1);

    // A request sent after the rotation that still gets 401 must rotate again.
    assert.equal(await coordinator.refresh(1_100), "refreshed");
    assert.equal(calls, 2);
  });

  it("maps a throwing runner to transient and releases the latch", async () => {
    let calls = 0;
    const coordinator = createRefreshCoordinator(async () => {
      calls += 1;
      if (calls === 1) throw new Error("network");
      return "refreshed";
    });
    assert.equal(await coordinator.refresh(), "transient");
    assert.equal(await coordinator.refresh(), "refreshed");
  });
});

describe("QA-MANUAL-001 isTransientSessionError", () => {
  it("detects the transient flag set by the interceptor", () => {
    assert.equal(isTransientSessionError({ [TRANSIENT_SESSION_ERROR_FLAG]: true }), true);
    assert.equal(isTransientSessionError({ response: { status: 401 } }), false);
    assert.equal(isTransientSessionError(null), false);
  });
});
