import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { KpiCard } from "../../components/ui/dashboard/kpi-card";
import { StatusBadge } from "../../components/ui/dashboard/status-badge";
import { statusBadgePresentation } from "../dashboard-status";

test("status badge keeps work-order labels and tones, including legacy statuses", () => {
  assert.deepEqual(statusBadgePresentation("COMPLETED"), { label: "Closed", tone: "emerald" });
  assert.deepEqual(statusBadgePresentation("OVERDUE"), { label: "Overdue (Legacy)", tone: "red" });
  assert.equal(statusBadgePresentation("ASSIGNED").label, "Assigned");
  assert.equal(statusBadgePresentation("ASSIGNED").tone, "violet");
  assert.equal(statusBadgePresentation("OPEN").tone, "sky");
  assert.equal(statusBadgePresentation("TECHNICIAN_COMPLETED").tone, "fuchsia");
  assert.equal(statusBadgePresentation("TECHNICIAN_COMPLETED").label, "Done, waiting for check");
  assert.equal(statusBadgePresentation("ON_HOLD").label, "On hold");
  assert.equal(statusBadgePresentation("APPROVED").tone, "emerald");
  assert.equal(statusBadgePresentation("PENDING").tone, "amber");
  const html = renderToString(createElement(StatusBadge, { status: "IN_PROGRESS" }));
  assert.match(html, /In progress/);
});

test("kpi card shows the value, label, and optional delta", () => {
  const html = renderToString(createElement(KpiCard, { label: "Overdue", value: "4", delta: "2 new" }));
  assert.match(html, /Overdue/);
  assert.match(html, /4/);
  assert.match(html, /2 new/);
});
