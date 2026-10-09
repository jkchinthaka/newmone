import { test } from "node:test";
import assert from "node:assert/strict";

import { myJobFilterHref, resolveMyJobFilter } from "../my-job-filters";

test("home card filters map onto My Jobs", () => {
  assert.equal(myJobFilterHref("active"), "/work-orders/my");
  assert.equal(myJobFilterHref("due-today"), "/work-orders/my?filter=due-today");
  assert.equal(myJobFilterHref("overdue"), "/work-orders/my?filter=overdue");
  assert.equal(myJobFilterHref("waiting-parts"), "/work-orders/my?filter=waiting-parts");
  assert.equal(myJobFilterHref("evidence-needed"), "/work-orders/my?filter=evidence-needed");
  assert.equal(myJobFilterHref("rework-required"), "/work-orders/my?filter=rework-required");
});

test("resolveMyJobFilter prefers filter over the older view query", () => {
  assert.equal(resolveMyJobFilter({ filter: "due-today", view: "overdue" }), "due-today");
  assert.equal(resolveMyJobFilter({ view: "waiting-parts" }), "waiting-parts");
  assert.equal(resolveMyJobFilter({ filter: "not-a-filter", view: "completed" }), "completed");
  assert.equal(resolveMyJobFilter({}), "active");
  assert.equal(resolveMyJobFilter({ filter: "  overdue  " }), "overdue");
});
