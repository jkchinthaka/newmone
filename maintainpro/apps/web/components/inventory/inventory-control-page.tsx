"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Boxes, Database, Lock, Package, PackagePlus, Upload, Wrench, type LucideIcon } from "lucide-react";

import { ActiveFilterChips, JobsEmptyState, JobsLoadingSkeleton, JobsPagination, OperationalJobsHeader } from "@/components/operational";
import { DebouncedField } from "@/components/forms/debounced-field";
import { BarList, KpiCard, SectionCard } from "@/components/ui/dashboard";
import { PortalRowMenu } from "@/components/ui/portal-row-menu";
import { RefreshErrorBanner } from "@/components/ui/refresh-error-banner";
import { clampPage, listErrorPresentation } from "@/lib/list-query-state";
import { formatDateTime as lkDateTime } from "@/lib/localization";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useLiveRefresh } from "@/lib/live-data";
import { visibleTopUsedParts } from "@/lib/batch-3-presentation";
import { canReadInventoryAnalytics } from "@/lib/user-role";
import { workOrderRecordHref } from "@/lib/operational-deep-link";
import { formatEnumLabel, partRequestStatusLabel, priorityLabel } from "@/lib/display-labels";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";
import type { StatusTone } from "@/lib/dashboard-status";
import { canDoGoodsIn } from "@/lib/goods-in";
import { GoodsInDialog } from "./goods-in-dialog";
import { getTopUsedParts } from "./api";
import type { TopUsedPartPoint } from "./types";
import {
  INVENTORY_EMPTY,
  normalizePartRow,
  partsPageMeta,
  inventoryControlFromSearch,
  inventoryControlSearch,
  inventoryFreshnessLabel,
  inventoryNextAction,
  type InventoryControlState
} from "@/lib/inventory-control";

type PartRow = {
  id: string;
  name: string;
  partNumber: string;
  category?: string | null;
  erpCode?: string | null;
  quantityInStock?: number | null;
  reservedQuantity?: number | null;
  availableQuantity?: number | null;
  location?: string | null;
  supplier?: { id?: string; name?: string | null } | null;
  stockMovements?: Array<{ createdAt?: string; type?: string }>;
  updatedAt?: string | null;
};

type PartToIssue = {
  id: string;
  status: string;
  quantityToIssue: number;
  requestedAt?: string;
  part?: { id: string; name: string; partNumber: string; availableQuantity?: number | null } | null;
  workOrder?: { id: string; woNumber?: string | null; title?: string | null; priority?: string | null } | null;
  requestedBy?: string | null;
};

/** GET /inventory/parts-to-issue: @Roles(PART_REQUEST_ISSUE_ROLES) + part_requests.view. */
const PARTS_TO_ISSUE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER"]);

function canSeePartsToIssue(role: string | null, permissions: readonly string[]): boolean {
  if (!role || !PARTS_TO_ISSUE_ROLES.has(role)) return false;
  if (role === "SUPER_ADMIN" || role === "ADMIN" || permissions.length === 0) return true;
  return permissions.includes("part_requests.view");
}

/** Plain caption for the stock cards. */
const STOCK_CAPTION = "On hand = goods received (Goods in) minus parts issued to jobs. Available is on hand minus parts held for jobs.";

type Dashboard = {
  totalItems?: number;
  onHand?: number;
  reserved?: number;
  available?: number;
  outOfStock?: number;
  pendingImports?: number;
};

export function InventoryControlPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const roleName = extractRoleName({ role: user.role });
  const showPartsToIssue = canSeePartsToIssue(roleName, user.permissions);
  const [partsToIssue, setPartsToIssue] = useState<{ items: PartToIssue[]; total: number } | null>(null);
  const [partsToIssueError, setPartsToIssueError] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => inventoryControlFromSearch(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [draftQuery, setDraftQuery] = useState(state.q);
  const [rows, setRows] = useState<PartRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Array<{ id: string; type?: string; quantity?: number; createdAt?: string }> | null>(null);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Reloads started by automatic refresh keep the current rows on screen (no skeleton, no error swap).
  const silentReloadKey = useRef(-1);
  const partsLoadedForKey = useRef(-1);
  const [goodsInOpen, setGoodsInOpen] = useState(false);
  const [topUsed, setTopUsed] = useState<TopUsedPartPoint[] | null>(null);
  const [topUsedError, setTopUsedError] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  useLiveRefresh(() =>
    setReloadKey((value) => {
      silentReloadKey.current = value + 1;
      return value + 1;
    })
  );
  const errorMode = listErrorPresentation({ isError: Boolean(error), hasData: hasLoaded && rows.length > 0 });
  useEffect(() => setDraftQuery(state.q), [state.q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draftQuery.trim() === state.q) return;
      write({ ...state, q: draftQuery.trim(), page: 1 });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftQuery, state]);

  function write(next: InventoryControlState) {
    const query = inventoryControlSearch(next);
    router.replace((query ? `${pathname}?${query}` : pathname) as never);
  }

  useEffect(() => {
    if (!canReadInventoryAnalytics()) {
      setTopUsed(null);
      return;
    }
    let cancelled = false;
    setTopUsedError(false);
    void getTopUsedParts(8, 30)
      .then((rows) => {
        if (!cancelled) setTopUsed(visibleTopUsedParts(rows));
      })
      .catch(() => {
        // Say so instead of silently hiding the card; keep the last good chart if there was one.
        if (!cancelled) setTopUsedError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!showPartsToIssue) {
      setPartsToIssue(null);
      return;
    }
    const controller = new AbortController();
    setPartsToIssueError(null);
    void apiClient
      .get("/inventory/parts-to-issue", { signal: controller.signal, params: { limit: 10 } })
      .then((response) => {
        const payload = response.data?.data ?? {};
        setPartsToIssue({
          items: Array.isArray(payload.items) ? payload.items : [],
          total: Number(payload.total ?? 0)
        });
      })
      .catch((err) => {
        if (controller.signal.aborted || silentReloadKey.current === reloadKey) return;
        setPartsToIssue(null);
        setPartsToIssueError(getApiErrorMessage(err, "Parts to issue could not be loaded."));
      });
    return () => controller.abort();
  }, [showPartsToIssue, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setSummaryError(null);
    void apiClient.get("/inventory/dashboard", { signal: controller.signal }).then((response) => {
      setSummary(response.data?.data ?? null);
    }).catch((err) => {
      if (controller.signal.aborted || silentReloadKey.current === reloadKey) return;
      setSummary(null);
      setSummaryError(getApiErrorMessage(err, "Inventory summary could not be loaded."));
    });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    const silent = silentReloadKey.current === reloadKey && partsLoadedForKey.current !== reloadKey;
    partsLoadedForKey.current = reloadKey;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    void apiClient.get("/inventory/parts", {
      signal: controller.signal,
      params: {
        page: state.page,
        pageSize: state.pageSize,
        q: state.q || undefined,
        category: state.category || undefined,
        supplierId: state.supplierId || undefined,
        location: state.location || undefined,
        mapped: state.mapped || undefined,
        stock: state.stock || undefined,
        sortBy: state.sortBy,
        sortDir: state.sortDir
      }
    }).then((response) => {
      const payload = response.data?.data ?? {};
      const items: PartRow[] = Array.isArray(payload.items) ? payload.items.map(normalizePartRow) : [];
      setRows(items);
      setMeta(partsPageMeta(response.data, state.page, state.pageSize, items.length));
      setHasLoaded(true);
      if (silent) setError(null);
    }).catch((err) => {
      if (!controller.signal.aborted && !silent) setError(getApiErrorMessage(err, "Unable to load inventory."));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [state.q, state.stock, state.category, state.supplierId, state.location, state.mapped, state.sortBy, state.sortDir, state.page, state.pageSize, reloadKey]);

  // ?page= past the last page (old link, filter shrank the list) jumps back to the last real page.
  useEffect(() => {
    if (loading || error) return;
    const clamped = clampPage(state.page, meta.total, state.pageSize);
    if (clamped !== state.page) write({ ...state, page: clamped });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, meta.total, state.page, state.pageSize]);

  const selected = rows.find((row) => row.id === state.partId) ?? null;

  useEffect(() => {
    if (state.partId) document.getElementById("inventory-detail")?.scrollIntoView({ block: "nearest" });
  }, [state.partId]);

  async function loadMovements(id: string) {
    // Movement history has its own error: a failure here must not replace the parts table.
    setMovementsError(null);
    try {
      const response = await apiClient.get(`/inventory/parts/${id}/movements`);
      const payload = response.data?.data;
      setMovements(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setMovements(null);
      setMovementsError(getApiErrorMessage(err, "Unable to load movement history."));
    }
  }

  function exportPage() {
    const header = "Part,Code,ERP code,On hand,Reserved,Available,Location";
    const lines = rows.map((row) => [row.name, row.partNumber, row.erpCode ?? "", row.quantityInStock ?? "", row.reservedQuantity ?? "", row.availableQuantity ?? "", row.location ?? ""].join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "inventory-page.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const chips = [
    state.q ? { key: "q", label: `Search: ${state.q}` } : null,
    state.stock ? { key: "stock", label: "Out of stock" } : null,
    state.category ? { key: "category", label: state.category } : null,
    state.supplierId ? { key: "supplierId", label: "Supplier" } : null,
    state.location ? { key: "location", label: state.location } : null,
    state.mapped ? { key: "mapped", label: state.mapped === "yes" ? "ERP mapped" : "Unmapped" } : null
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  return (
    <div className="space-y-4">
      <OperationalJobsHeader
        eyebrow="Inventory"
        title="Spare Parts"
        description="Receive stock with Goods in. Issue parts from the job's Parts tab."
        actions={
          <>
            {canDoGoodsIn(roleName) ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
                onClick={() => setGoodsInOpen(true)}
              >
                <PackagePlus size={16} aria-hidden /> Goods in
              </button>
            ) : null}
            <button type="button" className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" onClick={() => setReloadKey((value) => value + 1)}>Refresh</button>
            <button type="button" className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" onClick={exportPage}>Export page</button>
            <button type="button" className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" aria-expanded={more} onClick={() => setMore((value) => !value)}>More filters</button>
          </>
        }
      />
      {summaryError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          <p className="text-sm text-rose-800">{summaryError}</p>
          <button type="button" className="min-h-11 rounded-md border border-rose-300 bg-white px-3 text-sm" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Inventory summary">
            {(
              [
                ["Total parts", summary?.totalItems, Package, "neutral"],
                ["On hand", summary?.onHand, Database, "sky"],
                ["Reserved", summary?.reserved, Lock, "amber"],
                ["Available", summary?.available, Boxes, "emerald"],
                ["Out of stock", summary?.outOfStock, AlertTriangle, "red"],
                ["Pending imports", summary?.pendingImports, Upload, "neutral"]
              ] as Array<[string, number | undefined, LucideIcon, StatusTone]>
            ).map(([label, value, Icon, tone]) => (
              <KpiCard
                key={label}
                compact
                icon={Icon}
                label={label}
                tone={typeof value === "number" && value > 0 ? tone : "neutral"}
                value={value == null ? "–" : String(value)}
              />
            ))}
          </div>
          <p className="text-sm text-slate-600">{STOCK_CAPTION}</p>
        </>
      )}
      {showPartsToIssue ? (
        <SectionCard
          title={partsToIssue && partsToIssue.total > 0 ? `Parts to issue (${partsToIssue.total})` : "Parts to issue"}
          description="Approved part requests waiting for stores. Open the job to issue the parts."
        >
          {partsToIssueError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-rose-800">{partsToIssueError}</p>
              <button type="button" className="min-h-11 rounded-md border border-rose-300 bg-white px-3 text-sm" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
            </div>
          ) : !partsToIssue ? (
            <p className="text-sm text-slate-600">Loading parts to issue…</p>
          ) : partsToIssue.items.length === 0 ? (
            <p className="text-sm text-slate-600">Nothing to issue right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100" aria-label="Parts to issue">
              {partsToIssue.items.map((row) => (
                <li key={row.id}>
                  <Link
                    href={(row.workOrder?.id ? workOrderRecordHref(row.workOrder.id, "parts") : "/work-orders") as never}
                    className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2 text-sm hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium text-slate-900">
                        <Wrench aria-hidden size={14} className="shrink-0 text-slate-500" />
                        {row.part?.name ?? "Part"} × {row.quantityToIssue}
                      </span>
                      <span className="block text-xs text-slate-600">
                        {[row.workOrder?.woNumber, row.workOrder?.title].filter(Boolean).join(" · ") || "Job"}
                        {row.requestedBy ? ` · for ${row.requestedBy}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-slate-600">
                      {partRequestStatusLabel(row.status)}
                      {row.workOrder?.priority ? ` · ${priorityLabel(row.workOrder.priority)}` : ""}
                      {typeof row.part?.availableQuantity === "number" ? ` · ${row.part.availableQuantity} available` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {partsToIssue && partsToIssue.total > partsToIssue.items.length ? (
            <p className="mt-2 text-xs text-slate-500">Showing the oldest {partsToIssue.items.length} of {partsToIssue.total}.</p>
          ) : null}
        </SectionCard>
      ) : null}
      {topUsedError && !topUsed ? (
        <RefreshErrorBanner message="Most used parts could not be loaded." onRetry={() => setReloadKey((value) => value + 1)} />
      ) : null}
      {topUsed ? (
        <SectionCard title="Most used parts (30 days)" description="Units issued">
          {topUsedError ? <p className="mb-2 text-xs text-amber-800">Could not refresh. Showing the last loaded chart.</p> : null}
          <BarList items={topUsed.map((row) => ({ name: row.partName, value: row.quantity }))} />
        </SectionCard>
      ) : null}
      <div className="flex flex-wrap gap-3 text-sm">
        <button type="button" className="text-brand-800" onClick={() => write({ ...inventoryControlFromSearch(new URLSearchParams()), stock: "out", pageSize: state.pageSize })}>Show out of stock</button>
        <Link href={"/inventory/erp-import" as never} className="text-brand-800">Pending imports</Link>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <label className="sr-only" htmlFor="inventory-search">Search parts</label>
          <input id="inventory-search" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Part name, code, or ERP code" className="min-h-11 min-w-48 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
          <select aria-label="Stock" value={state.stock} onChange={(event) => write({ ...state, stock: event.target.value as InventoryControlState["stock"], page: 1 })} className="min-h-11 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">Any stock</option>
            <option value="out">Out of stock</option>
          </select>
          <select aria-label="Sort" value={`${state.sortBy}:${state.sortDir}`} onChange={(event) => {
            const [sortBy, sortDir] = event.target.value.split(":");
            write({ ...state, sortBy: sortBy as InventoryControlState["sortBy"], sortDir: sortDir === "asc" ? "asc" : "desc", page: 1 });
          }} className="min-h-11 rounded-md border border-slate-300 px-2 text-sm">
            <option value="updatedAt:desc">Recently updated</option>
            <option value="name:asc">Name</option>
            <option value="partNumber:asc">Part code</option>
            <option value="quantityInStock:asc">On hand, low to high</option>
          </select>
          <button type="button" className="min-h-11 px-2 text-sm" onClick={() => write({ ...inventoryControlFromSearch(new URLSearchParams()), partId: state.partId })}>Clear</button>
        </div>
        {more ? (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 px-3 py-2">
            {/* Debounced: typing a category/location sends one request after a pause, not one per key. */}
            <label className="flex items-center gap-2 text-sm">Category
              <DebouncedField label="Category" placeholder="Any category" value={state.category} onCommit={(category) => write({ ...stateRef.current, category, page: 1 })} className="min-h-11 rounded-md border border-slate-300 px-2" />
            </label>
            <label className="flex items-center gap-2 text-sm">Location
              <DebouncedField label="Location" placeholder="Any location" value={state.location} onCommit={(location) => write({ ...stateRef.current, location, page: 1 })} className="min-h-11 rounded-md border border-slate-300 px-2" />
            </label>
            <label className="text-sm">Mapping
              <select aria-label="ERP mapping" value={state.mapped} onChange={(event) => write({ ...state, mapped: event.target.value as InventoryControlState["mapped"], page: 1 })} className="ml-2 min-h-11 rounded-md border border-slate-300 px-2">
                <option value="">Any</option>
                <option value="yes">Mapped</option>
                <option value="no">Unmapped</option>
              </select>
            </label>
          </div>
        ) : null}
        <ActiveFilterChips chips={chips} onRemove={(key) => write({ ...state, [key]: "", page: 1 })} onClearAll={() => write({ ...inventoryControlFromSearch(new URLSearchParams()), partId: state.partId })} />
        {loading && !hasLoaded ? <JobsLoadingSkeleton label="Loading inventory" /> : null}
        {errorMode === "full" ? <div className="px-4 py-8 text-center text-sm"><p>{error}</p><button type="button" className="mt-2 min-h-11 font-medium text-brand-700" onClick={() => setReloadKey((value) => value + 1)}>Retry</button></div> : null}
        {errorMode === "banner" ? (
          <div className="px-3 pt-3">
            <RefreshErrorBanner message={`${error} Showing the last loaded parts.`} onRetry={() => setReloadKey((value) => value + 1)} retrying={loading} />
          </div>
        ) : null}
        {hasLoaded && !loading && !error && rows.length === 0 ? <JobsEmptyState title={INVENTORY_EMPTY} /> : null}
        {hasLoaded && errorMode !== "full" && rows.length > 0 ? (
          <div className={loading ? "opacity-60 transition-opacity" : undefined} aria-busy={loading}>
          <ul className="space-y-2 p-3 md:hidden">
            {rows.map((row) => {
              const last = row.stockMovements?.[0]?.createdAt ?? null;
              const action = inventoryNextAction({ erpCode: row.erpCode, quantityInStock: row.quantityInStock, lastMovementAt: last });
              return (
                <li key={row.id}>
                  <article className={`rounded-lg border p-3 ${row.id === state.partId ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"}`}>
                    <button type="button" className="min-h-11 text-left font-medium text-slate-900" onClick={() => write({ ...state, partId: row.id })}>{row.name}</button>
                    <p className="text-xs text-slate-500">{row.partNumber}</p>
                    <p className="mt-1 text-xs text-slate-600">On hand {row.quantityInStock ?? 0} · Reserved {row.reservedQuantity ?? 0} · Available {row.availableQuantity ?? 0}</p>
                    <p className="mt-1 text-xs text-slate-500">{inventoryFreshnessLabel({ updatedAt: row.updatedAt, lastMovementAt: last })}</p>
                    <p className="mt-1 text-sm text-slate-700">{action}</p>
                    <button type="button" className="mt-2 text-sm text-brand-800" onClick={() => { write({ ...state, partId: row.id }); void loadMovements(row.id); }}>View usage</button>
                  </article>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Part</th>
                  <th className="px-3 py-2">ERP</th>
                  <th className="px-3 py-2">On hand</th>
                  <th className="hidden px-3 py-2 md:table-cell">Reserved</th>
                  <th className="hidden px-3 py-2 md:table-cell">Available</th>
                  <th className="px-3 py-2">Next</th>
                  <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const last = row.stockMovements?.[0]?.createdAt ?? null;
                  const action = inventoryNextAction({ erpCode: row.erpCode, quantityInStock: row.quantityInStock, lastMovementAt: last });
                  return (
                    <tr key={row.id} aria-selected={row.id === state.partId} className={`border-t border-slate-100 ${row.id === state.partId ? "bg-brand-50" : ""}`}>
                      <td className="px-3 py-2">
                        <button type="button" className="font-medium text-slate-900" onClick={() => write({ ...state, partId: row.id })}>{row.name}</button>
                        <p className="text-xs text-slate-500">{row.partNumber}</p>
                        <p className="text-xs text-slate-500">{inventoryFreshnessLabel({ updatedAt: row.updatedAt, lastMovementAt: last })}</p>
                      </td>
                      <td className="px-3 py-2">{row.erpCode?.trim() ? row.erpCode : "Unmapped"}</td>
                      <td className="px-3 py-2">{row.quantityInStock ?? 0}</td>
                      <td className="hidden px-3 py-2 md:table-cell">{row.reservedQuantity ?? 0}</td>
                      <td className="hidden px-3 py-2 md:table-cell">{row.availableQuantity ?? 0}</td>
                      <td className={`px-3 py-2 ${action === "Ready" ? "text-slate-600" : "font-medium"}`}>{action}</td>
                      <td className="px-3 py-2">
                        {/* Portal menu: the table's overflow-x-auto wrapper can no longer clip it. */}
                        <PortalRowMenu
                          label={`Actions for ${row.partNumber}`}
                          open={menuId === row.id}
                          onOpenChange={(open) => setMenuId(open ? row.id : null)}
                          items={[
                            { label: "Open", onSelect: () => write({ ...state, partId: row.id }) },
                            { label: "View usage", onSelect: () => { write({ ...state, partId: row.id }); void loadMovements(row.id); } },
                            { label: "View mapping", href: "/maintenance-supply" }
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        ) : null}
        {hasLoaded && errorMode !== "full" ? <JobsPagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={state.pageSize} onPageChange={(page) => write({ ...state, page })} onPageSizeChange={(pageSize) => write({ ...state, pageSize, page: 1 })} /> : null}
      </section>
      {selected ? (
        <section id="inventory-detail" className="rounded-lg border border-slate-200 bg-white p-4 text-sm" aria-live="polite">
          <h2 className="font-semibold">{selected.name}</h2>
          <p className="text-slate-600">{selected.partNumber} · {selected.erpCode?.trim() ? `ERP ${selected.erpCode}` : "Unmapped"} · {selected.supplier?.name || "No supplier"} · {selected.location || "No location"}</p>
          <p className="mt-2">On hand {selected.quantityInStock ?? 0}. Reserved {selected.reservedQuantity ?? 0}. Available {selected.availableQuantity ?? 0}. Reserved parts are held for jobs.</p>
          <p className="mt-1 text-slate-600">{inventoryFreshnessLabel({ updatedAt: selected.updatedAt, lastMovementAt: selected.stockMovements?.[0]?.createdAt ?? null })}</p>
          {movementsError ? (
            <div className="mt-2">
              <RefreshErrorBanner message={movementsError} onRetry={() => void loadMovements(selected.id)} />
            </div>
          ) : movements ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {movements.length === 0 ? <li>No movements loaded.</li> : movements.slice(0, 8).map((row) => <li key={row.id}>{formatEnumLabel(row.type)} · {row.quantity} · {lkDateTime(row.createdAt)}</li>)}
            </ul>
          ) : null}
        </section>
      ) : null}
      {goodsInOpen ? (
        <GoodsInDialog
          onClose={() => setGoodsInOpen(false)}
          onDone={() => {
            setGoodsInOpen(false);
            setReloadKey((value) => value + 1);
          }}
        />
      ) : null}
    </div>
  );
}
