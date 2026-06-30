"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PackagePlus, CheckCircle2, XCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  approvePartRequestFinance,
  approvePartRequestOperational,
  createPartRequest,
  issuePartRequest,
  listPartRequests,
  PartRequest,
  rejectPartRequest
} from "./part-requests-api";

interface Props {
  workOrderId: string;
}

type SparePartOption = {
  id: string;
  partNumber?: string | null;
  sku?: string | null;
  name?: string | null;
  quantityInStock?: number | null;
};

function badge(status: PartRequest["status"]) {
  switch (status) {
    case "PENDING_OPERATIONAL":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "PENDING_FINANCE":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "REJECTED":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "ISSUED":
      return "bg-sky-100 text-sky-800 border-sky-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function partLabel(part: SparePartOption): string {
  const code = part.partNumber ?? part.sku ?? part.id;
  const stock =
    typeof part.quantityInStock === "number" ? ` · stock ${part.quantityInStock}` : "";
  return `${code} — ${part.name ?? "Unnamed part"}${stock}`;
}

export function PartRequestsPanel({ workOrderId }: Props) {
  const [items, setItems] = useState<PartRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [partId, setPartId] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [parts, setParts] = useState<SparePartOption[]>([]);
  const [partsLoading, setPartsLoading] = useState(true);
  const [partsSearchAvailable, setPartsSearchAvailable] = useState(true);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [creating, setCreating] = useState(false);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const filteredParts = useMemo(() => {
    const query = partSearch.trim().toLowerCase();
    if (!query) {
      return parts.slice(0, 50);
    }

    return parts
      .filter((part) =>
        [part.id, part.partNumber, part.sku, part.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 50);
  }, [partSearch, parts]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listPartRequests(workOrderId);
      setItems(rows);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load part requests."));
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  const loadParts = useCallback(async () => {
    setPartsLoading(true);
    try {
      const response = await apiClient.get<{ data: SparePartOption[] }>("/inventory/parts");
      setParts(response.data.data ?? []);
      setPartsSearchAvailable(true);
    } catch {
      setParts([]);
      setPartsSearchAvailable(false);
    } finally {
      setPartsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadParts();
  }, [loadParts, refresh]);

  async function handleCreate() {
    if (!partId.trim() || !quantity) {
      toast.error("Select a spare part and quantity.");
      return;
    }
    setCreating(true);
    try {
      await createPartRequest(workOrderId, {
        partId: partId.trim(),
        quantity: Number(quantity),
        reason: reason.trim() || undefined
      });
      toast.success("Part request submitted.");
      setPartId("");
      setPartSearch("");
      setQuantity("1");
      setReason("");
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to create part request."));
    } finally {
      setCreating(false);
    }
  }

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Part Requests</h3>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        {partsSearchAvailable ? (
          <>
            <input
              value={partSearch}
              onChange={(event) => setPartSearch(event.target.value)}
              placeholder="Search spare parts by code or name"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            />
            <select
              value={partId}
              onChange={(event) => setPartId(event.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              <option value="">{partsLoading ? "Loading spare parts..." : "Select spare part"}</option>
              {filteredParts.map((part) => (
                <option key={part.id} value={part.id}>
                  {partLabel(part)}
                </option>
              ))}
            </select>
            {!partsLoading && filteredParts.length === 0 ? (
              <p className="text-xs text-slate-500">No spare parts match your search.</p>
            ) : null}
          </>
        ) : (
          <input
            value={partId}
            onChange={(event) => setPartId(event.target.value)}
            placeholder="Spare part ID (inventory search unavailable)"
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          />
        )}

        <div className="grid gap-2 md:grid-cols-[120px_1fr_auto]">
          <input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            type="number"
            min={1}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          />
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (optional)"
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreate()}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50 hover:bg-brand-500"
          >
            <PackagePlus size={14} /> Request
          </button>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center text-xs text-slate-500">
            <Loader2 className="mr-1 animate-spin" size={14} /> Loading part requests
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-500">No part requests for this work order.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((pr) => (
              <li key={pr.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900">
                      {pr.sparePart?.name ?? pr.partId ?? pr.sparePartId}{" "}
                      <span className="text-slate-500">x{pr.quantity}</span>
                    </p>
                    {pr.reason ?? pr.notes ? (
                      <p className="text-slate-500">{pr.reason ?? pr.notes}</p>
                    ) : null}
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge(pr.status)}`}>
                    {pr.status.replace("_", " ")}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === pr.id || pr.status !== "PENDING_OPERATIONAL"}
                    onClick={() =>
                      withBusy(pr.id, async () => {
                        try {
                          await approvePartRequestOperational(workOrderId, pr.id);
                          toast.success("Operational approval recorded.");
                          await refresh();
                        } catch (err) {
                          toast.error(getApiErrorMessage(err, "Failed."));
                        }
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50 hover:bg-emerald-500"
                  >
                    <CheckCircle2 size={12} /> Op Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === pr.id || pr.status !== "PENDING_FINANCE"}
                    onClick={() =>
                      withBusy(pr.id, async () => {
                        try {
                          await approvePartRequestFinance(workOrderId, pr.id);
                          toast.success("Finance approval recorded.");
                          await refresh();
                        } catch (err) {
                          toast.error(getApiErrorMessage(err, "Failed."));
                        }
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50 hover:bg-indigo-500"
                  >
                    <CheckCircle2 size={12} /> Fin Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === pr.id || pr.status !== "APPROVED"}
                    onClick={() =>
                      withBusy(pr.id, async () => {
                        try {
                          await issuePartRequest(workOrderId, pr.id);
                          toast.success("Part issued to work order.");
                          await refresh();
                        } catch (err) {
                          toast.error(getApiErrorMessage(err, "Failed to issue."));
                        }
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50 hover:bg-sky-500"
                  >
                    <Send size={12} /> Issue
                  </button>
                  <div className="flex items-center gap-1">
                    <input
                      value={rejectReasons[pr.id] ?? ""}
                      onChange={(event) => setRejectReasons((prev) => ({ ...prev, [pr.id]: event.target.value }))}
                      placeholder="Reject reason"
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px]"
                    />
                    <button
                      type="button"
                      disabled={
                        busyId === pr.id ||
                        (pr.status !== "PENDING_OPERATIONAL" && pr.status !== "PENDING_FINANCE")
                      }
                      onClick={() =>
                        withBusy(pr.id, async () => {
                          const note = (rejectReasons[pr.id] ?? "").trim();
                          if (!note) {
                            toast.error("Provide rejection reason.");
                            return;
                          }
                          try {
                            await rejectPartRequest(workOrderId, pr.id, note);
                            toast.success("Part request rejected.");
                            setRejectReasons((prev) => ({ ...prev, [pr.id]: "" }));
                            await refresh();
                          } catch (err) {
                            toast.error(getApiErrorMessage(err, "Failed to reject."));
                          }
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50 hover:bg-rose-500"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
