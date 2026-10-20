import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";

import { PendingApprovalsInbox } from "../../components/approvals/pending-approvals-inbox";
import { formatLkr, sameKindSelection, type InboxViewItem } from "../approval-inbox-view";

(globalThis as { React?: typeof React }).React = React;

const item = (overrides: Partial<InboxViewItem> = {}): InboxViewItem => ({
  id: "1",
  kind: "vendor_invoice",
  tab: "vendor_invoices",
  reference: "INV-18",
  title: "Pump repair",
  requesterName: "Nimal",
  assetLabel: "Pump A",
  amount: 1180,
  taxRatePercent: 18,
  priority: "HIGH",
  requestedAt: "2026-10-16T00:00:00.000Z",
  age: "4h",
  sla: "amber",
  version: 5,
  canDecide: true,
  canReturn: false,
  workOrderId: "wo-1",
  attachments: [{ id: "file-1", label: "Invoice file" }],
  history: [],
  ...overrides
});

test("formats LKR with tax percent", () => {
  assert.match(formatLkr(1180, 18) ?? "", /LKR/);
  assert.match(formatLkr(1180, 18) ?? "", /Tax 18%/);
});

test("bulk approve stays on one type", () => {
  const rows = [item(), item({ id: "2", kind: "part", tab: "parts" })];
  assert.equal(sameKindSelection(rows, ["1", "2"]).sameKind, false);
  assert.equal(sameKindSelection(rows, ["1"]).sameKind, true);
});

test("inbox renders tabs, amount, empty state, and skeletons", () => {
  const html = renderToString(
    React.createElement(PendingApprovalsInbox, {
      items: [item()],
      counts: { all: 3, requests: 0, work_orders: 1, parts: 1, vendor_quotations: 0, vendor_invoices: 1, emergency: 0 },
      loading: false,
      tab: "all",
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
    })
  );
  assert.match(html, /pending/);
  assert.match(html, /Vendor invoices/);
  assert.match(html, /INV-18/);
  assert.match(html, /Tax 18%/);
  assert.match(html, /Approve/);

  const empty = renderToString(
    React.createElement(PendingApprovalsInbox, {
      items: [],
      loading: false,
      tab: "all",
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
    })
  );
  assert.match(empty, /All caught up/);

  const loading = renderToString(
    React.createElement(PendingApprovalsInbox, {
      items: [],
      loading: true,
      tab: "all",
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
    })
  );
  assert.match(loading, /approval-skeleton/);
});
