import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => readFileSync(path.resolve(__dirname, "../../components/work-orders", file), "utf8");

test("Jobs queue page keeps only search and status up front; the rest sits under More filters", () => {
  const panel = read("work-order-queue-panel.tsx");
  const detailsAt = panel.indexOf('<details className="relative">');
  assert.ok(detailsAt > 0);
  for (const label of ["Priority", "Assigned to", "Type of job", "Saved views"]) {
    assert.ok(panel.indexOf(`${label}\n`, detailsAt) > detailsAt, `${label} should be inside More filters`);
  }
  assert.ok(panel.indexOf('<span className="sr-only">Status</span>') < detailsAt);
});

test("Jobs list view: priority and assignee are under More filters, counts are one line", () => {
  const bar = read("work-order-filters-bar.tsx");
  assert.ok(bar.indexOf("<span>Priority</span>") > bar.indexOf("showMoreFilters ? ("));
  assert.match(bar, /filters\.priority !== "ALL"/);
  const page = read("work-orders-page.tsx");
  assert.doesNotMatch(page, /grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Job counts"/);
  assert.match(page, /aria-label="Job counts"/);
});

test("Technicians do not see the Machine stopped time and Vendor repair tabs unless opened by link", () => {
  assert.match(read("work-order-detail-tabs.tsx"), /hideTabs\?\.includes\(tab\.id\) && tab\.id !== activeTab/);
  assert.match(read("work-order-editor-modal.tsx"), /\["safety", "vendor-repair"\]/);
});
