"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState } from "@/components/ui/page-state";
import { usePromptDialog } from "@/components/ui/use-prompt-dialog";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  approveRequest,
  cancelRequest,
  convertRequestToWorkOrder,
  getMaintenanceRequestSummary,
  listMaintenanceRequests,
  requestMoreInformation,
  startRequestReview,
  type MaintenanceRequestListItem,
  type MaintenanceRequestSummary
} from "@/lib/maintenance-requests-api";
import {
  isActionAllowed,
  isRequestStage,
  REQUEST_STAGE_LABELS,
  requestStageCards,
  requestStatusLabel,
  requestValueLabel
} from "@/lib/maintenance-request-ui";

type View = "all" | "mine" | "triage";

const EMPTY_SUMMARY: MaintenanceRequestSummary = { open: 0, awaitingTriage: 0, highCritical: 0, converted: 0 };

const STATUS_OPTIONS = [
  "NEW",
  "UNDER_REVIEW",
  "NEEDS_INFORMATION",
  "APPROVED",
  "CLOSED",
  "CANCELLED",
  "CONVERTED_TO_WO"
] as const;

const minLength = (value: string) =>
  value.trim().length < 3 ? "Please enter at least 3 characters." : null;

function formatReported(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
}

function subject(item: MaintenanceRequestListItem) {
  if (item.vehicle) {
    return { title: item.vehicle.name || item.vehicle.registrationNo, code: item.vehicle.registrationNo };
  }
  if (item.asset) return { title: item.asset.name, code: item.asset.assetTag };
  return {
    title: item.functionalLocation?.name || item.site?.name || item.approximateLocation || "Location only",
    code: item.functionalLocation?.code || item.site?.code || ""
  };
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "CRITICAL"
      ? "border-rose-300 bg-rose-50 text-rose-900"
      : priority === "HIGH"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : priority === "LOW"
          ? "border-slate-200 bg-slate-50 text-slate-700"
          : "border-sky-200 bg-sky-50 text-sky-900";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {priority === "CRITICAL" ? <AlertTriangle aria-hidden size={12} /> : null}
      {requestValueLabel(priority)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-800">
      {requestStatusLabel(status)}
    </span>
  );
}

type RowAction = { id: string; label: string; href?: string; run?: () => Promise<boolean> };

function ActionMenu({
  item,
  actions,
  open,
  onToggle,
  onClose,
  onRun
}: {
  item: MaintenanceRequestListItem;
  actions: RowAction[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onRun: (action: RowAction) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose]);

  const itemClass = "block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none";

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-label={`Actions for ${item.requestNumber}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-white"
        onClick={onToggle}
      >
        <MoreHorizontal size={16} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-60 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {actions.map((action) =>
            action.href ? (
              <Link key={action.id} role="menuitem" href={action.href as Route} className={itemClass} onClick={onClose}>
                {action.label}
              </Link>
            ) : (
              <button key={action.id} role="menuitem" type="button" className={itemClass} onClick={() => onRun(action)}>
                {action.label}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function RequestsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { prompt, dialog } = usePromptDialog();

  const rawView = searchParams.get("view");
  const view: View = rawView === "mine" || rawView === "triage" ? rawView : "all";
  const rawStage = searchParams.get("stage");
  const stage = isRequestStage(rawStage) ? rawStage : null;
  const status = searchParams.get("status") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const assetQuery = searchParams.get("asset") ?? "";
  const queryText = searchParams.get("q") ?? "";
  const sortBy = searchParams.get("sort") ?? "reportedAt";
  const sortDirection = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const reporter = searchParams.get("reporter") ?? "";
  const from = searchParams.get("from") ?? "";
  const converted = searchParams.get("converted") ?? "";

  const [draftQuery, setDraftQuery] = useState(queryText);
  const [advanced, setAdvanced] = useState(Boolean(reporter || from || converted));
  const [items, setItems] = useState<MaintenanceRequestListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<MaintenanceRequestSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const capabilities = summary.capabilities;
  const canReport = Boolean(capabilities?.canReport);
  const canTriage = Boolean(capabilities?.canTriage);
  const canViewAll = Boolean(capabilities?.canViewAll);
  const limit = 25;

  const writeQuery = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value) next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete("page");
      const qs = next.toString();
      router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
    },
    [pathname, router, searchParams]
  );

  const clearFilters = useCallback(() => {
    setDraftQuery("");
    // Keep the chosen view (All / My / Triage); clear everything else.
    router.replace((view === "all" ? pathname : `${pathname}?view=${view}`) as Route);
  }, [pathname, router, view]);

  useEffect(() => {
    setDraftQuery(queryText);
  }, [queryText]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draftQuery.trim() === queryText.trim()) return;
      writeQuery({ q: draftQuery.trim() || null });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draftQuery, queryText, writeQuery]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const triage = view === "triage";
      const [result, counts] = await Promise.all([
        listMaintenanceRequests({
          mine: view === "mine" || undefined,
          triageQueue: triage || undefined,
          stage: triage ? undefined : stage ?? undefined,
          status: triage || stage ? undefined : status || undefined,
          priority: priority || undefined,
          assetQuery: assetQuery || undefined,
          search: queryText || undefined,
          sortBy: triage ? undefined : sortBy,
          sortDirection: triage ? undefined : sortDirection,
          reporter: reporter || undefined,
          from: from || undefined,
          converted: converted === "" ? undefined : converted === "yes",
          page,
          limit
        }),
        getMaintenanceRequestSummary({ mine: view === "mine" })
      ]);
      setItems(result.items);
      setTotal(Number(result.meta?.total ?? result.items.length));
      setSummary(counts);
    } catch (err) {
      setError(getApiErrorMessage(err, "We couldn't load maintenance requests."));
    } finally {
      setLoading(false);
    }
  }, [assetQuery, converted, from, page, priority, queryText, reporter, sortBy, sortDirection, stage, status, view]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const fromRow = total === 0 ? 0 : (page - 1) * limit + 1;
  const toRow = Math.min(page * limit, total);

  const activeFilters: Array<{ key: string; label: string; clear: Record<string, null> }> = [];
  if (stage && view !== "triage") activeFilters.push({ key: "stage", label: REQUEST_STAGE_LABELS[stage], clear: { stage: null } });
  if (status && !stage && view !== "triage") activeFilters.push({ key: "status", label: `Status: ${requestStatusLabel(status)}`, clear: { status: null } });
  if (priority) activeFilters.push({ key: "priority", label: `Priority: ${requestValueLabel(priority)}`, clear: { priority: null } });
  if (assetQuery) activeFilters.push({ key: "asset", label: `Asset: ${assetQuery}`, clear: { asset: null } });
  if (queryText) activeFilters.push({ key: "q", label: `Search: ${queryText}`, clear: { q: null } });
  if (reporter) activeFilters.push({ key: "reporter", label: `Reported by: ${reporter}`, clear: { reporter: null } });
  if (from) activeFilters.push({ key: "from", label: `Reported from ${from}`, clear: { from: null } });
  if (converted) activeFilters.push({ key: "converted", label: converted === "yes" ? "Converted" : "Not converted", clear: { converted: null } });
  const filtered = activeFilters.length > 0;

  const actionsFor = (item: MaintenanceRequestListItem): RowAction[] => {
    const allowed = item.allowedActions;
    const actions: RowAction[] = [{ id: "view", label: "Open request", href: `/requests/${item.id}` }];
    if (item.workOrder?.id) {
      actions.push({
        id: "wo",
        label: `Open work order ${item.workOrder.woNumber}`,
        href: `/work-orders?wo=${item.workOrder.id}`
      });
    }
    if (isActionAllowed(allowed, "startReview")) {
      actions.push({
        id: "triage",
        label: "Start review",
        run: () => startRequestReview(item.id).then(() => true)
      });
    }
    if (isActionAllowed(allowed, "requestInformation")) {
      actions.push({
        id: "info",
        label: "Ask requester a question",
        run: async () => {
          const question = await prompt({
            title: `Ask about ${item.requestNumber}`,
            description: "The requester sees this question and can reply on the request.",
            label: "Question for the requester",
            submitLabel: "Send question",
            validate: minLength
          });
          if (!question) return false;
          await requestMoreInformation(item.id, { question: question.trim() });
          return true;
        }
      });
    }
    if (isActionAllowed(allowed, "approve")) {
      actions.push({ id: "approve", label: "Accept for work", run: () => approveRequest(item.id).then(() => true) });
    }
    if (isActionAllowed(allowed, "convert")) {
      actions.push({
        id: "convert",
        label: "Create work order",
        run: async () => {
          const result = await convertRequestToWorkOrder(item.id);
          if (result.workOrder?.woNumber) {
            toast.message(
              result.alreadyConverted
                ? `Already linked to ${result.workOrder.woNumber}`
                : `Created work order ${result.workOrder.woNumber}`
            );
          }
          return true;
        }
      });
    }
    if (isActionAllowed(allowed, "cancel")) {
      actions.push({
        id: "cancel",
        label: "Cancel request",
        run: async () => {
          const reason = await prompt({
            title: `Cancel ${item.requestNumber}?`,
            description: "Cancelled requests cannot be reopened.",
            label: "Cancellation reason",
            submitLabel: "Cancel request",
            cancelLabel: "Keep request",
            validate: minLength
          });
          if (!reason) return false;
          await cancelRequest(item.id, reason.trim());
          return true;
        }
      });
    }
    return actions;
  };

  async function runAction(item: MaintenanceRequestListItem, action: RowAction) {
    setMenuId(null);
    if (!action.run) return;
    try {
      const done = await action.run();
      if (!done) return;
      toast.success(`${item.requestNumber} updated`);
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "That action could not be completed."));
      await refresh();
    }
  }

  const closeMenu = useCallback(() => setMenuId(null), []);
  // Users who can only see their own requests get no view tabs: every view would be the same list.
  const views: Array<[View, string]> = canViewAll
    ? [
        ["all", "All requests"],
        ["mine", "My requests"],
        ...(canTriage ? [["triage", "Triage queue"] as [View, string]] : [])
      ]
    : [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageBreadcrumbs />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Maintenance Requests</h1>
          <p className="mt-1 text-sm text-slate-600">
            Report issues, then triage and accept them before a work order is created.
          </p>
        </div>
        {canReport ? (
          <Link
            href={"/requests/new" as Route}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} aria-hidden /> Report issue
          </Link>
        ) : null}
      </header>

      <section aria-labelledby="request-overview-heading" className="space-y-2">
        <h2 id="request-overview-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {summary.scope === "mine" ? "Overview of your requests" : "Overview of all requests"}
          <span className="font-normal normal-case tracking-normal"> · select a card to list those requests</span>
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {requestStageCards(summary).map((card) => {
            const active = stage === card.stage && view !== "triage";
            return (
              <button
                key={card.stage}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  writeQuery({
                    stage: active ? null : card.stage,
                    status: null,
                    view: view === "triage" ? null : view === "all" ? null : view
                  })
                }
                className={`rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  active ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</span>
                <span className="mt-1 block text-2xl font-semibold text-slate-900">{loading && !capabilities ? "–" : card.value}</span>
              </button>
            );
          })}
        </div>
      </section>

      {views.length > 1 ? (
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Request views">
        {views.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={`min-h-11 rounded-lg px-3 text-sm font-medium ${
              view === id ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => writeQuery({ view: id === "all" ? null : id, ...(id === "triage" ? { stage: null, status: null } : {}) })}
          >
            {label}
          </button>
        ))}
      </div>
      ) : null}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3" aria-label="Filters">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.7fr))_auto]">
          <label className="relative block">
            <span className="sr-only">Search requests</span>
            <Search aria-hidden size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Search request number, issue, asset or location..."
              className="min-h-11 w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <select
            aria-label="Status"
            className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            value={stage || view === "triage" ? "" : status}
            disabled={view === "triage"}
            title={view === "triage" ? "The triage queue always shows New, Under Review and Needs Information." : undefined}
            onChange={(event) => writeQuery({ status: event.target.value || null, stage: null })}
          >
            <option value="">{stage ? REQUEST_STAGE_LABELS[stage] : "Any status"}</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {requestStatusLabel(value)}
              </option>
            ))}
          </select>
          <select
            aria-label="Priority"
            className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm"
            value={priority}
            onChange={(event) => writeQuery({ priority: event.target.value || null })}
          >
            <option value="">Any priority</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <input
            aria-label="Asset, vehicle or location"
            value={assetQuery}
            onChange={(event) => writeQuery({ asset: event.target.value || null })}
            placeholder="Asset, vehicle or location"
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <button
            type="button"
            aria-expanded={advanced}
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
            onClick={() => setAdvanced((current) => !current)}
          >
            {advanced ? "Fewer filters" : "More filters"}
          </button>
        </div>
        {advanced ? (
          <div className="grid gap-2 md:grid-cols-3">
            <input
              aria-label="Reported by"
              value={reporter}
              onChange={(event) => writeQuery({ reporter: event.target.value || null })}
              placeholder="Reported by (name or email)"
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="whitespace-nowrap">Reported from</span>
              <input
                type="date"
                value={from}
                onChange={(event) => writeQuery({ from: event.target.value || null })}
                className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <select
              aria-label="Work order link"
              className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm"
              value={converted}
              onChange={(event) => writeQuery({ converted: event.target.value || null })}
            >
              <option value="">With or without a work order</option>
              <option value="yes">Has a work order</option>
              <option value="no">No work order yet</option>
            </select>
          </div>
        ) : null}

        {filtered ? (
          <ul className="flex flex-wrap gap-2" aria-label="Active filters">
            {activeFilters.map((filter) => (
              <li key={filter.key}>
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 text-xs font-medium text-brand-900"
                  onClick={() => {
                    if (filter.key === "q") setDraftQuery("");
                    writeQuery(filter.clear);
                  }}
                  aria-label={`Remove filter ${filter.label}`}
                >
                  {filter.label}
                  <X size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <p aria-live="polite">
            {loading ? "Loading…" : `${total} request${total === 1 ? "" : "s"}${filtered || view !== "all" ? " match this view" : ""}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {view !== "triage" ? (
              <label className="flex items-center gap-2">
                Sort
                <select
                  className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm"
                  value={`${sortBy}:${sortDirection}`}
                  onChange={(event) => {
                    const [sort, dir] = event.target.value.split(":");
                    writeQuery({ sort: sort === "reportedAt" ? null : sort, dir: dir === "desc" ? null : dir });
                  }}
                >
                  <option value="reportedAt:desc">Newest reported</option>
                  <option value="reportedAt:asc">Oldest reported</option>
                  <option value="priority:desc">Priority (urgent first)</option>
                  <option value="requestNumber:asc">Request number</option>
                  <option value="status:asc">Status</option>
                </select>
              </label>
            ) : (
              <span className="text-xs text-slate-500">Sorted critical first, then oldest</span>
            )}
            {filtered ? (
              <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <ErrorState title="We couldn't load maintenance requests." description={error} onRetry={() => void refresh()} retryLabel="Retry" />
      ) : null}

      {loading && items.length === 0 && !error ? (
        <div className="space-y-2" aria-busy="true">
          <p className="sr-only">Loading requests</p>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
          <p className="font-medium text-slate-900">
            {filtered ? "No requests match these filters." : view === "triage" ? "Nothing is waiting for triage." : "No maintenance requests yet."}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {filtered
              ? "Try a different search or clear the filters."
              : view === "triage"
                ? "New requests appear here as soon as they are reported."
                : canReport
                  ? "Report an issue to start the maintenance workflow."
                  : "Requests you are allowed to see will appear here."}
          </p>
          {filtered ? (
            <button type="button" className="mt-4 min-h-11 rounded-lg border border-slate-300 px-3 text-sm" onClick={clearFilters}>
              Clear filters
            </button>
          ) : canReport && view !== "triage" ? (
            <Link href={"/requests/new" as Route} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">
              Report issue
            </Link>
          ) : null}
        </div>
      ) : null}

      {items.length > 0 && !error ? (
        <div className={loading ? "opacity-60 transition-opacity" : undefined} aria-busy={loading}>
          <div className="space-y-2 md:hidden">
            {items.map((item) => {
              const place = subject(item);
              return (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <Link href={`/requests/${item.id}` as Route} className="block">
                    <p className="font-semibold text-slate-900">{item.requestNumber}</p>
                    <p className="line-clamp-1 text-sm text-slate-700">{item.description}</p>
                    <p className="mt-2 text-sm text-slate-800">{place.title}</p>
                    {place.code ? <p className="text-xs text-slate-500">{place.code}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                      {item.workOrder ? (
                        <span className="text-xs font-medium text-brand-700">{item.workOrder.woNumber}</span>
                      ) : null}
                    </div>
                  </Link>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500" title={new Date(item.reportedAt).toLocaleString()}>
                      Reported {formatReported(item.reportedAt)}
                      {item.reportedBy?.name ? ` by ${item.reportedBy.name}` : ""}
                    </span>
                    <ActionMenu
                      item={item}
                      actions={actionsFor(item)}
                      open={menuId === item.id}
                      onToggle={() => setMenuId((current) => (current === item.id ? null : item.id))}
                      onClose={closeMenu}
                      onRun={(action) => void runAction(item, action)}
                    />
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2">Request</th>
                  <th scope="col" className="px-3 py-2">Asset / Location</th>
                  <th scope="col" className="px-3 py-2">Priority</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">Reporter</th>
                  <th scope="col" className="px-3 py-2">Reported</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const place = subject(item);
                  return (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                      onClick={() => router.push(`/requests/${item.id}` as Route)}
                    >
                      <td className="px-3 py-3">
                        <Link
                          href={`/requests/${item.id}` as Route}
                          className="font-semibold text-slate-900 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {item.requestNumber}
                        </Link>
                        <div className="line-clamp-1 max-w-xs text-xs text-slate-500">{item.description}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{place.title}</div>
                        {place.code ? <div className="text-xs text-slate-500">{place.code}</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        <StatusBadge status={item.status} />
                        {item.workOrder ? (
                          <Link
                            href={`/work-orders?wo=${item.workOrder.id}` as Route}
                            className="mt-1 block text-xs font-medium text-brand-700 hover:underline"
                          >
                            {item.workOrder.woNumber} →
                          </Link>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">{item.reportedBy?.name || "—"}</td>
                      <td className="px-3 py-3 text-slate-600" title={new Date(item.reportedAt).toLocaleString()}>
                        {formatReported(item.reportedAt)}
                      </td>
                      <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                        <ActionMenu
                          item={item}
                          actions={actionsFor(item)}
                          open={menuId === item.id}
                          onToggle={() => setMenuId((current) => (current === item.id ? null : item.id))}
                          onClose={closeMenu}
                          onRun={(action) => void runAction(item, action)}
                            />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <nav className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600" aria-label="Pagination">
            <p>
              Showing {fromRow}–{toRow} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50"
                disabled={page <= 1 || loading}
                onClick={() => writeQuery({ page: page - 1 <= 1 ? null : String(page - 1) }, false)}
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50"
                disabled={page >= totalPages || loading}
                onClick={() => writeQuery({ page: String(page + 1) }, false)}
              >
                Next
              </button>
            </div>
          </nav>
        </div>
      ) : null}

      {dialog}
    </div>
  );
}
