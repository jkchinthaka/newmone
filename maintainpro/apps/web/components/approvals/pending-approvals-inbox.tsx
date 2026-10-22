"use client";

import { useMemo, useState } from "react";

import { DateRangeField } from "@/components/forms/date-fields";
import { QueueChip } from "@/components/ui/dashboard";
import { approvalAmountTone, sortOldestFirst } from "@/lib/batch-3-presentation";
import { STATUS_TONE_CLASS } from "@/lib/dashboard-status";
import {
  formatLkr,
  INBOX_TAB_LABELS,
  sameKindSelection,
  tabCounts,
  type InboxTabId,
  type InboxViewItem
} from "@/lib/approval-inbox-view";

const AMOUNT_TONE = {
  red: "red",
  amber: "amber",
  neutral: "neutral"
} as const;

export function PendingApprovalsInbox({
  items,
  counts,
  loading,
  tab,
  onTab,
  search,
  onSearch,
  priority,
  onPriority,
  site,
  onSite,
  from,
  to,
  onFrom,
  onTo,
  onDecide,
  onBulkApprove
}: {
  items: InboxViewItem[];
  counts?: Partial<Record<InboxTabId, number>>;
  loading: boolean;
  tab: InboxTabId;
  onTab: (tab: InboxTabId) => void;
  search: string;
  onSearch: (value: string) => void;
  priority: string;
  onPriority: (value: string) => void;
  site: string;
  onSite: (value: string) => void;
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onDecide: (item: InboxViewItem, decision: "APPROVED" | "REJECTED" | "RETURNED", reason?: string) => void;
  onBulkApprove: (items: InboxViewItem[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const totals = tabCounts(items, counts);
  const visible = useMemo(() => {
    const filtered = tab === "all" ? items : items.filter((item) => item.tab === tab);
    return sortOldestFirst(filtered);
  }, [items, tab]);
  const bulk = sameKindSelection(visible, selected);
  const explicit = visible.find((item) => item.id === openId) ?? null;
  const desktopItem = explicit ?? visible[0] ?? null;

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function decide(item: InboxViewItem, decision: "APPROVED" | "REJECTED" | "RETURNED") {
    onDecide(item, decision, reason);
    setReason("");
  }

  return (
    <div className="min-w-0">
      <p className="text-sm text-slate-600" data-testid="approval-total">
        {totals.all ?? 0} pending
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto" role="tablist">
        {INBOX_TAB_LABELS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className="shrink-0"
            onClick={() => onTab(entry.id)}
          >
            <QueueChip active={tab === entry.id}>
              {entry.label} ({totals[entry.id] ?? 0})
            </QueueChip>
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_11rem]">
        <input
          className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="Search reference, title, or requester"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          aria-label="Search approvals"
        />
        <select className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm" aria-label="Priority" value={priority} onChange={(event) => onPriority(event.target.value)}>
          <option value="">All priorities</option>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <input className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm" aria-label="Site" placeholder="Site" value={site} onChange={(event) => onSite(event.target.value)} />
      </div>
      <div className="mt-3 max-w-xl">
        <DateRangeField from={from} to={to} onFromChange={onFrom} onToChange={onTo} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="min-h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-40"
          disabled={!bulk.sameKind || bulk.selected.length === 0 || bulk.selected.some((item) => !item.canDecide)}
          onClick={() => onBulkApprove(bulk.selected)}
        >
          Approve selected
        </button>
        {!bulk.sameKind ? <span className="text-sm text-amber-700">Select one type</span> : null}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" data-testid="approval-skeleton">
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">All caught up</p>
      ) : (
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
          <section className="min-w-0 rounded-card border border-slate-200 bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Pending ({visible.length})</h2>
                <p className="text-xs text-slate-500">Oldest first</p>
              </div>
              <label className="text-sm text-slate-600">
                <span className="sr-only">Type</span>
                <select aria-label="Type" className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value={tab} onChange={(event) => onTab(event.target.value as InboxTabId)}>
                  {INBOX_TAB_LABELS.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <ul className="divide-y divide-slate-100">
              {visible.map((item) => {
                const tone = approvalAmountTone(item.amount);
                const active = desktopItem?.id === item.id;
                return (
                  <li key={item.id}>
                    <div className={`flex gap-3 px-4 py-3 ${active ? "bg-emerald-50/60" : ""}`}>
                      <input className="mt-1" type="checkbox" aria-label={`Select ${item.reference}`} checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                      <button type="button" className="min-w-0 flex-1 text-left" data-testid="approval-card" onClick={() => setOpenId(item.id)}>
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block font-medium text-slate-900">{item.title}</span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {item.reference}
                              {item.requesterName ? ` · ${item.requesterName}` : ""}
                              {item.age ? ` · ${item.age}` : ""}
                            </span>
                          </span>
                          {tone ? (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE_CLASS[AMOUNT_TONE[tone]]}`}>
                              {formatLkr(item.amount, item.taxRatePercent)}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          {desktopItem ? <DetailPanel className="hidden lg:block" item={desktopItem} reason={reason} onReason={setReason} onDecide={decide} /> : null}
        </div>
      )}

      {explicit ? (
        <div className="fixed inset-0 z-40 flex items-end bg-slate-900/30 lg:hidden" onClick={() => setOpenId(null)}>
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl" role="dialog" aria-label="Approval details" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex justify-end">
              <button type="button" className="min-h-10 px-2 text-sm" onClick={() => setOpenId(null)}>Close</button>
            </div>
            <DetailPanel item={explicit} reason={reason} onReason={setReason} onDecide={decide} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailPanel({
  item,
  reason,
  onReason,
  onDecide,
  className
}: {
  item: InboxViewItem;
  reason: string;
  onReason: (value: string) => void;
  onDecide: (item: InboxViewItem, decision: "APPROVED" | "REJECTED" | "RETURNED") => void;
  className?: string;
}) {
  const priorReason = [...item.history].reverse().find((entry) => entry.reason?.trim())?.reason?.trim();
  return (
    <aside className={`rounded-card border border-slate-200 bg-white p-4 shadow-card ${className ?? ""}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{item.tab.replaceAll("_", " ")}</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">{item.title}</h2>
      <p className="text-sm text-slate-600">{item.reference}</p>
      <dl className="mt-4 space-y-2 text-sm">
        {item.assetLabel ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Asset</dt>
            <dd className="text-right text-slate-900">{item.assetLabel}</dd>
          </div>
        ) : null}
        {item.taxRatePercent != null ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Tax</dt>
            <dd className="text-right text-slate-900">{item.taxRatePercent}%</dd>
          </div>
        ) : null}
        {item.amount != null ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Total</dt>
            <dd className="text-right font-medium text-slate-900">{formatLkr(item.amount, null)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Requested by</dt>
          <dd className="text-right text-slate-900">{item.requesterName}</dd>
        </div>
        {item.priority ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Priority</dt>
            <dd className="text-right text-slate-900">{item.priority}</dd>
          </div>
        ) : null}
        {priorReason ? (
          <div>
            <dt className="text-slate-500">Reason</dt>
            <dd className="mt-1 text-slate-900">{priorReason}</dd>
          </div>
        ) : null}
      </dl>
      {item.attachments.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Attachments</h3>
          {item.attachments.map((file) => <p key={file.id} className="text-sm">{file.label}</p>)}
        </div>
      ) : null}
      <label className="mt-4 block text-sm">
        Comment
        <textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Add a note for the requester..." value={reason} onChange={(event) => onReason(event.target.value)} />
      </label>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {item.canDecide ? (
          <>
            <button type="button" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800" onClick={() => onDecide(item, "REJECTED")}>Reject</button>
            <button type="button" className="min-h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white" onClick={() => onDecide(item, "APPROVED")}>Approve</button>
          </>
        ) : null}
        {item.canReturn ? (
          <button type="button" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm" onClick={() => onDecide(item, "RETURNED")}>Return for info</button>
        ) : null}
      </div>
    </aside>
  );
}
