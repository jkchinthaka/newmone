"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ActiveFilterChips } from "@/components/operational";
import { ErrorState, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { useNotificationsSocket } from "@/hooks/use-notifications-socket";
import { apiClient } from "@/lib/api-client";
import {
  inboxSearchParams,
  inboxStateFromSearch,
  notificationContextHref,
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

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <PageBreadcrumbs />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="mt-1 text-sm text-brand-800">What needs your attention now.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary disabled:opacity-60"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </button>
          <Link href={"/settings?tab=notifications" as never} className="btn-quiet">
            Preferences
          </Link>
        </div>
      </header>

      <p className="summary-strip" aria-live="polite">
        <span><span className="font-semibold">{summary?.unread ?? "–"}</span> unread</span>
        <span><span className="font-semibold text-rose-700">{summary?.critical ?? "–"}</span> critical</span>
        <span><span className="font-semibold">{summary?.overdue ?? "–"}</span> overdue</span>
      </p>

      <form className="toolbar" onSubmit={submitSearch}>
        <label className="text-sm text-slate-700">
          Search
          <input
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            className="field w-56"
            placeholder="Title, message, or record"
          />
        </label>
        <label className="text-sm text-slate-700">
          Status
          <select
            aria-label="Status"
            value={state.status}
            onChange={(event) => replaceState({ ...state, status: event.target.value as InboxUrlState["status"], page: 1 })}
            className="field"
          >
            <option value="">All</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Priority
          <select
            aria-label="Priority"
            value={state.priority}
            onChange={(event) => replaceState({ ...state, priority: event.target.value, page: 1 })}
            className="field"
          >
            <option value="">All</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Type
          <input
            aria-label="Type"
            value={state.type}
            onChange={(event) => replaceState({ ...state, type: event.target.value.toUpperCase(), page: 1 })}
            className="field w-40"
            placeholder="WORK_ORDER"
          />
        </label>
        <button type="button" className="btn-quiet" onClick={() => setMore((open) => !open)}>
          More filters
        </button>
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
          Search
        </button>
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-sm text-slate-700"
          onClick={() => {
            setDraftQuery("");
            replaceState({ ...state, q: "", status: "", priority: "", type: "", module: "", ack: "", overdue: false, from: "", to: "", page: 1 });
          }}
        >
          Clear
        </button>
      </form>

      {more ? (
        <div className="flex flex-wrap gap-2">
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
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={state.overdue} onChange={(event) => replaceState({ ...state, overdue: event.target.checked, page: 1 })} />
            Overdue only
          </label>
          <label className="text-sm text-slate-700">
            From
            <input aria-label="From date" type="date" value={state.from} onChange={(event) => replaceState({ ...state, from: event.target.value, page: 1 })} className="field" />
          </label>
          <label className="text-sm text-slate-700">
            To
            <input aria-label="To date" type="date" value={state.to} onChange={(event) => replaceState({ ...state, to: event.target.value, page: 1 })} className="field" />
          </label>
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
        onClearAll={() => replaceState({ ...state, q: "", status: "", priority: "", type: "", module: "", ack: "", overdue: false, from: "", to: "", page: 1 })}
      />

      <details onToggle={(event) => setBriefOpen((event.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Daily brief</summary>
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

      {listQuery.data && items.length === 0 ? <p className="text-sm text-slate-600">No notifications match these filters.</p> : null}

      <ul className="divide-y divide-brand-100 overflow-hidden rounded-card border border-brand-100 bg-white shadow-card">
        {items.map((item) => {
          const href = notificationContextHref(item);
          const stateLabel = notificationStateLabel(item);
          return (
            <li key={item.id} className={`flex flex-wrap items-start justify-between gap-3 border-l-4 px-3 py-2.5 ${item.priority === "CRITICAL" ? "border-l-rose-600" : item.priority === "WARNING" ? "border-l-accent-500" : "border-l-brand-600"} ${item.isRead ? "bg-white" : "bg-brand-50"}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  <span className="sr-only">{item.priority} </span>
                  {item.priority} · {stateLabel}
                  {item.isRead ? null : <span className="ml-2 inline-block h-2 w-2 rounded-full bg-sky-600" aria-hidden />}
                </p>
                <p className="text-sm text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-600">{item.message}</p>
                <p className="text-xs text-slate-500">
                  {item.module} · {ageLabel(item.createdAt)} · {notificationNextAction(item)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={href as never} className="btn-primary h-8 px-2 text-xs">
                  Open context
                </Link>
                {item.isRead ? null : (
                  <button type="button" className="btn-quiet h-8 px-2 text-xs" onClick={() => markRead.mutate(item.id)}>
                    Mark read
                  </button>
                )}
                {item.acknowledgedAt ? null : (
                  <button type="button" className="btn-quiet h-8 px-2 text-xs" onClick={() => acknowledge.mutate(item.id)}>
                    Acknowledge
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

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
          <button type="button" className="rounded-md border px-2 py-1 disabled:opacity-50" disabled={state.page <= 1} onClick={() => replaceState({ ...state, page: state.page - 1 })}>
            Previous
          </button>
          <button type="button" className="rounded-md border px-2 py-1 disabled:opacity-50" disabled={state.page >= (listQuery.data?.totalPages ?? 1)} onClick={() => replaceState({ ...state, page: state.page + 1 })}>
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
