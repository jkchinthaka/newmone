"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DateField } from "@/components/forms/date-fields";
import { DebouncedField } from "@/components/forms/debounced-field";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ActiveFilterChips } from "@/components/operational/active-filter-chips";
import { JobsPagination } from "@/components/operational/jobs-pagination";
import { OperationalEmptyState, TableLoadingRows } from "@/components/operational/operational-list-states";
import { OperationalPageHeader } from "@/components/operational/operational-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatEnumLabel, priorityLabel } from "@/lib/display-labels";
import { formatDate, formatNumber } from "@/lib/localization";
import { listMaintenanceHistory, type MaintenanceHistoryRow } from "@/lib/maintenance-history-api";
import {
  MAINTENANCE_HISTORY_EMPTY,
  historyHasFilters,
  historyListParams,
  historyRecordHref,
  historyStateFromSearch
} from "@/lib/maintenance-history";

const CLEAR_PATCH = {
  q: null,
  scope: null,
  status: null,
  from: null,
  to: null,
  category: null,
  technician: null,
  vendor: null,
  priority: null,
  costMin: null,
  costMax: null,
  type: null,
  location: null
};

function statusLabel(status: string) {
  if (status === "COMPLETED") return "Completed";
  if (status === "CLOSED") return "Closed";
  if (status === "CANCELLED") return "Cancelled";
  return formatEnumLabel(status);
}

function formatWhen(value: string | null) {
  // Business dates are shown in Asia/Colombo, not the device time zone.
  return formatDate(value, { day: "2-digit", month: "short", year: "numeric" });
}

function formatCost(value: number | null) {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MaintenanceHistoryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const state = historyStateFromSearch(params);
  const [draft, setDraft] = useState(state.q);
  const [moreFilters, setMoreFilters] = useState(false);
  const [items, setItems] = useState<MaintenanceHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [includesCancelled, setIncludesCancelled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const write = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    const qs = next.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  };

  useEffect(() => {
    setDraft(state.q);
  }, [state.q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = draft.trim();
      if (next === state.q || next.length === 1) return;
      write({ q: next || null });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listMaintenanceHistory(historyListParams(state))
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.meta.total);
        setTotalPages(result.meta.totalPages);
        setIncludesCancelled(result.summary.includesCancelled);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "We couldn't load maintenance history."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params, retryToken]);

  const chips = [
    state.q ? { key: "q", label: state.q } : null,
    state.scope ? { key: "scope", label: state.scope === "asset" ? "Assets" : "Vehicles" } : null,
    state.status ? { key: "status", label: statusLabel(state.status) } : null,
    state.from || state.to ? { key: "from", label: `${state.from || "…"} – ${state.to || "…"}` } : null,
    state.category ? { key: "category", label: state.category } : null,
    state.technician ? { key: "technician", label: state.technician } : null,
    state.vendor ? { key: "vendor", label: state.vendor } : null,
    state.priority ? { key: "priority", label: priorityLabel(state.priority) } : null,
    state.costMin || state.costMax ? { key: "costMin", label: `Cost ${state.costMin || "0"}–${state.costMax || "…"}` } : null,
    state.type ? { key: "type", label: formatEnumLabel(state.type) } : null,
    state.location ? { key: "location", label: state.location } : null
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));

  const openRecord = (id: string) => {
    router.push(historyRecordHref(id) as Route);
  };

  return (
    <div className="min-w-0 space-y-3 p-4 md:p-6">
      <PageBreadcrumbs
        items={[
          { label: "Maintenance", href: "/maintenance" },
          { label: "History" }
        ]}
      />
      <OperationalPageHeader
        title="Maintenance History"
        description="Completed and closed work. Open a row for that job’s history. Cancelled jobs stay out of this list until you ask for them."
      />

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 p-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="WO, asset, vehicle, title, technician, or vendor"
            aria-label="Search maintenance history"
            className="h-10 min-w-[12rem] flex-1 rounded-md border border-slate-300 px-3 text-sm"
          />
          <select
            aria-label="Asset or vehicle"
            className="h-10 rounded-md border border-slate-300 px-2 text-sm"
            value={state.scope}
            onChange={(event) => write({ scope: event.target.value || null })}
          >
            <option value="">Asset / vehicle</option>
            <option value="asset">Assets</option>
            <option value="vehicle">Vehicles</option>
          </select>
          <DateField bare label="Completed from" value={state.from} onChange={(from) => write({ from: from || null })} />
          <DateField bare label="Completed to" value={state.to} onChange={(to) => write({ to: to || null })} />
          <select
            aria-label="Work order status"
            className="h-10 rounded-md border border-slate-300 px-2 text-sm"
            value={state.status}
            onChange={(event) => write({ status: event.target.value || null })}
          >
            <option value="">Completed and closed</option>
            <option value="COMPLETED">Completed</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <DebouncedField label="Category" placeholder="Category" value={state.category} onCommit={(value) => write({ category: value || null })} />
          <button
            type="button"
            className="h-10 px-2 text-sm font-medium"
            aria-expanded={moreFilters}
            onClick={() => setMoreFilters((open) => !open)}
          >
            More filters
          </button>
        </div>
        {moreFilters ? (
          <div className="grid gap-2 border-t border-slate-100 p-2 sm:grid-cols-2 lg:grid-cols-3">
            <DebouncedField label="Technician" placeholder="Technician" value={state.technician} onCommit={(value) => write({ technician: value || null })} />
            <DebouncedField label="Vendor" placeholder="Vendor" value={state.vendor} onCommit={(value) => write({ vendor: value || null })} />
            <select aria-label="Priority" className="h-10 rounded-md border px-2 text-sm" value={state.priority} onChange={(event) => write({ priority: event.target.value || null })}>
              <option value="">Priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <DebouncedField label="Minimum cost" placeholder="Min cost" inputMode="decimal" value={state.costMin} onCommit={(value) => write({ costMin: value || null })} />
            <DebouncedField label="Maximum cost" placeholder="Max cost" inputMode="decimal" value={state.costMax} onCommit={(value) => write({ costMax: value || null })} />
            <select aria-label="Maintenance type" className="h-10 rounded-md border px-2 text-sm" value={state.type} onChange={(event) => write({ type: event.target.value || null })}>
              <option value="">Maintenance type</option>
              <option value="CORRECTIVE">Corrective</option>
              <option value="PREVENTIVE">Preventive</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="INSPECTION">Inspection</option>
              <option value="ACCIDENT_REPAIR">Accident repair</option>
              <option value="INSTALLATION">Installation</option>
            </select>
            <DebouncedField label="Location or department" placeholder="Location or department" value={state.location} onCommit={(value) => write({ location: value || null })} />
          </div>
        ) : null}
        <ActiveFilterChips
          chips={chips}
          onRemove={(key) => {
            if (key === "from") write({ from: null, to: null });
            else if (key === "costMin") write({ costMin: null, costMax: null });
            else write({ [key]: null });
          }}
          onClearAll={() => write(CLEAR_PATCH)}
        />
        {includesCancelled ? (
          <p className="border-b border-slate-200 px-3 py-2 text-sm text-rose-800">
            Cancelled jobs are listed on their own. They are not counted as completed work.
          </p>
        ) : null}

        {error ? (
          <div className="p-4">
            <ErrorState title="We couldn't load maintenance history." description={error} onRetry={() => setRetryToken((value) => value + 1)} />
          </div>
        ) : loading ? (
          <TableLoadingRows label="Loading maintenance history" />
        ) : items.length === 0 ? (
          <OperationalEmptyState
            title={MAINTENANCE_HISTORY_EMPTY}
            onClear={historyHasFilters(state) ? () => write(CLEAR_PATCH) : undefined}
            onViewAll={() => write(CLEAR_PATCH)}
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-y border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">WO No</th>
                    <th className="px-3 py-2">Asset / vehicle</th>
                    <th className="px-3 py-2">Work performed</th>
                    <th className="hidden xl:table-cell px-3 py-2">Category</th>
                    <th className="px-3 py-2">Completed / closed</th>
                    <th className="hidden lg:table-cell px-3 py-2">Technician</th>
                    <th className="hidden lg:table-cell px-3 py-2">Cost</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const href = historyRecordHref(row.id);
                    return (
                      <tr
                        key={row.id}
                        tabIndex={0}
                        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
                        onClick={() => openRecord(row.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") openRecord(row.id);
                        }}
                      >
                        <td className="px-3 py-2 font-medium text-slate-900">{row.woNumber}</td>
                        <td className="px-3 py-2">
                          <div>{row.assetLabel}</div>
                          {row.assetCode && row.assetCode !== row.assetLabel ? (
                            <div className="text-xs text-slate-500">{row.assetCode}</div>
                          ) : null}
                        </td>
                        <td className="max-w-xs px-3 py-2">
                          <div className="truncate">{row.title}</div>
                          {row.vendor ? <div className="truncate text-xs text-slate-500">{row.vendor}</div> : null}
                        </td>
                        <td className="hidden xl:table-cell px-3 py-2 text-slate-600">{row.category}</td>
                        <td className="px-3 py-2 text-slate-700">{formatWhen(row.finalizedAt)}</td>
                        <td className="hidden lg:table-cell px-3 py-2 text-slate-700">{row.technician || "—"}</td>
                        <td className="hidden lg:table-cell px-3 py-2 text-slate-700">{formatCost(row.cost)}</td>
                        <td className={`px-3 py-2 ${row.status === "CANCELLED" ? "font-medium text-rose-800" : "text-slate-700"}`}>
                          {statusLabel(row.status)}
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={href as Route}
                            className="font-medium text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {items.map((row) => (
                <li key={row.id}>
                  <Link href={historyRecordHref(row.id) as Route} className="block px-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{row.woNumber}</p>
                        <p className="text-sm text-slate-700">{row.title}</p>
                        <p className="text-xs text-slate-500">{row.assetLabel}{row.assetCode && row.assetCode !== row.assetLabel ? ` · ${row.assetCode}` : ""}</p>
                      </div>
                      <p className={`text-sm ${row.status === "CANCELLED" ? "font-medium text-rose-800" : "text-slate-600"}`}>{statusLabel(row.status)}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{formatWhen(row.finalizedAt)}{row.technician ? ` · ${row.technician}` : ""}{row.cost != null ? ` · ${formatCost(row.cost)}` : ""}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <JobsPagination
              page={state.page}
              totalPages={Math.max(totalPages, 1)}
              total={total}
              pageSize={state.pageSize}
              onPageChange={(page) => write({ page: String(page) }, false)}
              onPageSizeChange={(pageSize) => write({ pageSize: String(pageSize) })}
            />
          </>
        )}
      </section>
    </div>
  );
}
