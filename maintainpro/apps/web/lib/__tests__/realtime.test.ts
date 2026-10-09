import assert from "node:assert/strict";
import test from "node:test";

import { isRealtimeDisabled, realtimeSocketOptions } from "../realtime";

test("realtime stays off only when the public flag explicitly disables it", () => {
  assert.equal(isRealtimeDisabled(undefined), false);
  assert.equal(isRealtimeDisabled(""), false);
  assert.equal(isRealtimeDisabled("true"), false);
  assert.equal(isRealtimeDisabled("false"), true);
  assert.equal(isRealtimeDisabled("0"), true);
  assert.equal(isRealtimeDisabled("off"), true);
});

test("a failed realtime handshake does not schedule another connection", () => {
  const options = realtimeSocketOptions();
  assert.equal(options.reconnection, false);
  assert.ok(options.transports.includes("websocket"));
  assert.ok(options.transports.includes("polling"));
});
