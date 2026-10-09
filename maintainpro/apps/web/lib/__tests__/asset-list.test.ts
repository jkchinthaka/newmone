import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSET_EMPTY,
  assetCreateWorkOrderHref,
  workOrderCreatePreset,
  assetFiltersFromSearch,
  assetHistoryHref,
  assetNextAction,
  assetSearchFromFilters
} from "../asset-list";

test("asset list keeps the empty copy and reads status, category, and page from the URL", () => {
  assert.equal(ASSET_EMPTY, "No assets match these filters.");
  const filters = assetFiltersFromSearch(
    new URLSearchParams("status=UNDER_MAINTENANCE&category=MACHINE&location=Plant+A&q=AST&page=2&pageSize=50&sortBy=assetTag&sortOrder=asc")
  );
  assert.equal(filters.status, "UNDER_MAINTENANCE");
  assert.equal(filters.category, "MACHINE");
  assert.equal(filters.location, "Plant A");
  assert.equal(filters.search, "AST");
  assert.equal(filters.page, 2);
  assert.equal(filters.pageSize, 50);
  assert.equal(filters.sortBy, "assetTag");
  assert.equal(filters.sortOrder, "asc");
  assert.equal(assetFiltersFromSearch(new URLSearchParams("status=active&pageSize=10")).status, "");
  assert.equal(assetFiltersFromSearch(new URLSearchParams("pageSize=10")).pageSize, 25);
});

test("asset filters round-trip into a shareable query string", () => {
  const query = assetSearchFromFilters(
    {
      search: "compressor",
      status: "ACTIVE",
      category: "",
      location: "",
      departmentId: "dept-1",
      condition: "CRITICAL",
      sortBy: "lastServiceDate",
      sortOrder: "asc",
      page: 1,
      pageSize: 25
    },
    "asset-9"
  );
  const params = new URLSearchParams(query);
  assert.equal(params.get("q"), "compressor");
  assert.equal(params.get("status"), "ACTIVE");
  assert.equal(params.get("departmentId"), "dept-1");
  assert.equal(params.get("condition"), "CRITICAL");
  assert.equal(params.get("sortBy"), "lastServiceDate");
  assert.equal(params.get("asset"), "asset-9");
});

test("asset row links open history for the tag and a work order with the asset selected", () => {
  assert.equal(assetHistoryHref("AST-9001"), "/maintenance/history?scope=asset&q=AST-9001");
  assert.equal(assetCreateWorkOrderHref("asset-9"), "/maintenance/jobs?create=1&assetId=asset-9");
  const href = assetCreateWorkOrderHref("asset-9", "AST-9001 — Air Compressor");
  const preset = workOrderCreatePreset(new URLSearchParams(href.split("?")[1]));
  assert.equal(preset?.assetId, "asset-9");
  assert.equal(preset?.assetLabel, "AST-9001 — Air Compressor");
  assert.equal(workOrderCreatePreset(new URLSearchParams("assetId=asset-9")), null);
});

test("next action follows maintenance state rather than repeating a quiet active status", () => {
  const now = Date.parse("2026-10-09T00:00:00.000Z");
  assert.equal(assetNextAction({ status: "UNDER_MAINTENANCE" }, now), "Under maintenance");
  assert.equal(assetNextAction({ status: "ACTIVE", openWorkOrderCount: 1 }, now), "Under maintenance");
  assert.equal(
    assetNextAction({ status: "ACTIVE", nextServiceDate: "2026-10-01T00:00:00.000Z", lastServiceDate: "2026-01-01" }, now),
    "Service overdue"
  );
  assert.equal(assetNextAction({ status: "ACTIVE", lastServiceDate: null }, now), "No recent service");
  assert.equal(assetNextAction({ status: "RETIRED" }, now), "Retired");
  assert.equal(
    assetNextAction({ status: "ACTIVE", lastServiceDate: "2026-09-01", condition: "GOOD" }, now),
    "Active / no action"
  );
});
