"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PendingApprovalsInbox } from "@/components/approvals/pending-approvals-inbox";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import {
  bulkApproveInbox,
  decideInboxItem,
  fetchApprovalInbox,
  type ApprovalInboxCounts,
  type ApprovalInboxItem
} from "@/lib/approvals-api";
import { INBOX_TAB_LABELS, type InboxTabId, type InboxViewItem } from "@/lib/approval-inbox-view";
import { useLiveRefresh } from "@/lib/live-data";
import { getApiErrorMessage } from "@/lib/api-client";
import { clampPage, createRequestSequencer, isAbortError, readServerTotal } from "@/lib/list-query-state";

function toView(item: ApprovalInboxItem): InboxViewItem {
  return {
    id: item.id,
    kind: item.kind ?? "approval",
    tab: item.tab ?? "requests",
    reference: item.reference ?? item.subjectEntityId ?? item.id,
    title: item.title ?? item.processType ?? "Approval",
    requesterName: item.requesterName ?? "Unknown",
    assetLabel: item.assetLabel ?? null,
    amount: item.amount ?? null,
    taxRatePercent: item.taxRatePercent ?? null,
    priority: item.priority ?? null,
    requestedAt: item.requestedAt,
    age: item.age ?? "",
    sla: item.sla ?? "green",
    version: item.version ?? 0,
    canDecide: item.canDecide !== false,
    canReturn: item.canReturn !== false,
    workOrderId: item.workOrderId ?? null,
    attachments: item.attachments ?? [],
    history: item.history ?? []
  };
}

const DEFAULT_PAGE_SIZE = 25;

function initialInboxTab(): InboxTabId {
  if (typeof window === "undefined") return "all";
  const requested = new URLSearchParams(window.location.search).get("tab");
  return INBOX_TAB_LABELS.some((entry) => entry.id === requested) ? (requested as InboxTabId) : "all";
}

export default function ApprovalsInboxPage() {
  const [items, setItems] = useState<InboxViewItem[]>([]);
  const [counts, setCounts] = useState<ApprovalInboxCounts | undefined>();
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ?tab=parts (for example from the dashboard Approvals card) opens that category.
  const [tab, setTab] = useState<InboxTabId>("all");
  useEffect(() => {
    const requested = initialInboxTab();
    if (requested !== "all") setTab(requested);
  }, []);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [site, setSite] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const sequencer = useRef(createRequestSequencer());

  // Search and Site are committed by debounced inputs in the inbox, so typing does not fire per keystroke.
  const refresh = useCallback(async (options: { silent?: boolean } = {}) => {
    const request = sequencer.current.begin();
    // Automatic updates keep the list on screen while fetching; filter changes show the spinner.
    if (!options.silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchApprovalInbox({
        page,
        pageSize,
        tab,
        search: search || undefined,
        priority: priority || undefined,
        siteId: site || undefined,
        from: from || undefined,
        to: to || undefined
      }, { signal: request.signal });
      // A slower, older request must not overwrite the newer filter's results.
      if (!sequencer.current.isLatest(request.id)) return;
      const rows = (data.items ?? []).map(toView);
      setItems(rows);
      setCounts(data.meta?.counts);
      setTotal(readServerTotal(data, rows.length));
    } catch (err) {
      if (!sequencer.current.isLatest(request.id) || isAbortError(err)) return;
      // A failed background refresh keeps the rows already shown.
      if (options.silent) return;
      setError(getApiErrorMessage(err, "Request failed"));
    } finally {
      if (sequencer.current.isLatest(request.id)) setLoading(false);
    }
  }, [page, pageSize, tab, search, priority, site, from, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // New approvals from other people, and decisions made in other tabs, appear without a reload.
  useLiveRefresh(() => refresh({ silent: true }));

  useEffect(() => {
    const sequence = sequencer.current;
    return () => sequence.cancel();
  }, []);

  // Clamp after a decision empties the last page.
  useEffect(() => {
    if (loading || error) return;
    const clamped = clampPage(page, total, pageSize);
    if (clamped !== page) setPage(clamped);
  }, [error, loading, page, pageSize, total]);

  const withFirstPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  async function onDecide(item: InboxViewItem, decision: "APPROVED" | "REJECTED" | "RETURNED", reason?: string) {
    if (decision !== "APPROVED" && (reason?.trim().length ?? 0) < 3) {
      toast.error("A reason is required");
      return;
    }
    if (busyIds.includes(item.id)) return;
    setBusyIds((current) => [...current, item.id]);
    try {
      await decideInboxItem({
        id: item.id,
        kind: item.kind,
        decision,
        reason,
        expectedVersion: item.version,
        workOrderId: item.workOrderId,
        idempotencyKey: crypto.randomUUID()
      });
      toast.success(decision === "APPROVED" ? "Approved" : decision === "RETURNED" ? "Returned" : "Rejected");
      await refresh();
    } catch (err) {
      const message = getApiErrorMessage(err, "Request failed");
      toast.error(message.includes("Refresh") ? "This approval changed. Refresh and try again." : message);
      if (message.includes("Refresh")) await refresh();
    } finally {
      setBusyIds((current) => current.filter((id) => id !== item.id));
    }
  }

  async function onBulkApprove(selected: InboxViewItem[]) {
    if (bulkBusy) return;
    setBulkBusy(true);
    try {
      const result = await bulkApproveInbox(
        selected.map((item) => ({
          id: item.id,
          kind: item.kind,
          expectedVersion: item.version,
          workOrderId: item.workOrderId
        })),
        crypto.randomUUID()
      );
      const failed = result.results.filter((row) => !row.ok);
      if (failed.length === 0) toast.success("Approved");
      else toast.error(`${failed.length} of ${result.results.length} could not be approved`);
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Request failed"));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="ops-page">
      <PageBreadcrumbs items={[{ label: "Approvals", href: "/approvals" }]} />
      <ResponsivePageHeader title="Approvals" description="Items waiting for your decision. You cannot approve your own requests." />
      <PendingApprovalsInbox
        items={items}
        counts={counts}
        loading={loading}
        error={error}
        onRetry={() => void refresh()}
        tab={tab}
        onTab={withFirstPage(setTab)}
        search={search}
        onSearch={withFirstPage(setSearch)}
        priority={priority}
        onPriority={withFirstPage(setPriority)}
        site={site}
        onSite={withFirstPage(setSite)}
        from={from}
        to={to}
        onFrom={withFirstPage(setFrom)}
        onTo={withFirstPage(setTo)}
        page={page}
        pageSize={pageSize}
        total={total}
        onPage={setPage}
        onPageSize={withFirstPage(setPageSize)}
        busyIds={busyIds}
        bulkBusy={bulkBusy}
        onDecide={(item, decision, reason) => void onDecide(item, decision, reason)}
        onBulkApprove={(selected) => void onBulkApprove(selected)}
      />
    </div>
  );
}
