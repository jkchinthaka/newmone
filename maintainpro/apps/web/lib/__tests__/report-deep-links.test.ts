import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyReportUrlState, resolveReportFocus } from "../../components/reports/report-focus";
import { resolveRoleHome } from "../role-home";

const base = {
  startDate: "2026-09-01",
  endDate: "2026-10-06",
  departmentId: "",
  departmentIds: [],
  userId: "",
  driverId: "",
  assetId: "",
  vehicleId: "",
  status: "",
  supplierId: "",
  category: "",
  search: "",
  page: 3,
  pageSize: 25,
  sortBy: "name",
  sortDirection: "asc" as const
};

describe("Report card deep links", () => {
  it("does not turn a deep link into a text search that empties the report", () => {
    const hrefs = new Map(resolveRoleHome("MANAGER").cards.map((card) => [card.id, card.href]));
    for (const id of ["pm-compliance", "downtime"]) {
      const url = new URL(String(hrefs.get(id)), "http://localhost");
      assert.equal(url.searchParams.get("search"), null, `${id} must not filter by free text`);
      assert.ok(url.searchParams.get("focus"), `${id} must carry a focus target`);
    }
    assert.equal(hrefs.get("repeat-failures"), "/reports/maintenance-exceptions?type=repeated-breakdowns");
  });

  it("downtime focus sorts the assets table by downtime, highest first", () => {
    const next = applyReportUrlState(base, "assets", new URLSearchParams("focus=downtime"));
    assert.equal(next.sortBy, "downtimeHours");
    assert.equal(next.sortDirection, "desc");
    assert.equal(next.page, 1);
    assert.equal(next.search, "");
    assert.equal(resolveReportFocus("assets", "downtime")?.cardKey, "downtime");
  });

  it("pm-compliance focus targets the performance PM card only on that module", () => {
    assert.equal(resolveReportFocus("performance", "pm-compliance")?.cardKey, "pm-compliance");
    assert.equal(resolveReportFocus("assets", "pm-compliance"), null);
  });

  it("re-derives state from the URL so back/forward restores the previous view", () => {
    const focused = applyReportUrlState(base, "assets", new URLSearchParams("focus=downtime&search=pump"));
    assert.equal(focused.search, "pump");
    const back = applyReportUrlState(focused, "assets", new URLSearchParams(""));
    assert.equal(back.search, "");
  });
});
