import { INBOX_TAB_LABELS, type InboxTabId } from "@/lib/approval-inbox-view";
import type { ApprovalInboxCounts } from "@/lib/approvals-api";

/** Dashboard Approvals card: total waiting and the count per category (same numbers as Approvals). */
export type ApprovalsSummary = {
  total: number;
  categories: Array<{ id: Exclude<InboxTabId, "all">; label: string; count: number; href: string }>;
};

export function approvalsSummary(counts: Partial<ApprovalInboxCounts> | null | undefined, total?: number | null): ApprovalsSummary {
  const categories = INBOX_TAB_LABELS.filter((entry) => entry.id !== "all").map((entry) => ({
    id: entry.id as Exclude<InboxTabId, "all">,
    label: entry.label,
    count: Number(counts?.[entry.id as keyof ApprovalInboxCounts] ?? 0) || 0,
    href: `/approvals?tab=${entry.id}`
  }));
  const fromCounts = Number(counts?.all ?? NaN);
  return {
    total: Number.isFinite(fromCounts) ? fromCounts : Number(total ?? categories.reduce((sum, row) => sum + row.count, 0)),
    categories
  };
}
