import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { replayableOfflineActions, type OfflineQueueItem } from "../offline-queue";

const item = (patch: Partial<OfflineQueueItem>): OfflineQueueItem => ({
  localActionId: "l",
  idempotencyKey: "k",
  actionType: "MAINTENANCE_REQUEST_CREATE",
  payload: {},
  createdAt: new Date().toISOString(),
  retryCount: 0,
  status: "PENDING",
  ownerUserId: "u-1",
  tenantId: "t-1",
  ...patch
});

test("offline reports are only sent by the person who saved them, for the same company", () => {
  const queue = [
    item({ localActionId: "mine" }),
    item({ localActionId: "other-user", ownerUserId: "u-2" }),
    item({ localActionId: "other-company", tenantId: "t-2" }),
    item({ localActionId: "sent", status: "SYNCED" }),
    item({ localActionId: "gave-up", status: "FAILED", retryCount: 5 }),
    item({ localActionId: "interrupted", status: "SYNCING" }),
    item({ localActionId: "no-owner", ownerUserId: undefined })
  ];
  assert.deepEqual(
    replayableOfflineActions(queue, { userId: "u-1", tenantId: "t-1" }, "MAINTENANCE_REQUEST_CREATE").map((i) => i.localActionId),
    ["mine", "interrupted"]
  );
  assert.deepEqual(replayableOfflineActions(queue, { userId: null, tenantId: "t-1" }, "MAINTENANCE_REQUEST_CREATE"), []);
});

test("signed-in API replies are marked no-store", () => {
  const source = readFileSync(path.join(__dirname, "..", "bff-proxy.ts"), "utf8");
  assert.match(source, /BFF_CACHE_CONTROL = "no-store, private, max-age=0"/);
  assert.equal((source.match(/BFF_CACHE_CONTROL\)/g) ?? []).length + (source.match(/"Cache-Control": BFF_CACHE_CONTROL/g) ?? []).length, 2);
});

test("service worker caps its caches and never caches the API", () => {
  const sw = readFileSync(path.join(__dirname, "..", "..", "public", "sw.js"), "utf8");
  assert.match(sw, /maintainpro-runtime-v4/);
  assert.match(sw, /RUNTIME_MAX_ENTRIES = 400/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
});

test("saved job filters never keep the page's job category", () => {
  const hooks = readFileSync(path.join(__dirname, "..", "..", "components", "work-orders", "hooks.ts"), "utf8");
  assert.match(hooks, /userScopedStorageKey\(FILTER_STORAGE_KEY\)/);
  assert.equal((hooks.match(/jobDomain: _pageOwned/g) ?? []).length, 2);
});
