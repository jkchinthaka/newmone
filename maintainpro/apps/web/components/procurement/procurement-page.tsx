"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Send, Repeat } from "lucide-react";
import { toast } from "sonner";

import { ErrorState, InlineLoadingState, toSafeDisplayMessage } from "@/components/ui/page-state";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { TableToolbar } from "@/components/ui/table-toolbar";

import {
  approveFinance,
  approveOperational,
  executeErpSync,
  getPurchaseOrder,
  listPurchaseOrders,
  PurchaseOrderWorkflowRecord,
  rejectPurchaseOrder,
  retryErpSync
} from "./api";
import { getApiErrorMessage } from "@/lib/api-client";
import { filterRowsBySearch } from "@/lib/client-table";
import { formatCurrency } from "@/lib/localization";

type Filter = "ALL" | "PENDING_OPERATIONAL" | "PENDING_FINANCE" | "APPROVED" | "REJECTED";

function badgeClass(status: PurchaseOrderWorkflowRecord["workflowStatus"]) {
  switch (status) {
    case "PENDING_OPERATIONAL":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "PENDING_FINANCE":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "REJECTED":
      return "bg-rose-100 text-rose-800 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default function ProcurementWorkflowPage() {
  const [orders, setOrders] = useState<PurchaseOrderWorkflowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PurchaseOrderWorkflowRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await listPurchaseOrders();
      setOrders(rows);
    } catch (err) {
      const message = toSafeDisplayMessage(
        getApiErrorMessage(err, "Failed to load purchase orders."),
        "Failed to load purchase orders."
      );
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const row = await getPurchaseOrder(id);
      setDetail(row);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load purchase order detail."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  const filtered = useMemo(() => {
    const byStatus =
      filter === "ALL" ? orders : orders.filter((order) => order.workflowStatus === filter);

    return filterRowsBySearch(byStatus, searchQuery, (order) =>
      [order.poNumber, order.supplier?.name ?? "", order.workflowStatus.replace(/_/g, " ")].join(" ")
    );
  }, [orders, filter, searchQuery]);

  const procurementColumns: DataTableColumn<PurchaseOrderWorkflowRecord>[] = useMemo(
    () => [
      {
        id: "poNumber",
        header: "PO Number",
        mobileLabel: "PO Number",
        cell: (po) => <span className="font-semibold text-slate-900">{po.poNumber}</span>
      },
      {
        id: "supplier",
        header: "Supplier",
        mobileLabel: "Supplier",
        cell: (po) => po.supplier?.name ?? "Unknown supplier"
      },
      {
        id: "total",
        header: "Total",
        mobileLabel: "Total",
        cell: (po) => formatCurrency(po.totalAmount, { fallback: "-" })
      },
      {
        id: "status",
        header: "Status",
        mobileLabel: "Status",
        cell: (po) => (
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClass(po.workflowStatus)}`}>
            {po.workflowStatus.replace(/_/g, " ")}
          </span>
        )
      }
    ],
    []
  );

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  }

  async function handleApproveOperational(id: string) {
    await withBusy(id, async () => {
      try {
        await approveOperational(id);
        toast.success("Operational approval recorded.");
        await refresh();
        if (selectedId === id) await loadDetail(id);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to approve."));
      }
    });
  }

  async function handleApproveFinance(id: string) {
    await withBusy(id, async () => {
      try {
        await approveFinance(id);
        toast.success("Finance approval recorded.");
        await refresh();
        if (selectedId === id) await loadDetail(id);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to approve."));
      }
    });
  }

  async function handleReject(id: string) {
    if (!rejectionNotes.trim()) {
      toast.error("Provide rejection notes.");
      return;
    }
    await withBusy(id, async () => {
      try {
        await rejectPurchaseOrder(id, rejectionNotes.trim());
        toast.success("Purchase order rejected.");
        setRejectionNotes("");
        await refresh();
        if (selectedId === id) await loadDetail(id);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to reject."));
      }
    });
  }

  async function handleErpSync(id: string) {
    await withBusy(id, async () => {
      try {
        const result = await executeErpSync(id);
        toast.success(result.status === "SUCCESS" ? "ERP sync succeeded." : "ERP sync attempt logged.");
        await refresh();
        if (selectedId === id) await loadDetail(id);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to sync ERP."));
      }
    });
  }

  async function handleErpRetry(id: string) {
    await withBusy(id, async () => {
      try {
        const result = await retryErpSync(id);
        toast.success(result.status === "SUCCESS" ? "ERP retry succeeded." : "ERP retry attempt logged.");
        await refresh();
        if (selectedId === id) await loadDetail(id);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to retry ERP sync."));
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumbs />
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Procurement Workflow</h1>
          <p className="mt-1 text-sm text-slate-600">
            Approve, reject, and sync purchase orders to the ERP. Finance approval is required for orders meeting the configured threshold.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["ALL", "PENDING_OPERATIONAL", "PENDING_FINANCE", "APPROVED", "REJECTED"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === f
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      <TableToolbar
        onSearchChange={setSearchQuery}
        searchAriaLabel="Search purchase orders"
        searchPlaceholder="Search PO number or supplier..."
        searchValue={searchQuery}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-2 px-1 text-sm font-semibold text-slate-700">
            Purchase Orders ({filtered.length})
          </div>
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <InlineLoadingState label="Loading purchase orders..." />
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <ErrorState
                description={loadError}
                onRetry={() => void refresh()}
                title="Could not load purchase orders"
              />
            </div>
          ) : (
            <DataTable
              ariaLabel="Purchase orders"
              columns={procurementColumns}
              emptyDescription="No purchase orders match the current filter or search. Try another status or refresh the list."
              emptyTitle="No purchase orders to show"
              getRowId={(po) => po.id}
              onRowClick={(po) => setSelectedId(po.id)}
              rowClassName={(po) => (selectedId === po.id ? "bg-slate-50" : undefined)}
              rows={filtered}
            />
          )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {!selectedId ? (
            <p className="text-sm text-slate-500">Select a purchase order to view approval workflow.</p>
          ) : detailLoading || !detail ? (
            <div className="flex items-center text-slate-500">
              <Loader2 className="mr-2 animate-spin" size={16} /> Loading PO
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{detail.poNumber}</h2>
                <p className="text-xs text-slate-500">
                  Supplier: {detail.supplier?.name ?? "Unknown"} · Tenant: {detail.tenantId ?? "—"}
                </p>
                <p className="text-xs text-slate-500">Total: {formatCurrency(detail.totalAmount, { fallback: "-" })}</p>
                <span className={`mt-2 inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClass(detail.workflowStatus)}`}>
                  {detail.workflowStatus.replace("_", " ")}
                </span>
              </div>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Approvals</h3>
                <ul className="mt-2 space-y-2">
                  {(detail.approvals ?? []).map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs">
                      <span className="font-semibold text-slate-700">{a.stage}</span>
                      <span className="text-slate-500">{a.status}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === detail.id || detail.workflowStatus !== "PENDING_OPERATIONAL"}
                    onClick={() => void handleApproveOperational(detail.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-500"
                  >
                    <CheckCircle2 size={14} /> Approve Operational
                  </button>
                  <button
                    type="button"
                    disabled={busyId === detail.id || detail.workflowStatus !== "PENDING_FINANCE"}
                    onClick={() => void handleApproveFinance(detail.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-indigo-500"
                  >
                    <CheckCircle2 size={14} /> Approve Finance
                  </button>
                </div>

                <div className="space-y-1">
                  <textarea
                    value={rejectionNotes}
                    onChange={(e) => setRejectionNotes(e.target.value)}
                    placeholder="Rejection notes (required to reject)"
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    disabled={busyId === detail.id || (detail.workflowStatus !== "PENDING_OPERATIONAL" && detail.workflowStatus !== "PENDING_FINANCE")}
                    onClick={() => void handleReject(detail.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-rose-500"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">ERP Sync</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === detail.id || detail.workflowStatus !== "APPROVED"}
                    onClick={() => void handleErpSync(detail.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-100"
                  >
                    <Send size={14} /> Sync to ERP
                  </button>
                  <button
                    type="button"
                    disabled={busyId === detail.id || !(detail.erpSyncAttempts ?? []).some((a) => a.status === "FAILED")}
                    onClick={() => void handleErpRetry(detail.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-100"
                  >
                    <Repeat size={14} /> Retry Last Sync
                  </button>
                </div>
                <ul className="space-y-1 text-xs">
                  {(detail.erpSyncAttempts ?? []).map((a) => (
                    <li key={a.id} className="rounded border border-slate-200 px-2 py-1">
                      <span className="font-semibold">#{a.attemptNumber}</span> · {a.status}
                      {a.errorMessage ? <span className="ml-1 text-rose-600">— {a.errorMessage}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
