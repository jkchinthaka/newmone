export type InboxTabId =
  | "all"
  | "requests"
  | "work_orders"
  | "parts"
  | "vendor_quotations"
  | "vendor_invoices"
  | "emergency";

export const INBOX_TAB_LABELS: Array<{ id: InboxTabId; label: string }> = [
  { id: "all", label: "All" },
  { id: "requests", label: "Requests" },
  { id: "work_orders", label: "Work orders" },
  { id: "parts", label: "Parts" },
  { id: "vendor_quotations", label: "Vendor quotations" },
  { id: "vendor_invoices", label: "Vendor invoices" },
  { id: "emergency", label: "Emergency closures" }
];

export type InboxViewItem = {
  id: string;
  kind: string;
  tab: Exclude<InboxTabId, "all">;
  reference: string;
  title: string;
  requesterName: string;
  assetLabel: string | null;
  amount: number | null;
  taxRatePercent: number | null;
  priority: string | null;
  requestedAt: string;
  age: string;
  sla: "green" | "amber" | "red";
  version: number;
  canDecide: boolean;
  canReturn: boolean;
  workOrderId: string | null;
  attachments: Array<{ id: string; label: string }>;
  history: Array<{ at: string; label: string; reason?: string | null }>;
};

export function formatLkr(amount: number | null, taxRatePercent: number | null): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const money = new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2
  }).format(amount);
  if (taxRatePercent == null) return money;
  return `${money} (Tax ${taxRatePercent}%)`;
}

export function tabCounts(items: InboxViewItem[], counts?: Partial<Record<InboxTabId, number>>) {
  if (counts && counts.all != null) return counts;
  const next: Record<InboxTabId, number> = {
    all: items.length,
    requests: 0,
    work_orders: 0,
    parts: 0,
    vendor_quotations: 0,
    vendor_invoices: 0,
    emergency: 0
  };
  for (const item of items) next[item.tab] += 1;
  return next;
}

export function sameKindSelection(items: InboxViewItem[], selectedIds: string[]) {
  const selected = items.filter((item) => selectedIds.includes(item.id));
  const kinds = new Set(selected.map((item) => item.kind));
  return { selected, sameKind: kinds.size <= 1, overLimit: selected.some((item) => item.canDecide === false) };
}
