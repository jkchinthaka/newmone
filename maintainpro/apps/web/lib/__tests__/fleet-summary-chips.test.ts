import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";

import { FleetSummaryChips } from "../../components/fleet/fleet-workspace";
import type { FleetOverviewSummary } from "../fleet-lifecycle-api";

(globalThis as { React?: typeof React }).React = React;

const zeros: FleetOverviewSummary = {
  dueService: 0,
  overdueService: 0,
  expiringDocs: 0,
  blockedVehicles: 0,
  openRepairs: 0,
  outOfService: 0,
  activeTyreIssues: 0,
  batteriesWarrantyExpiring: 0,
  asOf: "2026-10-21T00:00:00.000Z"
};

test("fleet summary error is shown instead of dashes", () => {
  const html = renderToString(
    React.createElement(FleetSummaryChips, {
      summary: null,
      loading: false,
      failed: true,
      onRetry: () => undefined,
      onSelect: () => undefined
    })
  );
  assert.match(html, /Couldn't load fleet summary|Couldn&#x27;t load fleet summary/);
  assert.match(html, /Retry/);
  assert.equal(html.includes("–"), false);
});

test("fleet summary zeros render as 0", () => {
  const html = renderToString(
    React.createElement(FleetSummaryChips, {
      summary: zeros,
      loading: false,
      failed: false,
      onRetry: () => undefined,
      onSelect: () => undefined
    })
  );
  assert.equal(html.match(/>0</g)?.length, 5);
  assert.equal(html.includes("text-red-700"), false);
  assert.equal(html.includes("–"), false);
});
