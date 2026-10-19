import assert from "node:assert/strict";
import { test } from "node:test";

import { isDatabaseUnavailableError } from "../api-client";
import { shouldRetryMaintenanceQuery } from "../maintenance-dashboard-query";
import {
  UPSTREAM_RECONNECTING_MESSAGE,
  getUpstreamDegraded,
  isUpstreamUnavailableError,
  markUpstreamDegraded,
  markUpstreamHealthy,
  queryRetryDelay,
  shouldRetryQuery,
  subscribeUpstreamStatus
} from "../upstream-status";

const upstream503 = { response: { status: 503, data: { error: { code: "UPSTREAM_UNAVAILABLE" } } } };
const db503 = { response: { status: 503, data: { error: { code: "DATABASE_UNAVAILABLE" } } } };

test("queries retry twice on 502, 503 and 504", () => {
  for (const status of [502, 503, 504]) {
    const error = { response: { status } };
    assert.equal(shouldRetryQuery(0, error), true, `first retry for ${status}`);
    assert.equal(shouldRetryQuery(1, error), true, `second retry for ${status}`);
    assert.equal(shouldRetryQuery(2, error), false, `no third retry for ${status}`);
  }
});

test("queries never retry other 4xx", () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429]) {
    assert.equal(shouldRetryQuery(0, { response: { status } }), false, String(status));
  }
});

test("queries retry a network error with no response", () => {
  assert.equal(shouldRetryQuery(0, { code: "ERR_NETWORK" }), true);
});

test("retry delay grows exponentially and is capped", () => {
  assert.equal(queryRetryDelay(0), 1000);
  assert.equal(queryRetryDelay(1), 2000);
  assert.equal(queryRetryDelay(10), 8000);
});

test("an upstream restart is not reported as a database outage", () => {
  assert.equal(isUpstreamUnavailableError(upstream503), true);
  assert.equal(isDatabaseUnavailableError(upstream503), false);
  assert.equal(isDatabaseUnavailableError(db503), true);
  assert.equal(isDatabaseUnavailableError({ response: { status: 503 } }), true);
});

test("maintenance dashboard retries an upstream restart but not a database outage", () => {
  assert.equal(shouldRetryMaintenanceQuery(0, upstream503), true);
  assert.equal(shouldRetryMaintenanceQuery(0, db503), false);
});

test("reconnecting state is set on failure and cleared on recovery", () => {
  const seen: boolean[] = [];
  const unsubscribe = subscribeUpstreamStatus((degraded) => seen.push(degraded));
  markUpstreamHealthy();
  markUpstreamDegraded();
  assert.equal(getUpstreamDegraded(), true);
  markUpstreamDegraded();
  markUpstreamHealthy();
  assert.equal(getUpstreamDegraded(), false);
  unsubscribe();
  assert.deepEqual(seen, [true, false]);
  assert.match(UPSTREAM_RECONNECTING_MESSAGE, /Reconnecting/);
});
