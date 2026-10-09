import assert from "node:assert/strict";
import test from "node:test";

import {
  MAINTENANCE_HISTORY_EMPTY,
  historyHasFilters,
  historyListParams,
  historyRecordHref,
  historyStateFromSearch
} from "../maintenance-history";

test("history search and filters become the server request and survive the URL", () => {
  const state = historyStateFromSearch(
    new URLSearchParams("q=pump&scope=asset&from=2026-01-01&to=2026-01-31&status=CLOSED&category=Electrical&page=2&pageSize=50")
  );
  assert.equal(state.scope, "asset");
  assert.equal(state.status, "CLOSED");
  assert.equal(state.page, 2);
  assert.equal(state.pageSize, 50);
  const params = historyListParams(state);
  assert.equal(params.q, "pump");
  assert.equal(params.scope, "asset");
  assert.equal(params.from, "2026-01-01");
  assert.equal(params.status, "CLOSED");
  assert.equal(params.category, "Electrical");
  assert.equal(params.pageSize, 50);
  assert.equal(historyStateFromSearch(new URLSearchParams("status=OPEN")).status, "");
  assert.equal(historyStateFromSearch(new URLSearchParams("pageSize=10")).pageSize, 25);
});

test("a history row opens that work order on the history tab", () => {
  assert.equal(historyRecordHref("wo-9"), "/work-orders?wo=wo-9&tab=history");
});

test("an empty register uses the history empty message and a clear path", () => {
  assert.equal(MAINTENANCE_HISTORY_EMPTY, "No maintenance history matches these filters.");
  const cleared = historyStateFromSearch(new URLSearchParams(""));
  assert.equal(historyHasFilters(cleared), false);
  assert.equal(historyListParams(cleared).status, undefined);
  assert.equal(historyListParams(cleared).page, 1);
});
