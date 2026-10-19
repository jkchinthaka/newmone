"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PendingApprovalsInbox } from "@/components/approvals/pending-approvals-inbox";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import {
  bulkApproveInbox,
  decideInboxItem,
  fetchApprovalInbox,
  type ApprovalInboxCounts,
  type ApprovalInboxItem
} from "@/lib/approvals-api";
import type { InboxTabId, InboxViewItem } from "@/lib/approval-inbox-view";
import { getApiErrorMessage } from "@/lib/api-client";

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

export default function ApprovalsInboxPage() {
  const [items, setItems] = useState<InboxViewItem[]>([]);
  const [counts, setCounts] = useState<ApprovalInboxCounts | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<InboxTabId>("all");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [site, setSite] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApprovalInbox({
        page: 1,
        pageSize: 50,
        tab,
        search: search || undefined,
        priority: priority || undefined,
        siteId: site || undefined,
        from: from || undefined,
        to: to || undefined
      });
      setItems((data.items ?? []).map(toView));
      setCounts(data.meta.counts);
    } catch (err) {
      setError(getApiErrorMessage(err, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, [tab, search, priority, site, from, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onDecide(item: InboxViewItem, decision: "APPROVED" | "REJECTED" | "RETURNED", reason?: string) {
    if (decision !== "APPROVED" && (reason?.trim().length ?? 0) < 3) {
      toast.error("A reason is required");
      return;
    }
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
    }
  }

  async function onBulkApprove(selected: InboxViewItem[]) {
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
    }
  }

  return (
    <div className="ops-page">
      <PageBreadcrumbs items={[{ label: "Approvals", href: "/approvals" }]} />
      <ResponsivePageHeader title="Pending Approvals" description="One inbox for requests, work, parts, and vendor documents." />
      {error ? <ErrorState title="Could not load approvals" description={error} onRetry={() => void refresh()} /> : null}
      <PendingApprovalsInbox
        items={items}
        counts={counts}
        loading={loading}
        tab={tab}
        onTab={setTab}
        search={search}
        onSearch={setSearch}
        priority={priority}
        onPriority={setPriority}
        site={site}
        onSite={setSite}
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        onDecide={(item, decision, reason) => void onDecide(item, decision, reason)}
        onBulkApprove={(selected) => void onBulkApprove(selected)}
      />
    </div>
  );
}
