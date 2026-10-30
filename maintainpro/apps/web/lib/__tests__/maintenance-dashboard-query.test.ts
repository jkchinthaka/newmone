import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import React, { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import {
  maintenanceRefetchInterval,
  shouldRetryMaintenanceQuery
} from "../maintenance-dashboard-query";
import { withTenantScope } from "../tenant-query";

(globalThis as { React?: typeof React }).React = React;

const require = createRequire(import.meta.url);

async function loadDashboardPage(): Promise<ComponentType> {
  const loaded = await import("../../components/maintenance/maintenance-dashboard-page");
  return loaded.MaintenanceDashboardPage;
}

const dashboardFixture = {
  openJobs: 4,
  machineryJobs: 1,
  serviceJobs: 2,
  vehicleJobs: 1,
  overdueJobs: 3,
  waitingParts: 0,
  pendingApprovals: null,
  pmDueSoon: 1,
  lowStock: null,
  requestsOpen: 2,
  unassignedJobs: 1,
  inProgressJobs: 1,
  onHoldJobs: 0,
  verificationRequired: 0,
  priorityWorkList: [],
  availability: {
    inventory: false,
    approvals: false,
    mttr: false,
    mtbf: false,
    erpExceptions: false,
    gateBlocks: false
  },
  notAvailable: {
    mttr: "Not Configured",
    mtbf: "Not Configured",
    erpExceptions: "Not Available",
    gateBlocks: "Not Available"
  },
  generatedAt: "2026-10-13T10:00:00.000Z"
};

function renderDashboard(page: ComponentType, client?: QueryClient) {
  const element = createElement(page);
  const tree = client ? createElement(QueryClientProvider, { client }, element) : element;
  return renderToString(tree);
}

test("maintenance dashboard and its provider share one React Query module", () => {
  const fromApp = require.resolve("@tanstack/react-query");
  assert.match(fromApp.replaceAll("\\", "/"), /node_modules\/@tanstack\/react-query\//);
  assert.equal(typeof useQuery, "function");
  assert.equal(typeof QueryClientProvider, "function");
});

test("maintenance dashboard renders loading under QueryClientProvider", async () => {
  const page = await loadDashboardPage();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } }
  });
  const html = renderDashboard(page, client);
  assert.match(html, /Loading maintenance dashboard/);
  client.clear();
});

test("maintenance dashboard renders fetched counts instead of crashing", async () => {
  const page = await loadDashboardPage();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } }
  });
  await client.prefetchQuery({
    queryKey: withTenantScope(["maintenance", "dashboard", "d6"]),
    queryFn: async () => dashboardFixture
  });
  const html = renderDashboard(page, client);
  assert.match(html, /Maintenance Dashboard/);
  assert.match(html, /Overdue/);
  assert.match(html, />3</);
  assert.doesNotMatch(html, /Something went wrong/);
  client.clear();
});

test("maintenance dashboard keeps the last data and shows a refresh banner when a poll fails", async () => {
  const page = await loadDashboardPage();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } }
  });
  const queryKey = withTenantScope(["maintenance", "dashboard", "d6"]);
  await client.prefetchQuery({
    queryKey,
    queryFn: async () => dashboardFixture
  });
  const cached = client.getQueryCache().find({ queryKey });
  assert.ok(cached);
  cached.setState({
    ...cached.state,
    status: "error",
    fetchStatus: "idle",
    error: Object.assign(new Error("unavailable"), { response: { status: 503 } })
  });
  const html = renderDashboard(page, client);
  assert.match(html, /Could not refresh the dashboard/);
  assert.match(html, />3</);
  assert.doesNotMatch(html, /Unable to load maintenance dashboard/);
  client.clear();
});

test("maintenance dashboard shows an error state when the API fails with nothing loaded", async () => {
  const page = await loadDashboardPage();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, refetchInterval: false } }
  });
  const queryKey = withTenantScope(["maintenance", "dashboard", "d6"]);
  await client.prefetchQuery({
    queryKey,
    queryFn: async () => dashboardFixture
  });
  const cached = client.getQueryCache().find({ queryKey });
  assert.ok(cached);
  cached.setState({
    ...cached.state,
    data: undefined,
    status: "error",
    fetchStatus: "idle",
    error: Object.assign(new Error("unavailable"), { response: { status: 503 } })
  });
  const html = renderDashboard(page, client);
  assert.match(html, /Unable to load maintenance dashboard/);
  assert.doesNotMatch(html, /No QueryClient set/);
  assert.doesNotMatch(html, /Something went wrong/);
  client.clear();
});

test("maintenance dashboard without a provider throws the QueryClient error", async () => {
  const page = await loadDashboardPage();
  assert.throws(() => renderDashboard(page), /No QueryClient set/);
});

test("rendering the dashboard does not loop or update state during render", async () => {
  const page = await loadDashboardPage();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } }
  });
  const first = renderDashboard(page, client);
  const second = renderDashboard(page, client);
  assert.equal(first, second);
  client.clear();
});

test("maintenance queries do not retry terminal auth or unavailable responses", () => {
  assert.equal(shouldRetryMaintenanceQuery(0, { response: { status: 401 } }), false);
  assert.equal(shouldRetryMaintenanceQuery(0, { response: { status: 403 } }), false);
  assert.equal(shouldRetryMaintenanceQuery(0, { response: { status: 503 } }), false);
  assert.equal(shouldRetryMaintenanceQuery(0, new Error("network")), true);
  assert.equal(shouldRetryMaintenanceQuery(1, new Error("network")), false);
  // A failed poll no longer stops polling; the dashboard keeps its last data and retries on the next live refresh.
  assert.equal(maintenanceRefetchInterval({ state: { error: new Error("down") } }), 30_000);
  assert.equal(maintenanceRefetchInterval({ state: { error: { response: { status: 403 } } } }), false);
  assert.equal(maintenanceRefetchInterval({ state: { error: null } }), 30_000);
});
