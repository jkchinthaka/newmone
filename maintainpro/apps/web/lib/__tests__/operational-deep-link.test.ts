import assert from "node:assert/strict";
import test from "node:test";

import {
  PM_DUE_SOON_HREF,
  canonicalizeWorkOrderSearch,
  parseWorkOrderRecordLink,
  visibleWorkOrderTab,
  workOrderRecordHref,
  workOrderTabLoads
} from "../operational-deep-link";
import { pmPlanStateFromSearch, pmPlanListParams } from "../pm-plan-list";
import { queueFiltersFromSearch } from "../work-order-queues-api";

test("operational shortcuts keep the destination filter", () => {
  const overdue = queueFiltersFromSearch({ filter: "overdue" });
  assert.equal(overdue.queue, "overdue");
  const verification = queueFiltersFromSearch({ filter: "verification-required" });
  assert.equal(verification.queue, "technician-completed");
  const parts = queueFiltersFromSearch({ filter: "waiting-parts" });
  assert.equal(parts.queue, "waiting-parts");
  const pm = pmPlanListParams(pmPlanStateFromSearch(new URLSearchParams(PM_DUE_SOON_HREF.split("?")[1])));
  assert.equal(pm.dueWindow, "7");
});

test("a work-order link opens the record and tab, and a stale tab falls back", () => {
  assert.equal(workOrderRecordHref("wo-1", "parts"), "/work-orders?wo=wo-1&tab=parts");
  const parsed = parseWorkOrderRecordLink({ open: "wo-1", tab: "vendor-repair" });
  assert.equal(parsed.id, "wo-1");
  assert.equal(parsed.tab, "vendor-repair");
  assert.equal(parseWorkOrderRecordLink({ wo: "wo-2", tab: "not-a-tab" }).tab, undefined);
  assert.equal(parseWorkOrderRecordLink({ wo: "  " }).id, undefined);
});

test("evidence loads activity and files; overview loads requirements only", () => {
  assert.deepEqual(workOrderTabLoads("evidence"), { activity: true, evidence: true, requirements: true });
  assert.deepEqual(workOrderTabLoads("overview"), { activity: false, evidence: false, requirements: true });
  assert.deepEqual(workOrderTabLoads("history"), { activity: false, evidence: false, requirements: false });
  assert.deepEqual(workOrderTabLoads("parts"), { activity: false, evidence: false, requirements: false });
});

test("audit deep links fall back when the user cannot see audit history", () => {
  assert.equal(visibleWorkOrderTab("audit", false), "overview");
  assert.equal(visibleWorkOrderTab("audit", true), "audit");
  assert.equal(visibleWorkOrderTab("parts", false), "parts");
});

test("open is copied to wo and then removed, even when wo is already set", () => {
  const copied = canonicalizeWorkOrderSearch(new URLSearchParams("open=wo-1&tab=parts"));
  assert.equal(copied.get("wo"), "wo-1");
  assert.equal(copied.get("open"), null);
  assert.equal(copied.get("tab"), "parts");
  const kept = canonicalizeWorkOrderSearch(new URLSearchParams("wo=wo-a&open=wo-b"));
  assert.equal(kept.get("wo"), "wo-a");
  assert.equal(kept.get("open"), null);
});

test("refresh keeps queue and record together", () => {
  const params = new URLSearchParams("queue=overdue&wo=wo-9&tab=evidence");
  const filters = queueFiltersFromSearch({ queue: params.get("queue") });
  const record = parseWorkOrderRecordLink({ wo: params.get("wo"), tab: params.get("tab") });
  assert.equal(filters.queue, "overdue");
  assert.equal(record.id, "wo-9");
  assert.equal(record.tab, "evidence");
});
