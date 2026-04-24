"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Filter,
  Search,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

import { useNotificationsSocket } from "@/hooks/use-notifications-socket";
import { apiClient } from "@/lib/api-client";

type ApiEnvelope<T> = {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  message?: string;
};

type NotificationPriority = "INFO" | "WARNING" | "CRITICAL";
type NotificationStatus = "ALL" | "READ" | "UNREAD";
type NotificationActionType = "ACKNOWLEDGE" | "SCHEDULE_TASK" | "CREATE_WORK_ORDER" | "ASSIGN_USER";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: NotificationPriority;
  module: string;
  isRead: boolean;
  readAt: string | null;
  acknowledgedAt: string | null;
  dueAt: string | null;
  createdAt: string;
  deepLink: string;
  preview: string;
  overdue: boolean;
  actions: Array<{ key: NotificationActionType; label: string }>;
};

type NotificationAnalytics = {
  total: number;
  moduleTotals: Record<string, number>;
  typeTotals: Record<string, number>;
  priorityTotals: Record<string, number>;
  mostFrequentAlerts: Array<{ type: string; count: number }>;
  averageResponseMinutes: number | null;
};

type DailySummary = {
  text: string;
  todayTotal: number;
  overdueOpen: number;
  critical: number;
  recommendations: string[];
};

type NotificationListData = {
  items: NotificationItem[];
  analytics: NotificationAnalytics | null;
  dailySummary: DailySummary | null;
};

type NotificationPreferences = {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
};

type NotificationRules = {
  mutedTypes: string[];
  onlyCritical: boolean;
  emailOnlyOverdue: boolean;
};

type NotificationExplanation = {
  whatHappened: string;
  whyItMatters: string;
  recommendedActions: string[];
  priority: NotificationPriority;
  module: string;
};

const PRIORITY_OPTIONS: NotificationPriority[] = ["INFO", "WARNING", "CRITICAL"];
const TYPE_OPTIONS = [
  "MAINTENANCE_DUE",
  "WORK_ORDER_ASSIGNED",
  "WORK_ORDER_UPDATED",
  "LOW_STOCK",
  "VEHICLE_SERVICE_DUE",
  "LICENSE_EXPIRY",
  "INSURANCE_EXPIRY",
  "UTILITY_BILL_DUE",
  "SLA_BREACH_WARNING",
  "SYSTEM_ALERT",
  "CLEANING_VISIT_SUBMITTED",
  "CLEANING_SIGN_OFF",
  "CLEANING_REJECTED",
  "FACILITY_ISSUE_REPORTED",
  "CLEANING_MISSED",
  "CLEANING_LATE_VISIT",
  "CLEANING_HIGH_ISSUE",
  "CLEANING_SLA_BREACH"
] as const;

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (char) => char.toUpperCase());
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const candidate = error as {
      response?: {
        data?: {
          message?: string | string[];
        };
      };
      message?: string;
    };

    const apiMessage = candidate.response?.data?.message;
    if (Array.isArray(apiMessage) && apiMessage.length > 0) {
      return String(apiMessage[0]);
    }
    if (typeof apiMessage === "string" && apiMessage.trim()) {
      return apiMessage;
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
  }

  return fallback;
}

function getPriorityClass(priority: NotificationPriority) {
  if (priority === "CRITICAL") {
    return "bg-rose-100 text-rose-700 border-rose-200";
  }

  if (priority === "WARNING") {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }

  return "bg-sky-100 text-sky-700 border-sky-200";
}

function relativeTime(value: string | null) {
  if (!value) {
    return "No due date";
  }

  const target = new Date(value);
  const now = Date.now();
  const deltaMs = target.getTime() - now;
  const absMinutes = Math.round(Math.abs(deltaMs) / 60000);

  if (absMinutes < 1) {
    return deltaMs >= 0 ? "due now" : "just overdue";
  }

  if (absMinutes < 60) {
    return deltaMs >= 0 ? `due in ${absMinutes}m` : `${absMinutes}m overdue`;
  }

  const hours = Math.round(absMinutes / 60);
  if (hours < 24) {
    return deltaMs >= 0 ? `due in ${hours}h` : `${hours}h overdue`;
  }

  const days = Math.round(hours / 24);
  return deltaMs >= 0 ? `due in ${days}d` : `${days}d overdue`;
}

const UNREAD_QUERY_KEY = ["notifications", "unread-count"] as const;

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<NotificationStatus>("ALL");
  const [type, setType] = useState<string>("ALL");
  const [priority, setPriority] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [explanations, setExplanations] = useState<Record<string, NotificationExplanation>>({});

  const notificationsQuery = useQuery({
    queryKey: ["notifications", status, type, priority, search, page, pageSize],
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<NotificationListData>>("/notifications", {
        params: {
          status,
          type: type === "ALL" ? undefined : type,
          priority: priority === "ALL" ? undefined : priority,
          search: search || undefined,
          page,
          pageSize,
          includeAnalytics: true
        }
      });

      return {
        payload: response.data.data,
        pagination: {
          page: Number(response.data.meta?.page ?? 1),
          limit: Number(response.data.meta?.limit ?? pageSize),
          total: Number(response.data.meta?.total ?? 0),
          totalPages: Number(response.data.meta?.totalPages ?? 1)
        }
      };
    },
    placeholderData: (previousData) => previousData
  });

  const unreadCountQuery = useQuery({
    queryKey: UNREAD_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<NotificationListData>>("/notifications", {
        params: {
          status: "UNREAD",
          page: 1,
          pageSize: 1
        }
      });

      return Number(response.data.meta?.total ?? 0);
    },
    staleTime: 10_000
  });

  const preferencesQuery = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<NotificationPreferences>>("/notifications/preferences");
      return response.data.data;
    }
  });

  const rulesQuery = useQuery({
    queryKey: ["notifications", "rules"],
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<NotificationRules>>("/notifications/rules");
      return response.data.data;
    }
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to mark notification as read."));
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch("/notifications/mark-all-read");
    },
    onSuccess: () => {
      toast.success("All notifications marked as read.");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to mark all notifications as read."));
    }
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      action: NotificationActionType;
      body?: Record<string, unknown>;
    }) => {
      await apiClient.post(`/notifications/${payload.id}/actions`, {
        action: payload.action,
        payload: payload.body
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY });
      toast.success("Notification action applied.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to execute action."));
    }
  });

  const explainMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<ApiEnvelope<NotificationExplanation>>(
        `/notifications/${id}/explain`
      );
      return {
        id,
        data: response.data.data
      };
    },
    onSuccess: (result) => {
      setExplanations((current) => ({
        ...current,
        [result.id]: result.data
      }));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to generate explanation."));
    }
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (payload: Partial<NotificationPreferences>) => {
      await apiClient.patch("/notifications/preferences", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
      toast.success("Notification preferences updated.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to update preferences."));
    }
  });

  const updateRulesMutation = useMutation({
    mutationFn: async (payload: Partial<NotificationRules>) => {
      await apiClient.patch("/notifications/rules", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "rules"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification rules updated.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to update rules."));
    }
  });

  useNotificationsSocket((payload) => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY });
  });

  const notificationItems = notificationsQuery.data?.payload.items ?? [];
  const analytics = notificationsQuery.data?.payload.analytics;
  const dailySummary = notificationsQuery.data?.payload.dailySummary;
  const pagination = notificationsQuery.data?.pagination;

  const kpis = useMemo(
    () => ({
      unread: unreadCountQuery.data ?? 0,
      critical: analytics?.priorityTotals?.CRITICAL ?? 0,
      overdue: dailySummary?.overdueOpen ?? 0,
      avgResponse: analytics?.averageResponseMinutes
    }),
    [unreadCountQuery.data, analytics, dailySummary]
  );

  const isBusy =
    markReadMutation.isPending ||
    markAllReadMutation.isPending ||
    actionMutation.isPending ||
    explainMutation.isPending;

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleAction = (item: NotificationItem, action: NotificationActionType) => {
    if (action === "ASSIGN_USER") {
      const userId = window.prompt("Enter user ID to assign:", "");
      if (!userId) {
        return;
      }
      actionMutation.mutate({ id: item.id, action, body: { userId: userId.trim() } });
      return;
    }

    if (action === "SCHEDULE_TASK") {
      const dueDate = window.prompt("Optional due date (ISO format), e.g. 2026-05-02T15:00:00.000Z", "");
      actionMutation.mutate({
        id: item.id,
        action,
        body: dueDate && dueDate.trim() ? { dueDate: dueDate.trim() } : undefined
      });
      return;
    }

    actionMutation.mutate({ id: item.id, action });
  };

  return (
    <div className="space-y-5">
      <section className="card bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Notifications Control Center</h2>
            <p className="mt-1 text-sm text-slate-200">
              Real-time alerts, AI summaries, automated actions, and intelligent routing.
            </p>
          </div>
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCheck size={16} />
            Mark All Read
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="card space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Unread</p>
          <p className="text-2xl font-semibold text-slate-900">{kpis.unread}</p>
        </article>
        <article className="card space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Critical</p>
          <p className="text-2xl font-semibold text-rose-600">{kpis.critical}</p>
        </article>
        <article className="card space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Overdue</p>
          <p className="text-2xl font-semibold text-amber-600">{kpis.overdue}</p>
        </article>
        <article className="card space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Avg Response</p>
          <p className="text-2xl font-semibold text-slate-900">
            {typeof kpis.avgResponse === "number" ? `${kpis.avgResponse}m` : "-"}
          </p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="space-y-4">
          <form onSubmit={handleSearch} className="card space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Filter size={16} />
              Smart Filters
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs text-slate-500">Search</span>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <Search size={14} className="text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search titles and messages"
                    className="w-full bg-transparent text-sm text-slate-800 outline-none"
                  />
                </div>
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-500">Status</span>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as NotificationStatus);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="ALL">All</option>
                  <option value="UNREAD">Unread</option>
                  <option value="READ">Read</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-500">Priority</span>
                <select
                  value={priority}
                  onChange={(event) => {
                    setPriority(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="ALL">All priorities</option>
                  {PRIORITY_OPTIONS.map((entry) => (
                    <option key={entry} value={entry}>
                      {humanize(entry)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs text-slate-500">Type</span>
                <select
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="ALL">All types</option>
                  {TYPE_OPTIONS.map((entry) => (
                    <option key={entry} value={entry}>
                      {humanize(entry)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-500">Page Size</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </form>

          <div className="space-y-3">
            {notificationsQuery.isLoading ? (
              <article className="card">
                <p className="text-sm text-slate-500">Loading notifications...</p>
              </article>
            ) : notificationItems.length === 0 ? (
              <article className="card flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Bell size={22} className="text-slate-400" />
                <p className="text-sm font-medium text-slate-700">No notifications match your current filters.</p>
                <p className="text-xs text-slate-500">Try switching status, priority, or search terms.</p>
              </article>
            ) : (
              notificationItems.map((item) => (
                <article key={item.id} className="card space-y-3 border-l-4" style={{ borderLeftColor: item.priority === "CRITICAL" ? "#e11d48" : item.priority === "WARNING" ? "#f59e0b" : "#0ea5e9" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                        {!item.isRead ? (
                          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            New
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-600">{item.preview || item.message}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getPriorityClass(item.priority)}`}>
                        {humanize(item.priority)}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                        {humanize(item.module)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>Type: {humanize(item.type)}</span>
                    <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
                    <span className={item.overdue ? "font-semibold text-rose-600" : ""}>
                      {relativeTime(item.dueAt)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!item.isRead ? (
                      <button
                        onClick={() => markReadMutation.mutate(item.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CircleCheck size={14} />
                        Mark Read
                      </button>
                    ) : null}
                    {item.actions.map((action) => (
                      <button
                        key={`${item.id}-${action.key}`}
                        onClick={() => handleAction(item, action.key)}
                        disabled={isBusy}
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {action.label}
                      </button>
                    ))}
                    <button
                      onClick={() => explainMutation.mutate(item.id)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles size={14} />
                      Explain
                    </button>
                    <a
                      href={item.deepLink}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      Open Context
                    </a>
                  </div>

                  {explanations[item.id] ? (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-sm">
                      <p className="font-medium text-indigo-900">AI Context</p>
                      <p className="mt-1 text-indigo-800">{explanations[item.id].whatHappened}</p>
                      <p className="mt-1 text-indigo-700">{explanations[item.id].whyItMatters}</p>
                      {explanations[item.id].recommendedActions.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-indigo-800">
                          {explanations[item.id].recommendedActions.map((recommendation) => (
                            <li key={recommendation}>{recommendation}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>
              Page {pagination?.page ?? page} of {pagination?.totalPages ?? 1} ({pagination?.total ?? 0} alerts)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={(pagination?.page ?? page) <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={14} />
                Prev
              </button>
              <button
                onClick={() =>
                  setPage((current) =>
                    Math.min(pagination?.totalPages ?? current + 1, current + 1)
                  )
                }
                disabled={(pagination?.page ?? page) >= (pagination?.totalPages ?? 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <article className="card space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">AI Daily Brief</h3>
            {dailySummary ? (
              <>
                <p className="text-sm text-slate-700">{dailySummary.text}</p>
                <ul className="space-y-1 text-xs text-slate-600">
                  {dailySummary.recommendations.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <AlertCircle size={13} className="mt-0.5 text-slate-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-xs text-slate-500">No summary available.</p>
            )}
          </article>

          <article className="card space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Notification Preferences</h3>
            {preferencesQuery.isLoading ? (
              <p className="text-xs text-slate-500">Loading preferences...</p>
            ) : preferencesQuery.data ? (
              <div className="space-y-2">
                {Object.entries(preferencesQuery.data).map(([key, value]) => (
                  <label key={key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span>{humanize(key)}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      disabled={updatePreferencesMutation.isPending}
                      onChange={() =>
                        updatePreferencesMutation.mutate({
                          [key]: !value
                        } as Partial<NotificationPreferences>)
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Unable to load preferences.</p>
            )}
          </article>

          <article className="card space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Automation Rules</h3>
            {rulesQuery.data ? (
              <div className="space-y-3">
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>Only send critical alerts</span>
                  <input
                    type="checkbox"
                    checked={rulesQuery.data.onlyCritical}
                    disabled={updateRulesMutation.isPending}
                    onChange={() =>
                      updateRulesMutation.mutate({
                        onlyCritical: !rulesQuery.data?.onlyCritical
                      })
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>Email only overdue alerts</span>
                  <input
                    type="checkbox"
                    checked={rulesQuery.data.emailOnlyOverdue}
                    disabled={updateRulesMutation.isPending}
                    onChange={() =>
                      updateRulesMutation.mutate({
                        emailOnlyOverdue: !rulesQuery.data?.emailOnlyOverdue
                      })
                    }
                  />
                </label>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Muted Types</p>
                  <div className="mt-2 max-h-52 space-y-1 overflow-auto pr-1">
                    {TYPE_OPTIONS.map((entry) => {
                      const muted = rulesQuery.data.mutedTypes.includes(entry);
                      return (
                        <label key={entry} className="flex items-center justify-between py-1 text-xs text-slate-700">
                          <span>{humanize(entry)}</span>
                          <input
                            type="checkbox"
                            checked={muted}
                            disabled={updateRulesMutation.isPending}
                            onChange={() => {
                              const current = rulesQuery.data?.mutedTypes ?? [];
                              const next = muted
                                ? current.filter((item) => item !== entry)
                                : [...current, entry];

                              updateRulesMutation.mutate({ mutedTypes: next });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Unable to load automation rules.</p>
            )}
          </article>

          <article className="card space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">Alert Intelligence</h3>
            {analytics ? (
              <>
                <p className="text-xs text-slate-500">Top frequent alert types</p>
                <ul className="space-y-1 text-xs text-slate-700">
                  {analytics.mostFrequentAlerts.map((entry) => (
                    <li key={entry.type} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
                      <span>{humanize(entry.type)}</span>
                      <span className="font-semibold text-slate-800">{entry.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-xs text-slate-500">Analytics will appear as data accumulates.</p>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
