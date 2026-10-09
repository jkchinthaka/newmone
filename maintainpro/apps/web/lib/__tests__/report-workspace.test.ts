import assert from "node:assert/strict";
import test from "node:test";

import {
  OPERATIONS_COMPLETION_RATE_DEFINITION,
  REPORT_EMPTY,
  reportRowHref,
  visibleWorkspaceModules,
  workspaceModuleFromSearch
} from "../report-workspace";

test("the report workspace keeps the operations completion definition and empty copy", () => {
  assert.match(OPERATIONS_COMPLETION_RATE_DEFINITION, /COMPLETED/);
  assert.equal(REPORT_EMPTY, "No report data matches the selected filters.");
  assert.equal(workspaceModuleFromSearch("financials"), "financials");
  assert.equal(workspaceModuleFromSearch("not-a-report"), "operations");
});

test("the financial tab stays hidden unless the role can view financial reports", () => {
  assert.equal(visibleWorkspaceModules("TECHNICIAN").some((item) => item.slug === "financials"), false);
  assert.equal(visibleWorkspaceModules("VIEWER").some((item) => item.slug === "financials"), false);
  assert.equal(visibleWorkspaceModules("FINANCE").some((item) => item.slug === "financials"), true);
  assert.equal(
    visibleWorkspaceModules("TECHNICIAN", ["reports.financials.view"]).some((item) => item.slug === "financials"),
    true
  );
});

test("a report row opens the source work order on the history tab", () => {
  assert.equal(reportRowHref({ workOrderId: "wo-4", woNumber: "WO-4" }), "/work-orders?wo=wo-4&tab=history");
  assert.equal(reportRowHref({ woNumber: "WO-4" }), null);
});
