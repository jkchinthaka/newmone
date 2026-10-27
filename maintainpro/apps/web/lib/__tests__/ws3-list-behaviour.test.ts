import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";

import { PendingApprovalsInbox } from "../../components/approvals/pending-approvals-inbox";
import { useAssetPageStore, visibleSelection } from "../../components/assets/use-asset-page-store";
import { fetchWorkOrdersPaginated } from "../../components/work-orders/api";
import { completedCountSource, workOrderListRequest } from "../../components/work-orders/hooks";
import { DEFAULT_WORK_ORDER_FILTERS } from "../../components/work-orders/types";
import { apiClient } from "../api-client";
import type { InboxViewItem } from "../approval-inbox-view";
import { ASSET_STATUSES } from "../asset-list";
import { workOrderCountsFromListSummary, workOrderCountsFromQueueSummary } from "../dashboard-work-order-counts";
import { normalizePartRow, partsPageMeta, toPartNumber } from "../inventory-control";
import {
  backgroundPollingOptions,
  clampPage,
  createRequestSequencer,
  listErrorPresentation,
  readServerTotal,
  totalPagesFor
} from "../list-query-state";
import { FALLBACK_QUEUE_SUMMARY } from "../work-order-queues-api";

(globalThis as { React?: typeof React }).React = React;

const webRoot = path.resolve(__dirname, "../..");
const source = (relative: string) => readFileSync(path.join(webRoot, relative), "utf8");

// --- Background polling / errors / paging -------------------------------------------------

test("a failed poll keeps rows (banner); only an error with nothing loaded is a full error", () => {
  assert.equal(listErrorPresentation({ isError: false, hasData: true }), "none");
  assert.equal(listErrorPresentation({ isError: true, hasData: true }), "banner");
  assert.equal(listErrorPresentation({ isError: true, hasData: false }), "full");
});

test("polling continues after errors and pauses on hidden tabs", () => {
  assert.deepEqual(backgroundPollingOptions(30_000), { refetchInterval: 30_000, refetchIntervalInBackground: false });
});

test("page is clamped to the last real page once totals arrive", () => {
  assert.equal(totalPagesFor(0, 25), 1);
  assert.equal(totalPagesFor(51, 25), 3);
  assert.equal(clampPage(2, 0, 25), 1, "no more 'Page 2 of 1 · 0 total'");
  assert.equal(clampPage(9, 60, 25), 3);
  assert.equal(clampPage(2, 60, 25), 2);
  assert.equal(clampPage(Number.NaN, 60, 25), 1);
});

test("server totals are read from meta.total when present, else the fallback", () => {
  assert.equal(readServerTotal({ items: [], meta: { total: 120 } }, 5), 120);
  assert.equal(readServerTotal({ items: [], meta: { total: "80" } }, 5), 80);
  assert.equal(readServerTotal({ items: [] }, 5), 5);
});

test("request sequencer ignores stale responses and aborts the previous request", () => {
  const sequencer = createRequestSequencer();
  const first = sequencer.begin();
  const second = sequencer.begin();
  assert.equal(sequencer.isLatest(first.id), false);
  assert.equal(sequencer.isLatest(second.id), true);
  assert.equal(first.signal?.aborted, true);
  sequencer.cancel();
  assert.equal(sequencer.isLatest(second.id), false);
});

// --- Dashboard work-order counts ------------------------------------------------------------

test("dashboard company counts come from the server queue summary, not a page of rows", () => {
  const summary = {
    ...FALLBACK_QUEUE_SUMMARY,
    queues: FALLBACK_QUEUE_SUMMARY.queues.map((queue) => ({
      ...queue,
      count: ({ all: 412, "open-requests": 37, "in-progress": 18, overdue: 9, completed: 290 } as Record<string, number>)[queue.key] ?? 0
    }))
  };
  assert.deepEqual(workOrderCountsFromQueueSummary(summary), { total: 412, open: 37, inProgress: 18, overdue: 9, completed: 290 });
});

test("assignee counts use the technician-filtered list summary and server completed total", () => {
  const stats = workOrderCountsFromListSummary(
    { total: 5, summary: { total: 44, open: 3, assigned: 40, inProgress: 6, overdue: 2, highRisk: 1, triage: 0 } },
    31
  );
  assert.deepEqual(stats, { total: 44, open: 3, inProgress: 6, overdue: 2, completed: 31, assigned: 44 });
});

test("dashboard summary no longer fetches page 1 of 25", () => {
  const dashboard = source("components/dashboard/work-orders-summary.tsx");
  assert.doesNotMatch(dashboard, /fetchWorkOrders\b/);
  assert.match(dashboard, /fetchWorkOrderQueueSummary/);
  assert.doesNotMatch(source("components/work-orders/api.ts"), /export async function fetchWorkOrders\(/);
});

// --- Work orders list/board ------------------------------------------------------------------

test("technician filter is sent to the server (no client-side filtering of one page)", async () => {
  const request = workOrderListRequest({ ...DEFAULT_WORK_ORDER_FILTERS, technicianId: "tech-7", page: 3 });
  assert.equal(request.technicianId, "tech-7");
  assert.equal(request.page, 3);

  const calls: string[] = [];
  const original = apiClient.get;
  (apiClient as { get: unknown }).get = async (url: string) => {
    calls.push(url);
    return { data: { data: { data: [], total: 0, page: 1, pageSize: 25, totalPages: 0 } } };
  };
  try {
    await fetchWorkOrdersPaginated({ page: 2, pageSize: 25, queue: "all", technicianId: "tech-7" });
    await fetchWorkOrdersPaginated({ page: 1, pageSize: 25, technicianId: "UNASSIGNED" });
    await fetchWorkOrdersPaginated({ page: 1, pageSize: 25, technicianId: "ALL" });
  } finally {
    (apiClient as { get: unknown }).get = original;
  }
  assert.match(calls[0] ?? "", /^\/work-orders\/queues\/all\?/);
  assert.match(calls[0] ?? "", /technicianId=tech-7/);
  assert.match(calls[0] ?? "", /page=2/);
  assert.match(calls[1] ?? "", /unassigned=true/);
  assert.doesNotMatch(calls[1] ?? "", /technicianId=/);
  assert.doesNotMatch(calls[2] ?? "", /technicianId=|unassigned=/);

  const hooks = source("components/work-orders/hooks.ts");
  assert.doesNotMatch(hooks, /order\.technicianId === filters\.technicianId/);
  assert.doesNotMatch(hooks, /row\.status === "COMPLETED"\)\.length/);
});

test("Completed card uses a server count unless the status filter already decides it", () => {
  assert.deepEqual(completedCountSource({ status: "COMPLETED" }, 12), { kind: "known", value: 12 });
  assert.deepEqual(completedCountSource({ status: "OPEN" }, 12), { kind: "known", value: 0 });
  assert.deepEqual(completedCountSource({ status: "ALL" }, 12), { kind: "fetch" });
});

test("List/Board views have a pager with the page in the URL; queue panel keeps rows while paging", () => {
  const page = source("components/work-orders/work-orders-page.tsx");
  assert.match(page, /<JobsPagination/);
  assert.match(page, /listPage/);
  assert.match(page, /enabled: view !== "queues"/);
  const panel = source("components/work-orders/work-order-queue-panel.tsx");
  assert.match(panel, /placeholderData: keepPreviousData/);
  assert.doesNotMatch(panel, /state\.error \? false/);
  assert.match(panel, /RefreshErrorBanner/);
  assert.match(panel, /clampPage\(/);
});

// --- Approvals --------------------------------------------------------------------------------

const approvalItem = (id: string): InboxViewItem => ({
  id,
  kind: "part",
  tab: "parts",
  reference: `PR-${id}`,
  title: "Bearing",
  requesterName: "Nimal",
  assetLabel: null,
  amount: null,
  taxRatePercent: null,
  priority: "HIGH",
  requestedAt: "2026-10-16T00:00:00.000Z",
  age: "2h",
  sla: "green",
  version: 1,
  canDecide: true,
  canReturn: true,
  workOrderId: null,
  attachments: [],
  history: []
});

const inboxProps = {
  tab: "all" as const,
  onTab: () => undefined,
  search: "",
  onSearch: () => undefined,
  priority: "",
  onPriority: () => undefined,
  site: "",
  onSite: () => undefined,
  from: "",
  to: "",
  onFrom: () => undefined,
  onTo: () => undefined,
  onDecide: () => undefined,
  onBulkApprove: () => undefined
};

test("approvals error shows only the error with Retry, never 'All caught up'", () => {
  const html = renderToString(
    React.createElement(PendingApprovalsInbox, { ...inboxProps, items: [], loading: false, error: "Network down", onRetry: () => undefined })
  );
  assert.match(html, /Could not load approvals/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /All caught up/);
});

test("approvals list paginates with the server total and uses 44px checkboxes", () => {
  const html = renderToString(
    React.createElement(PendingApprovalsInbox, {
      ...inboxProps,
      items: [approvalItem("1"), approvalItem("2")],
      counts: { all: 120 },
      loading: false,
      page: 2,
      pageSize: 50,
      total: 120,
      onPage: () => undefined,
      onPageSize: () => undefined
    })
  );
  assert.match(html, /Page <!-- -->2<!-- --> of <!-- -->3/);
  assert.match(html, /120<!-- --> total/);
  assert.match(html, /h-11 w-11[^"]*"[^>]*><input[^>]*type="checkbox"/);
  const page = source("app/(dashboard)/approvals/page.tsx");
  assert.doesNotMatch(page, /page: 1,\s*pageSize: 50/);
  assert.match(page, /createRequestSequencer/);
});

test("approval decision buttons disable while the decision is in flight", () => {
  const html = renderToString(
    React.createElement(PendingApprovalsInbox, {
      ...inboxProps,
      items: [approvalItem("1")],
      loading: false,
      busyIds: ["1"]
    })
  );
  assert.match(html, /disabled=""[^>]*>Reject/);
  assert.match(html, /Saving…/);
});

// --- Requests ---------------------------------------------------------------------------------

test("requests list sequences requests and no longer refetches when capabilities arrive", () => {
  const page = source("app/(dashboard)/requests/page.tsx");
  assert.match(page, /createRequestSequencer/);
  assert.match(page, /sequencer\.current\.isLatest\(request\.id\)/);
  const deps = page.match(/\}, \[assetQuery,[^\]]*\]\);/)?.[0] ?? "";
  assert.ok(deps, "refresh deps found");
  assert.doesNotMatch(deps, /canViewAll/);
  assert.match(page, /clampPage\(page, total, limit\)/);
});

// --- Inventory --------------------------------------------------------------------------------

test("inventory part quantities and money coerce Decimal strings", () => {
  assert.equal(toPartNumber("1250.50", 0), 1250.5);
  assert.equal(toPartNumber("", 0), 0);
  assert.equal(toPartNumber("abc"), undefined);
  const row = normalizePartRow({ id: "p1", quantityInStock: "12.000", availableQuantity: "7", reservedQuantity: null });
  assert.equal(row.quantityInStock, 12);
  assert.equal(row.availableQuantity, 7);
  assert.equal(row.reservedQuantity, null);
});

test("inventory pager reads data.pagination, then meta.total", () => {
  assert.deepEqual(partsPageMeta({ data: { items: [], pagination: { page: 2, pageSize: 25, total: 60 } } }, 2, 25, 25), {
    page: 2,
    pageSize: 25,
    total: 60,
    totalPages: 3
  });
  assert.equal(partsPageMeta({ data: { items: [] }, meta: { total: 99 } }, 1, 25, 25).total, 99);
});

test("inventory filters debounce; movement and top-used failures stay local; dead pages removed", () => {
  const page = source("components/inventory/inventory-control-page.tsx");
  assert.match(page, /<DebouncedField label="Category"/);
  assert.match(page, /<DebouncedField label="Location"/);
  assert.match(page, /setMovementsError\(getApiErrorMessage/);
  assert.doesNotMatch(page, /setError\(getApiErrorMessage\(err, "Unable to load movement history\."\)\)/);
  assert.match(page, /Most used parts could not be loaded/);
  assert.match(page, /<PortalRowMenu/);
  assert.equal(existsSync(path.join(webRoot, "components/inventory/inventory-page.tsx")), false);
  assert.equal(existsSync(path.join(webRoot, "components/inventory/inventory-table.tsx")), false);
});

// --- Assets -----------------------------------------------------------------------------------

test("asset statuses include DRAFT and OUT_OF_SERVICE everywhere", () => {
  assert.ok(ASSET_STATUSES.includes("DRAFT"));
  assert.ok(ASSET_STATUSES.includes("OUT_OF_SERVICE"));
  const page = source("components/assets/assets-management-page.tsx");
  assert.match(page, /status: z\.enum\(ASSET_STATUSES\)/);
  assert.match(page, /OUT_OF_SERVICE: "bg-orange-100/);
  assert.match(page, /DRAFT: "bg-sky-100/);
  assert.match(source("components/assets/assets-table.tsx"), /OUT_OF_SERVICE: "bg-orange-100/);
});

test("asset selection clears on filter/page/sort change and bulk actions use visible rows only", () => {
  const store = useAssetPageStore.getState();
  store.toggleManySelection(["a", "b"], true);
  assert.equal(useAssetPageStore.getState().selectedIds.length, 2);
  store.setPage(2);
  assert.deepEqual(useAssetPageStore.getState().selectedIds, []);
  store.toggleSelection("a");
  store.setFilters({ status: "DRAFT" });
  assert.deepEqual(useAssetPageStore.getState().selectedIds, []);
  store.toggleSelection("a");
  store.setSort("name");
  assert.deepEqual(useAssetPageStore.getState().selectedIds, []);
  store.clearFilters();

  assert.deepEqual(visibleSelection(["a", "x", "b"], ["a", "b", "c"]), ["a", "b"]);
  const page = source("components/assets/assets-management-page.tsx");
  assert.doesNotMatch(page, /ids: selectedIds,/);
  assert.match(page, /selected on this page/);
});

// --- Formatting -------------------------------------------------------------------------------

test("work order history money is LKR and maintenance-job dates use Colombo today", () => {
  assert.doesNotMatch(source("components/work-orders/work-order-history-panel.tsx"), /USD/);
  for (const file of ["components/maintenance-job/screens.tsx", "components/maintenance-job/provider.tsx"]) {
    const text = source(file);
    assert.doesNotMatch(text, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/, file);
    assert.match(text, /colomboTodayYmd\(\)/, file);
  }
});
