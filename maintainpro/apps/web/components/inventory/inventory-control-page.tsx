"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ActiveFilterChips, JobsEmptyState, JobsLoadingSkeleton, JobsPagination, OperationalJobsHeader } from "@/components/operational";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  INVENTORY_EMPTY,
  inventoryControlFromSearch,
  inventoryControlSearch,
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
};

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => inventoryControlFromSearch(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [draftQuery, setDraftQuery] = useState(state.q);
  const [rows, setRows] = useState<PartRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Array<{ id: string; type?: string; quantity?: number; createdAt?: string }> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
    const controller = new AbortController();
    setSummaryError(null);
    void apiClient.get("/inventory/dashboard", { signal: controller.signal }).then((response) => {
      setSummary(response.data?.data ?? null);
    }).catch((err) => {
      if (controller.signal.aborted) return;
      setSummary(null);
      setSummaryError(getApiErrorMessage(err, "Inventory summary could not be loaded."));
    });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
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
      setRows(Array.isArray(payload.items) ? payload.items : []);
      setMeta(payload.pagination ?? { page: state.page, pageSize: state.pageSize, total: 0, totalPages: 1 });
    }).catch((err) => {
      if (!controller.signal.aborted) setError(getApiErrorMessage(err, "Unable to load inventory."));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [state.q, state.stock, state.category, state.supplierId, state.location, state.mapped, state.sortBy, state.sortDir, state.page, state.pageSize, reloadKey]);

  const selected = rows.find((row) => row.id === state.partId) ?? null;

  useEffect(() => {
    if (state.partId) document.getElementById("inventory-detail")?.scrollIntoView({ block: "nearest" });
  }, [state.partId]);

  async function loadMovements(id: string) {
    try {
      const response = await apiClient.get(`/inventory/parts/${id}/movements`);
      const payload = response.data?.data;
      setMovements(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setMovements([]);
      setError(getApiErrorMessage(err, "Unable to load movement history."));
    }
  }

  function exportPage() {
    const header = "Part,Code,ERP code,Snapshot,Reserved,Advisory,Location";
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
    state.stock ? { key: "stock", label: "Snapshot zero" } : null,
    state.category ? { key: "category", label: state.category } : null,
    state.supplierId ? { key: "supplierId", label: "Supplier" } : null,
    state.location ? { key: "location", label: state.location } : null,
    state.mapped ? { key: "mapped", label: state.mapped === "yes" ? "ERP mapped" : "Unmapped" } : null
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  return (
    <div className="space-y-4">
      <OperationalJobsHeader
        eyebrow="Inventory"
        title="Inventory Control Center"
        description="Maintenance parts visibility, ERP stock snapshot, reservations, and maintenance usage. Bileeta remains the stock authority."
        actions={
          <>
            <button type="button" className="h-9 rounded-md border border-slate-300 px-3 text-sm" onClick={() => setReloadKey((value) => value + 1)}>Refresh</button>
            <button type="button" className="h-9 rounded-md border border-slate-300 px-3 text-sm" onClick={exportPage}>Export page</button>
            <button type="button" className="h-9 rounded-md border border-slate-300 px-3 text-sm" aria-expanded={more} onClick={() => setMore((value) => !value)}>More filters</button>
          </>
        }
      />
      {summaryError ? (
        <p className="text-sm text-rose-700" role="alert">{summaryError}</p>
      ) : (
        <p className="text-sm text-slate-700" aria-label="Inventory summary">
          Total parts {summary?.totalItems ?? "–"} | ERP snapshot {summary?.onHand ?? "–"} | Reserved {summary?.reserved ?? "–"} | Advisory {summary?.available ?? "–"} | Snapshot zero {summary?.outOfStock ?? "–"} | Pending imports {summary?.pendingImports ?? "–"}
        </p>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <button type="button" className="text-brand-800" onClick={() => write({ ...inventoryControlFromSearch(new URLSearchParams()), stock: "out", pageSize: state.pageSize })}>Show snapshot zero</button>
        <Link href={"/inventory/erp-import" as never} className="text-brand-800">Pending imports</Link>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <label className="sr-only" htmlFor="inventory-search">Search parts</label>
          <input id="inventory-search" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Part name, code, or ERP code" className="h-9 min-w-48 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
          <select aria-label="Snapshot status" value={state.stock} onChange={(event) => write({ ...state, stock: event.target.value as InventoryControlState["stock"], page: 1 })} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">Snapshot</option>
            <option value="out">Zero</option>
          </select>
          <select aria-label="Sort" value={`${state.sortBy}:${state.sortDir}`} onChange={(event) => {
            const [sortBy, sortDir] = event.target.value.split(":");
            write({ ...state, sortBy: sortBy as InventoryControlState["sortBy"], sortDir: sortDir === "asc" ? "asc" : "desc", page: 1 });
          }} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
            <option value="updatedAt:desc">Recently updated</option>
            <option value="name:asc">Name</option>
            <option value="partNumber:asc">Part code</option>
            <option value="quantityInStock:asc">Snapshot low to high</option>
          </select>
          <button type="button" className="h-9 px-2 text-sm" onClick={() => write({ ...inventoryControlFromSearch(new URLSearchParams()), partId: state.partId })}>Clear</button>
        </div>
        {more ? (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 px-3 py-2">
            <label className="text-sm">Category
              <input value={state.category} onChange={(event) => write({ ...state, category: event.target.value, page: 1 })} className="ml-2 h-9 rounded-md border border-slate-300 px-2" />
            </label>
            <label className="text-sm">Location
              <input value={state.location} onChange={(event) => write({ ...state, location: event.target.value, page: 1 })} className="ml-2 h-9 rounded-md border border-slate-300 px-2" />
            </label>
            <label className="text-sm">Mapping
              <select aria-label="ERP mapping" value={state.mapped} onChange={(event) => write({ ...state, mapped: event.target.value as InventoryControlState["mapped"], page: 1 })} className="ml-2 h-9 rounded-md border border-slate-300 px-2">
                <option value="">Any</option>
                <option value="yes">Mapped</option>
                <option value="no">Unmapped</option>
              </select>
            </label>
          </div>
        ) : null}
        <ActiveFilterChips chips={chips} onRemove={(key) => write({ ...state, [key]: "", page: 1 })} onClearAll={() => write({ ...inventoryControlFromSearch(new URLSearchParams()), partId: state.partId })} />
        {loading ? <JobsLoadingSkeleton label="Loading inventory" /> : null}
        {!loading && error ? <div className="px-4 py-8 text-center text-sm"><p>{error}</p><button type="button" className="mt-2 font-medium text-brand-700" onClick={() => setReloadKey((value) => value + 1)}>Retry</button></div> : null}
        {!loading && !error && rows.length === 0 ? <JobsEmptyState title={INVENTORY_EMPTY} /> : null}
        {!loading && !error && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Part</th>
                  <th className="px-3 py-2">ERP</th>
                  <th className="px-3 py-2">Availability</th>
                  <th className="hidden px-3 py-2 md:table-cell">Reserved</th>
                  <th className="hidden px-3 py-2 lg:table-cell">Advisory</th>
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
                      </td>
                      <td className="px-3 py-2">{row.erpCode?.trim() ? row.erpCode : "Unmapped"}</td>
                      <td className="px-3 py-2">Snapshot {row.quantityInStock ?? 0}</td>
                      <td className="hidden px-3 py-2 md:table-cell">{row.reservedQuantity ?? 0}</td>
                      <td className="hidden px-3 py-2 lg:table-cell">{row.availableQuantity ?? 0}</td>
                      <td className={`px-3 py-2 ${action === "Ready" ? "text-slate-600" : "font-medium"}`}>{action}</td>
                      <td className="relative px-3 py-2">
                        <button type="button" aria-label={`Actions for ${row.partNumber}`} aria-expanded={menuId === row.id} className="h-8 w-8 rounded-md hover:bg-slate-100" onClick={() => setMenuId(menuId === row.id ? null : row.id)}>⋯</button>
                        {menuId === row.id ? (
                          <div className="absolute right-2 z-10 w-48 rounded-md border border-slate-200 bg-white py-1 text-sm shadow">
                            <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => { setMenuId(null); write({ ...state, partId: row.id }); }}>Open</button>
                            <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => { setMenuId(null); write({ ...state, partId: row.id }); void loadMovements(row.id); }}>View usage</button>
                            <Link className="block px-3 py-1.5 hover:bg-slate-50" href={"/maintenance-supply" as never}>View mapping</Link>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && !error ? <JobsPagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={state.pageSize} onPageChange={(page) => write({ ...state, page })} onPageSizeChange={(pageSize) => write({ ...state, pageSize, page: 1 })} /> : null}
      </section>
      {selected ? (
        <section id="inventory-detail" className="rounded-lg border border-slate-200 bg-white p-4 text-sm" aria-live="polite">
          <h2 className="font-semibold">{selected.name}</h2>
          <p className="text-slate-600">{selected.partNumber} · {selected.erpCode?.trim() ? `ERP ${selected.erpCode}` : "Unmapped"} · {selected.supplier?.name || "No supplier"} · {selected.location || "No location"}</p>
          <p className="mt-2">Snapshot {selected.quantityInStock ?? 0}. Reserved {selected.reservedQuantity ?? 0}. Advisory available {selected.availableQuantity ?? 0}. These quantities follow the ERP snapshot and maintenance reservations. They are not a second stock ledger.</p>
          {movements ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {movements.length === 0 ? <li>No movements loaded.</li> : movements.slice(0, 8).map((row) => <li key={row.id}>{row.type} · {row.quantity} · {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}</li>)}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
