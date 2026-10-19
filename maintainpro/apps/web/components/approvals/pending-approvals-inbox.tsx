"use client";

import { useMemo, useState } from "react";

import { DateRangeField } from "@/components/forms/date-fields";
import {
  formatLkr,
  INBOX_TAB_LABELS,
  sameKindSelection,
  tabCounts,
  type InboxTabId,
  type InboxViewItem
} from "@/lib/approval-inbox-view";

const SLA_CLASS = {
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800"
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
  const [open, setOpen] = useState<InboxViewItem | null>(null);
  const [reason, setReason] = useState("");
  const totals = tabCounts(items, counts);
  const visible = useMemo(() => (tab === "all" ? items : items.filter((item) => item.tab === tab)), [items, tab]);
  const bulk = sameKindSelection(visible, selected);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div>
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
            className={`min-h-10 shrink-0 rounded-full px-3 text-sm ${tab === entry.id ? "bg-slate-900 text-white" : "bg-slate-100"}`}
            onClick={() => onTab(entry.id)}
          >
            {entry.label} ({totals[entry.id] ?? 0})
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
        <input
          className="min-h-10 rounded-lg border px-3 text-sm"
          placeholder="Search reference, title, or requester"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          aria-label="Search approvals"
        />
        <select className="min-h-10 rounded-lg border px-3 text-sm" aria-label="Priority" value={priority} onChange={(event) => onPriority(event.target.value)}>
          <option value="">All priorities</option>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <input className="min-h-10 rounded-lg border px-3 text-sm" aria-label="Site" placeholder="Site" value={site} onChange={(event) => onSite(event.target.value)} />
      </div>
      <div className="mt-3 max-w-xl">
        <DateRangeField from={from} to={to} onFromChange={onFrom} onToChange={onTo} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="min-h-10 rounded-lg bg-emerald-700 px-3 text-sm text-white disabled:opacity-40"
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
        <p className="mt-6 rounded-lg border border-dashed p-8 text-center text-sm text-slate-600">All caught up</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:hidden">
            {visible.map((item) => (
              <article key={item.id} className="rounded-xl border bg-white p-4" data-testid="approval-card">
                <RowBody item={item} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="min-h-10 rounded-lg border px-3 text-sm" onClick={() => setOpen(item)}>Details</button>
                  <DecisionButtons item={item} onDecide={onDecide} />
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto rounded-xl border sm:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3" />
                  <th className="p-3">Item</th>
                  <th className="p-3">Requester</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Age</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className="cursor-pointer border-t" onClick={() => setOpen(item)}>
                    <td className="p-3" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${item.reference}`} checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                    </td>
                    <td className="p-3"><RowBody item={item} /></td>
                    <td className="p-3">{item.requesterName}</td>
                    <td className="p-3">{formatLkr(item.amount, item.taxRatePercent) ?? "—"}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${SLA_CLASS[item.sla]}`}>{item.age}</span></td>
                    <td className="p-3" onClick={(event) => event.stopPropagation()}>
                      <DecisionButtons item={item} onDecide={onDecide} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {open ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={() => setOpen(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl" role="dialog" aria-label="Approval details" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-slate-500">{open.tab.replaceAll("_", " ")}</p>
                <h2 className="text-lg font-semibold">{open.title}</h2>
                <p className="text-sm text-slate-600">{open.reference}</p>
              </div>
              <button type="button" className="min-h-10 px-2 text-sm" onClick={() => setOpen(null)}>Close</button>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="text-slate-500">Requester</dt><dd>{open.requesterName}</dd></div>
              <div><dt className="text-slate-500">Asset / vehicle</dt><dd>{open.assetLabel ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Amount</dt><dd>{formatLkr(open.amount, open.taxRatePercent) ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Priority</dt><dd>{open.priority ?? "—"}</dd></div>
            </dl>
            <h3 className="mt-4 text-sm font-semibold">Attachments</h3>
            {open.attachments.length === 0 ? <p className="text-sm text-slate-500">None</p> : open.attachments.map((file) => <p key={file.id} className="text-sm">{file.label}</p>)}
            <h3 className="mt-4 text-sm font-semibold">History</h3>
            {open.history.length === 0 ? <p className="text-sm text-slate-500">No earlier decisions</p> : open.history.map((entry) => (
              <p key={`${entry.at}-${entry.label}`} className="text-sm">{entry.label}{entry.reason ? ` — ${entry.reason}` : ""}</p>
            ))}
            <label className="mt-4 block text-sm">
              Reason
              <textarea className="mt-1 min-h-20 w-full rounded-lg border px-3 py-2" value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <DecisionButtons
                item={open}
                onDecide={(item, decision) => {
                  onDecide(item, decision, reason);
                  setReason("");
                }}
              />
              {open.canReturn ? (
                <button type="button" className="min-h-10 rounded-lg border px-3 text-sm" onClick={() => onDecide(open, "RETURNED", reason)}>
                  Return for info
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function RowBody({ item }: { item: InboxViewItem }) {
  return (
    <div>
      <p className="font-medium text-slate-900">{item.reference}</p>
      <p className="text-slate-700">{item.title}</p>
      <p className="text-xs text-slate-500">{item.requesterName}{item.assetLabel ? ` · ${item.assetLabel}` : ""}</p>
      {item.priority ? <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs">{item.priority}</span> : null}
    </div>
  );
}

function DecisionButtons({
  item,
  onDecide
}: {
  item: InboxViewItem;
  onDecide: (item: InboxViewItem, decision: "APPROVED" | "REJECTED" | "RETURNED", reason?: string) => void;
}) {
  if (!item.canDecide) return null;
  return (
    <>
      <button type="button" className="min-h-10 rounded-lg bg-emerald-600 px-3 text-sm text-white" onClick={() => onDecide(item, "APPROVED")}>Approve</button>
      <button type="button" className="min-h-10 rounded-lg border border-red-200 px-3 text-sm text-red-700" onClick={() => onDecide(item, "REJECTED")}>Reject</button>
    </>
  );
}
