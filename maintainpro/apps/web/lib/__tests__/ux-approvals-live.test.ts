import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { approvalsSummary } from "../approvals-summary";
import { LIVE_REFRESH_INTERVAL_MS, shouldAnnounceWrite } from "../live-data";
import { reportReviewSections } from "../report-issue-review";

describe("Report a Problem: Review and Submit", () => {
  const base = {
    description: "Loud grinding noise from the gearbox",
    reportedUrgency: "URGENT",
    safetyImpact: "NO",
    productionImpact: "REDUCED"
  };

  it("lists each earlier question with its answer, step by step", () => {
    const sections = reportReviewSections({ ...base, targetKind: "MACHINE", machineLabel: "Boiler 1 (AST-001)" });
    assert.deepEqual(
      sections.map((section) => [section.step, section.title]),
      [
        [1, "What has a problem?"],
        [2, "Which one?"],
        [3, "Describe the problem"],
        [4, "Urgency and impact"]
      ]
    );
    assert.deepEqual(sections[0].items, [{ question: "Type of problem", answer: "Machine / Equipment" }]);
    assert.deepEqual(sections[1].items, [{ question: "Which machine?", answer: "Boiler 1 (AST-001)" }]);
    assert.equal(sections[2].items[0].answer, "Loud grinding noise from the gearbox");
    assert.deepEqual(
      sections[3].items.map((item) => item.answer),
      ["Urgent", "No", "Reduced / Partial"]
    );
  });

  it("asks where the problem is when the reporter is not sure, and marks empty answers", () => {
    const sections = reportReviewSections({ ...base, targetKind: "NOT_SURE", siteName: "Main plant", approximateLocation: "" });
    assert.equal(sections[1].title, "Where is the problem?");
    assert.deepEqual(sections[1].items, [
      { question: "Site", answer: "Main plant" },
      { question: "Approximate area", answer: "Not given", multiline: true }
    ]);
  });

  it("shows site and functional location for a facility", () => {
    const sections = reportReviewSections({ ...base, targetKind: "FACILITY", siteName: "Main plant", locationLabel: "Boiler house" });
    assert.deepEqual(
      sections[1].items.map((item) => `${item.question}: ${item.answer}`),
      ["Site: Main plant", "Functional location: Boiler house"]
    );
  });
});

describe("Maintenance Dashboard: Approvals card", () => {
  it("shows the same total and per-category counts as the Approvals page, each linking to its tab", () => {
    const summary = approvalsSummary(
      { all: 7, requests: 2, work_orders: 3, parts: 1, vendor_quotations: 0, vendor_invoices: 1, emergency: 0 },
      7
    );
    assert.equal(summary.total, 7);
    assert.deepEqual(
      summary.categories.map((row) => [row.id, row.count, row.href]),
      [
        ["requests", 2, "/approvals?tab=requests"],
        ["work_orders", 3, "/approvals?tab=work_orders"],
        ["parts", 1, "/approvals?tab=parts"],
        ["vendor_quotations", 0, "/approvals?tab=vendor_quotations"],
        ["vendor_invoices", 1, "/approvals?tab=vendor_invoices"],
        ["emergency", 0, "/approvals?tab=emergency"]
      ]
    );
  });

  it("falls back to the total, then to the sum, when counts are missing", () => {
    assert.equal(approvalsSummary(null, 4).total, 4);
    assert.equal(approvalsSummary({ requests: 1, parts: 2 }).total, 3);
  });
});

describe("automatic updates", () => {
  it("refreshes after saved changes but not after sign-in or telemetry", () => {
    assert.equal(shouldAnnounceWrite("post", "/work-orders/abc/assign"), true);
    assert.equal(shouldAnnounceWrite("PATCH", "/maintenance-requests/abc"), true);
    assert.equal(shouldAnnounceWrite("delete", "/inventory/parts/1"), true);
    assert.equal(shouldAnnounceWrite("get", "/work-orders"), false);
    assert.equal(shouldAnnounceWrite(undefined, "/work-orders"), false);
    assert.equal(shouldAnnounceWrite("post", "/auth/refresh"), false);
    assert.equal(shouldAnnounceWrite("post", "/telemetry/web-vitals"), false);
    assert.equal(shouldAnnounceWrite("post", "/client-errors"), false);
    assert.equal(shouldAnnounceWrite("post", "/authors"), true);
    assert.equal(shouldAnnounceWrite("post", "/inventory/goods-in/preview"), false);
    assert.equal(shouldAnnounceWrite("post", "/cleaning/issues/duplicate-check"), false);
    assert.equal(shouldAnnounceWrite("post", "/inventory/goods-in"), true);
  });

  it("polls every 30 seconds while a screen is visible", () => {
    assert.equal(LIVE_REFRESH_INTERVAL_MS, 30_000);
  });
});
