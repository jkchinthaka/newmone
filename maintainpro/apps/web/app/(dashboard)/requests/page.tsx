"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, MoreHorizontal, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { extractRoleName } from "@/lib/role-redirect";
import {
  approveRequest,
  cancelRequest,
  convertRequestToWorkOrder,
  getMaintenanceRequestSummary,
  listMaintenanceRequests,
  requestMoreInformation,
  startRequestReview,
  type MaintenanceRequestListItem
} from "@/lib/maintenance-requests-api";

const TRIAGE_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "ASSET_MANAGER",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR"
]);

const REPORT_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "ASSET_MANAGER",
  "TECHNICIAN",
  "MECHANIC",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR",
  "DRIVER",
  "VIEWER"
]);

type View = "all" | "mine" | "triage";

function granted(role: string | null, permissions: string[], permission: string, roles: Set<string>) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  if (permissions.includes(permission)) return true;
  return permissions.length === 0 && role != null && roles.has(role);
}

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
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-800">
      {label}
    </span>
  );
}

export default function RequestsPage() {
  const user = useCurrentUser();
  const role = extractRoleName({ role: user.role });
  const permissions = user.permissions ?? [];
  const canTriage = granted(role, permissions, "maintenance_requests.triage", TRIAGE_ROLES);
  const canApprove = granted(role, permissions, "maintenance_requests.approve", TRIAGE_ROLES);
  const canConvert = granted(role, permissions, "maintenance_requests.convert", TRIAGE_ROLES);
  const canReport = granted(role, permissions, "maintenance_requests.create", REPORT_ROLES);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") as View) || "all";
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
  const [summary, setSummary] = useState({ open: 0, awaitingTriage: 0, highCritical: 0, converted: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

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
      const [result, counts] = await Promise.all([
        listMaintenanceRequests({
          view: undefined,
          mine: view === "mine" || undefined,
          triageQueue: view === "triage" || undefined,
          status: view === "triage" ? undefined : status || undefined,
          priority: priority || undefined,
          assetQuery: assetQuery || undefined,
          search: queryText || undefined,
          sortBy: view === "triage" ? undefined : sortBy,
          sortDirection: view === "triage" ? undefined : sortDirection,
          reporter: reporter || undefined,
          from: from || undefined,
          converted: converted === "" ? undefined : converted === "yes",
          page,
          limit
        }),
        getMaintenanceRequestSummary()
      ]);
      setItems(result.items);
      setTotal(Number(result.meta?.total ?? result.items.length));
      setSummary(counts);
    } catch (err) {
      setError(getApiErrorMessage(err, "We couldn't load maintenance requests."));
    } finally {
      setLoading(false);
    }
  }, [assetQuery, converted, from, page, priority, queryText, reporter, sortBy, sortDirection, status, view]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const fromRow = total === 0 ? 0 : (page - 1) * limit + 1;
  const toRow = Math.min(page * limit, total);
  const filtered = Boolean(queryText || status || priority || assetQuery || reporter || from || converted || view !== "all");

  const actionsFor = useMemo(() => {
    return (item: MaintenanceRequestListItem) => {
      const isOwner = item.reportedBy?.id === user.id;
      const actions: Array<{ id: string; label: string; href?: string; run?: () => Promise<void> }> = [
        { id: "view", label: "View Request", href: `/requests/${item.id}` }
      ];
      if (item.workOrder?.id) {
        actions.push({
          id: "wo",
          label: `View Work Order ${item.workOrder.woNumber}`,
          href: `/work-orders?wo=${item.workOrder.id}`
        });
      }
      if (canTriage && !isOwner && item.status === "NEW") {
        actions.push({
          id: "triage",
          label: "Start Triage",
          run: () => startRequestReview(item.id).then(() => undefined)
        });
      }
      if (canTriage && !isOwner && item.status === "UNDER_REVIEW") {
        actions.push({
          id: "info",
          label: "Request More Information",
          run: async () => {
            const question = window.prompt("What information do you need?");
            if (!question?.trim()) return;
            await requestMoreInformation(item.id, { question: question.trim() });
          }
        });
      }
      if (canApprove && !isOwner && item.status === "UNDER_REVIEW") {
        actions.push({
          id: "approve",
          label: "Approve",
          run: () => approveRequest(item.id).then(() => undefined)
        });
      }
      if (canConvert && !isOwner && item.status === "APPROVED" && !item.workOrderId) {
        actions.push({
          id: "convert",
          label: "Convert to Work Order",
          run: () => convertRequestToWorkOrder(item.id).then(() => undefined)
        });
      }
      if (isOwner && ["NEW", "UNDER_REVIEW", "NEEDS_INFORMATION"].includes(item.status)) {
        actions.push({
          id: "cancel",
          label: "Cancel Request",
          run: async () => {
            const reason = window.prompt("Cancellation reason");
            if (!reason?.trim()) return;
            await cancelRequest(item.id, reason.trim());
          }
        });
      }
      return actions;
    };
  }, [canApprove, canConvert, canTriage, user.id]);

  async function runAction(item: MaintenanceRequestListItem, run: () => Promise<void>) {
    setMenuId(null);
    try {
      await run();
      toast.success(`${item.requestNumber} updated`);
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "That action could not be completed."));
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageBreadcrumbs />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Maintenance Requests</h1>
          <p className="mt-1 text-sm text-slate-600">
            Report and triage maintenance issues before work order creation.
          </p>
        </div>
        {canReport ? (
          <Link
            href={"/requests/new" as Route}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} aria-hidden /> Report Issue
          </Link>
        ) : null}
      </header>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Request indicators">
        {[
          ["Open Requests", summary.open],
          ["Awaiting Triage", summary.awaitingTriage],
          ["High / Critical", summary.highCritical],
          ["Converted", summary.converted]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Quick views">
        {(
          [
            ["all", "All Requests"],
            ["mine", "My Requests"],
            ...(canTriage ? [["triage", "Triage Queue"] as const] : [])
          ] as Array<[View, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={`min-h-11 rounded-lg px-3 text-sm font-medium ${
              view === id ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => writeQuery({ view: id === "all" ? null : id })}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.7fr))_auto]">
          <label className="relative block">
            <span className="sr-only">Search requests</span>
            <Search aria-hidden size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Search request ID, issue, asset or location..."
              className="min-h-11 w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <select
            aria-label="Status"
            className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm"
            value={status}
            disabled={view === "triage"}
            onChange={(event) => writeQuery({ status: event.target.value || null })}
          >
            <option value="">Status</option>
            <option value="NEW">New</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="NEEDS_INFORMATION">Needs Information</option>
            <option value="APPROVED">Approved</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="CONVERTED_TO_WO">Converted to Work Order</option>
          </select>
          <select
            aria-label="Priority"
            className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm"
            value={priority}
            onChange={(event) => writeQuery({ priority: event.target.value || null })}
          >
            <option value="">Priority</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <input
            aria-label="Asset"
            value={assetQuery}
            onChange={(event) => writeQuery({ asset: event.target.value || null })}
            placeholder="Asset"
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <button
            type="button"
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
            onClick={() => setAdvanced((current) => !current)}
          >
            Advanced Filters
          </button>
        </div>
        {advanced ? (
          <div className="grid gap-2 md:grid-cols-3">
            <input
              aria-label="Reported by"
              value={reporter}
              onChange={(event) => writeQuery({ reporter: event.target.value || null })}
              placeholder="Reported by"
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <input
              aria-label="Reported from"
              type="date"
              value={from}
              onChange={(event) => writeQuery({ from: event.target.value || null })}
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <select
              aria-label="Conversion"
              className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm"
              value={converted}
              onChange={(event) => writeQuery({ converted: event.target.value || null })}
            >
              <option value="">Converted / Not converted</option>
              <option value="yes">Converted</option>
              <option value="no">Not converted</option>
            </select>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <p>
            {total} request{total === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
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
            {filtered ? (
              <button
                type="button"
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
                onClick={() => {
                  setDraftQuery("");
                  router.replace(pathname as Route);
                }}
              >
                Clear Filters
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <ErrorState
          title="We couldn't load maintenance requests."
          description={error}
          onRetry={() => void refresh()}
          retryLabel="Retry"
        />
      ) : null}

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          <p className="sr-only">Loading requests</p>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
          <p className="font-medium text-slate-900">
            {filtered ? "No requests match these filters." : "No maintenance requests yet."}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {filtered
              ? "Try a different search or clear the current filters."
              : "Report an issue to start the maintenance workflow."}
          </p>
          {filtered ? (
            <button
              type="button"
              className="mt-4 min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
              onClick={() => {
                setDraftQuery("");
                router.replace(pathname as Route);
              }}
            >
              Clear Filters
            </button>
          ) : canReport ? (
            <Link href={"/requests/new" as Route} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">
              Report Issue
            </Link>
          ) : null}
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <div className="space-y-2 md:hidden">
            {items.map((item) => {
              const place = subject(item);
              return (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => router.push(`/requests/${item.id}` as Route)}
                  >
                    <p className="font-semibold text-slate-900">{item.requestNumber}</p>
                    <p className="line-clamp-1 text-sm text-slate-700">{item.description}</p>
                    <p className="mt-2 text-sm text-slate-800">{place.title}</p>
                    {place.code ? <p className="text-xs text-slate-500">{place.code}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge label={item.statusLabel} />
                    </div>
                  </button>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500" title={new Date(item.reportedAt).toLocaleString()}>
                      Reported {formatReported(item.reportedAt)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Actions for ${item.requestNumber}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200"
                      onClick={() => setMenuId((current) => (current === item.id ? null : item.id))}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  {menuId === item.id ? (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 py-1">
                      {actionsFor(item).map((action) =>
                        action.href ? (
                          <Link key={action.id} href={action.href as Route} className="block px-3 py-2 text-sm">
                            {action.label}
                          </Link>
                        ) : (
                          <button
                            key={action.id}
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm"
                            onClick={() => action.run && void runAction(item, action.run)}
                          >
                            {action.label}
                          </button>
                        )
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Request</th>
                  <th className="px-3 py-2">Asset / Location</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Reporter</th>
                  <th className="px-3 py-2">Reported</th>
                  <th className="px-3 py-2">Actions</th>
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
                        <div className="font-semibold text-slate-900">{item.requestNumber}</div>
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
                        <StatusBadge label={item.statusLabel} />
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
                      <td className="relative px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          aria-label={`Actions for ${item.requestNumber}`}
                          aria-expanded={menuId === item.id}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200"
                          onClick={() => setMenuId((current) => (current === item.id ? null : item.id))}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {menuId === item.id ? (
                          <div className="absolute right-3 z-10 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                            {actionsFor(item).map((action) =>
                              action.href ? (
                                <Link
                                  key={action.id}
                                  href={action.href as Route}
                                  className="block px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                                  onClick={() => setMenuId(null)}
                                >
                                  {action.label}
                                </Link>
                              ) : (
                                <button
                                  key={action.id}
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                                  onClick={() => action.run && void runAction(item, action.run)}
                                >
                                  {action.label}
                                </button>
                              )
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <p>
              Showing {fromRow}–{toRow} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => writeQuery({ page: page - 1 <= 1 ? null : String(page - 1) }, false)}
              >
                Previous
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => writeQuery({ page: String(page + 1) }, false)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
