"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Info, Search, Siren, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { DateField } from "@/components/forms/date-fields";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ActiveFilterChips } from "@/components/operational";
import { ErrorState, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { useNotificationsSocket } from "@/hooks/use-notifications-socket";
import { apiClient } from "@/lib/api-client";
import {
  inboxSearchParams,
  inboxStateFromSearch,
  notificationContextHref,
  notificationContextIsLinked,
  notificationNextAction,
  notificationStateLabel,
  type InboxUrlState
} from "@/lib/notification-inbox";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: "INFO" | "WARNING" | "CRITICAL";
  module: string;
  isRead: boolean;
  acknowledgedAt: string | null;
  dueAt: string | null;
  createdAt: string;
  deepLink: string;
  referenceType: string | null;
  referenceId: string | null;
};

type ListPayload = {
  items: NotificationItem[];
  summary: { unread: number; critical: number; overdue: number };
  dailySummary: { text: string; critical: number; overdueOpen: number } | null;
};

type Envelope<T> = { data: T; meta?: { page?: number; total?: number; totalPages?: number } };

function ageLabel(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

const SEVERITY: Record<string, { icon: LucideIcon; bg: string; fg: string }> = {
  INFO: { icon: Info, bg: "bg-sky-100", fg: "text-sky-700" },
  WARNING: { icon: AlertTriangle, bg: "bg-amber-100", fg: "text-amber-700" },
  CRITICAL: { icon: Siren, bg: "bg-rose-100", fg: "text-rose-700" }
};

function dayLabel(value: string) {
  const d = new Date(value);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Math.floor((start.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Earlier this week";
  return "Older";
}

function NotificationsInbox() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const state = inboxStateFromSearch(new URLSearchParams(params.toString()));
  const [draftQuery, setDraftQuery] = useState(state.q);
  const [more, setMore] = useState(Boolean(state.module || state.ack || state.overdue || state.from || state.to));
  const [briefOpen, setBriefOpen] = useState(false);

  const replaceState = (next: InboxUrlState) => {
    router.replace(`${pathname}${inboxSearchParams(next)}` as never);
  };

  const listQuery = useQuery({
    queryKey: ["notifications", "inbox", state],
    queryFn: async () => {
      const response = await apiClient.get<Envelope<ListPayload>>("/notifications", {
        params: {
          status: state.status || "ALL",
          priority: state.priority || undefined,
          type: state.type || undefined,
          search: state.q || undefined,
          module: state.module || undefined,
          acknowledged: state.ack || undefined,
          overdue: state.overdue ? "1" : undefined,
          from: state.from || undefined,
          to: state.to || undefined,
          page: state.page,
          pageSize: state.pageSize
        }
      });
      return {
        payload: response.data.data,
        total: Number(response.data.meta?.total ?? 0),
        totalPages: Number(response.data.meta?.totalPages ?? 1)
      };
    }
  });

  const briefQuery = useQuery({
    queryKey: ["notifications", "brief"],
    enabled: briefOpen,
    queryFn: async () => {
      const response = await apiClient.get<Envelope<{ text: string }>>("/notifications/ai-summary");
      return response.data.data;
    }
  });

  useNotificationsSocket(() => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (error) => toast.error(toSafeApiErrorMessage(error, "Could not mark the notification read."))
  });

  const markAll = useMutation({
    mutationFn: () => apiClient.patch("/notifications/mark-all-read"),
    onSuccess: () => {
      toast.success("All notifications marked read.");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => toast.error(toSafeApiErrorMessage(error, "Could not mark all notifications read."))
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) => apiClient.post(`/notifications/${id}/actions`, { action: "ACKNOWLEDGE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (error) => toast.error(toSafeApiErrorMessage(error, "Could not acknowledge the notification."))
  });

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    replaceState({ ...state, q: draftQuery.trim(), page: 1 });
  };

  const summary = listQuery.data?.payload.summary;
  const items = listQuery.data?.payload.items ?? [];
  const chips = [
    state.q ? { id: "q", label: `Search: ${state.q}` } : null,
    state.status ? { id: "status", label: state.status === "UNREAD" ? "Unread" : "Read" } : null,
    state.priority ? { id: "priority", label: state.priority } : null,
    state.type ? { id: "type", label: state.type.replaceAll("_", " ") } : null,
    state.module ? { id: "module", label: state.module } : null,
    state.ack ? { id: "ack", label: state.ack === "yes" ? "Acknowledged" : "Not acknowledged" } : null,
    state.overdue ? { id: "overdue", label: "Overdue" } : null
  ].filter((chip): chip is { id: string; label: string } => Boolean(chip));

  const clearAll = () => {
    setDraftQuery("");
    replaceState({ ...state, q: "", status: "", priority: "", type: "", module: "", ack: "", overdue: false, from: "", to: "", page: 1 });
  };
  const noTabFilter = !state.status && !state.priority && !state.overdue;
  const tabs = [
    { key: "unread", label: "Unread", count: summary?.unread, active: state.status === "UNREAD" && !state.priority && !state.overdue, tone: "bg-sky-100 text-sky-700", go: () => replaceState({ ...state, status: "UNREAD", priority: "", overdue: false, page: 1 }) },
    { key: "critical", label: "Critical", count: summary?.critical, active: state.priority === "CRITICAL" && !state.overdue, tone: "bg-rose-100 text-rose-700", go: () => replaceState({ ...state, status: "", priority: "CRITICAL", overdue: false, page: 1 }) },
    { key: "overdue", label: "Overdue", count: summary?.overdue, active: state.overdue, tone: "bg-slate-200 text-slate-700", go: () => replaceState({ ...state, status: "", priority: "", overdue: true, page: 1 }) },
    { key: "all", label: "All", count: undefined, active: noTabFilter, tone: "", go: () => replaceState({ ...state, status: "", priority: "", overdue: false, page: 1 }) }
  ];
  const groups: { label: string; rows: NotificationItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(item);
    else groups.push({ label, rows: [item] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <PageBreadcrumbs />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">What needs your attention now</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all read
          </button>
          <Link href={"/settings?tab=notifications" as never} className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Preferences
          </Link>
        </div>
      </header>

      <div className="flex gap-6 border-b border-slate-200" role="tablist" aria-label="Notification views" aria-live="polite">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" role="tab" aria-selected={tab.active} onClick={tab.go} className={`-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 px-1 text-sm ${tab.active ? "border-brand-600 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {tab.label}
            {tab.count !== undefined ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tab.tone}`}>{tab.count}</span> : null}
          </button>
        ))}
      </div>

      <form className="flex flex-wrap gap-2" onSubmit={submitSearch}>
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search notifications"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            className="min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm"
            placeholder="Search notifications"
          />
        </div>
        <select aria-label="Priority" value={state.priority} onChange={(event) => replaceState({ ...state, priority: event.target.value, page: 1 })} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="">Any priority</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
        <button type="button" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" aria-expanded={more} onClick={() => setMore((open) => !open)}>
          More filters
        </button>
        <button type="submit" className="sr-only">Search</button>
      </form>

      {more ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <label className="text-sm text-slate-700">
            Type
            <input aria-label="Type" value={state.type} onChange={(event) => replaceState({ ...state, type: event.target.value.toUpperCase(), page: 1 })} className="field w-40" placeholder="WORK_ORDER" />
          </label>
          <label className="text-sm text-slate-700">
            Status
            <select aria-label="Status" value={state.status} onChange={(event) => replaceState({ ...state, status: event.target.value as InboxUrlState["status"], page: 1 })} className="field">
              <option value="">All</option>
              <option value="UNREAD">Unread</option>
              <option value="READ">Read</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Source
            <select aria-label="Source module" value={state.module} onChange={(event) => replaceState({ ...state, module: event.target.value, page: 1 })} className="field">
              <option value="">Any module</option>
              <option value="maintenance">Maintenance</option>
              <option value="fleet">Fleet</option>
              <option value="inventory">Inventory</option>
              <option value="facilities">Facilities</option>
              <option value="utilities">Utilities</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Acknowledged
            <select aria-label="Acknowledged" value={state.ack} onChange={(event) => replaceState({ ...state, ack: event.target.value as InboxUrlState["ack"], page: 1 })} className="field">
              <option value="">Any</option>
              <option value="no">Not acknowledged</option>
              <option value="yes">Acknowledged</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            From
            <DateField bare label="From date" value={state.from} onChange={(from) => replaceState({ ...state, from, page: 1 })} />
          </label>
          <label className="text-sm text-slate-700">
            To
            <DateField bare label="To date" value={state.to} onChange={(to) => replaceState({ ...state, to, page: 1 })} />
          </label>
          <button type="button" className="min-h-10 rounded-lg px-3 text-sm text-slate-600 hover:text-slate-900" onClick={clearAll}>
            Clear all
          </button>
        </div>
      ) : null}

      <ActiveFilterChips
        chips={chips.map((chip) => ({ key: chip.id, label: chip.label }))}
        onRemove={(id) => {
          if (id === "q") setDraftQuery("");
          replaceState({
            ...state,
            page: 1,
            q: id === "q" ? "" : state.q,
            status: id === "status" ? "" : state.status,
            priority: id === "priority" ? "" : state.priority,
            type: id === "type" ? "" : state.type,
            module: id === "module" ? "" : state.module,
            ack: id === "ack" ? "" : state.ack,
            overdue: id === "overdue" ? false : state.overdue
          });
        }}
        onClearAll={clearAll}
      />

      <details onToggle={(event) => setBriefOpen((event.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-sm font-medium text-slate-600">Daily brief</summary>
        {briefOpen ? (
          <p className="mt-1 text-sm text-slate-600">
            {briefQuery.isLoading ? "Checking today’s alerts." : briefQuery.data?.text?.trim() || "No alerts to summarize."}
          </p>
        ) : null}
      </details>

      {listQuery.isLoading ? <LoadingState title="Loading notifications" description="Fetching the current page." /> : null}
      {listQuery.error ? (
        <ErrorState title="Could not load notifications" description={toSafeApiErrorMessage(listQuery.error, "Unable to load notifications.")} onRetry={() => void listQuery.refetch()} error={listQuery.error} />
      ) : null}

      {listQuery.data && items.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">You are all caught up. Nothing matches these filters.</p> : null}

      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{group.label}</h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {group.rows.map((item) => {
              const href = notificationContextHref(item);
              const linked = notificationContextIsLinked(href);
              const needsAck = !item.acknowledgedAt && item.priority !== "INFO";
              const sev = SEVERITY[item.priority] ?? SEVERITY.INFO;
              const SevIcon = sev.icon;
              return (
                <li key={item.id} className={`flex items-start gap-3 px-4 py-3 ${item.isRead ? "bg-white" : "bg-sky-50/60"}`}>
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${sev.bg}`} title={item.priority}>
                    <SevIcon size={15} className={sev.fg} />
                    <span className="sr-only">{item.priority} · {notificationStateLabel(item)}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.title}
                      {item.isRead ? null : <span className="ml-2 inline-block h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}
                    </p>
                    <p className="text-sm text-slate-600">{item.message}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      {linked ? (
                        <Link href={href as never} className="font-semibold text-brand-600 hover:underline">
                          {notificationNextAction(item)} →
                        </Link>
                      ) : (
                        <span className="text-slate-400">No linked record</span>
                      )}
                      {needsAck ? (
                        <button type="button" className="font-medium text-slate-600 hover:text-slate-900" aria-busy={acknowledge.isPending} disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(item.id)}>
                          Acknowledge
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-400">
                    <p className="whitespace-nowrap">{ageLabel(item.createdAt)}</p>
                    {item.isRead ? null : (
                      <button type="button" className="mt-1 inline-flex items-center gap-1 font-medium text-slate-500 hover:text-brand-600" aria-busy={markRead.isPending} disabled={markRead.isPending} onClick={() => markRead.mutate(item.id)}>
                        <Check size={12} /> Mark read
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p>
          Page {state.page} of {listQuery.data?.totalPages ?? 1} · {listQuery.data?.total ?? 0} total
        </p>
        <label>
          Page size
          <select
            aria-label="Page size"
            value={state.pageSize}
            onChange={(event) => replaceState({ ...state, pageSize: Number(event.target.value) as InboxUrlState["pageSize"], page: 1 })}
            className="ml-2 rounded-md border border-slate-300 px-2 py-1"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-50" disabled={state.page <= 1} onClick={() => replaceState({ ...state, page: state.page - 1 })}>
            Previous
          </button>
          <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-50" disabled={state.page >= (listQuery.data?.totalPages ?? 1)} onClick={() => replaceState({ ...state, page: state.page + 1 })}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-slate-600">Loading notifications.</p>}>
      <NotificationsInbox />
    </Suspense>
  );
}
