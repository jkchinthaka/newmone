"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PackagePlus,
  RotateCcw,
  Send,
  XCircle
} from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  approvePartRequestFinance,
  approvePartRequestOperational,
  createPartRequest,
  issuePartRequest,
  listPartRequests,
  PartRequest,
  rejectPartRequest
} from "./part-requests-api";
import {
  confirmPartReturn,
  formatCurrency,
  getWorkOrderPartsSummary,
  listWorkOrderPartLines,
  markPartUsed,
  pendingPartQuantity,
  requestPartReturn,
  type PartReturnCondition,
  type WorkOrderPartLine,
  type WorkOrderPartsCostSummary
} from "./work-order-parts-api";

interface Props {
  workOrderId: string;
}

type SparePartOption = {
  id: string;
  partNumber?: string | null;
  sku?: string | null;
  name?: string | null;
  quantityInStock?: number | null;
  unitCost?: number | null;
};

const STOREKEEPER_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "INVENTORY_KEEPER",
  "OPERATIONS_MANAGER",
  "ASSET_MANAGER"
]);

const APPROVER_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ASSET_MANAGER",
  "INVENTORY_KEEPER",
  "OPERATIONS_MANAGER"
]);

const TECHNICIAN_ROLES = new Set(["TECHNICIAN", "MECHANIC"]);

function requestBadge(status: PartRequest["status"]) {
  switch (status) {
    case "PENDING_OPERATIONAL":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "PENDING_FINANCE":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "APPROVED":
    case "PARTIALLY_ISSUED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "REJECTED":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "ISSUED":
      return "bg-sky-100 text-sky-800 border-sky-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function lineBadge(status: WorkOrderPartLine["lineStatus"]) {
  switch (status) {
    case "REQUESTED":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "APPROVED":
    case "RESERVED":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "ISSUED":
    case "PARTIALLY_USED":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "PARTIALLY_RETURNED":
    case "RETURNED":
      return "bg-violet-50 text-violet-800 border-violet-200";
    case "USED":
    case "CLOSED":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "DAMAGED":
      return "bg-rose-50 text-rose-800 border-rose-200";
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

function partLineLabel(line: WorkOrderPartLine): string {
  const part = line.part;
  const code = part?.partNumber ?? part?.sku ?? line.partId;
  return `${code} — ${part?.name ?? "Part"}`;
}

export function PartRequestsPanel({ workOrderId }: Props) {
  const user = useCurrentUser();
  const role = user.role ?? "";

  const [requests, setRequests] = useState<PartRequest[]>([]);
  const [lines, setLines] = useState<WorkOrderPartLine[]>([]);
  const [summary, setSummary] = useState<WorkOrderPartsCostSummary | null>(null);
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
  const [lineActions, setLineActions] = useState<
    Record<string, { usedQty?: string; returnQty?: string; returnCondition?: PartReturnCondition; confirmQty?: string }>
  >({});

  const canApprove = APPROVER_ROLES.has(role);
  const canIssue = STOREKEEPER_ROLES.has(role);
  const canMarkUsage = TECHNICIAN_ROLES.has(role) || STOREKEEPER_ROLES.has(role);
  const canConfirmReturn = STOREKEEPER_ROLES.has(role);

  const selectedPart = useMemo(() => parts.find((p) => p.id === partId), [partId, parts]);

  const filteredParts = useMemo(() => {
    const query = partSearch.trim().toLowerCase();
    if (!query) return parts.slice(0, 50);
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

  const stockWarning = useMemo(() => {
    if (!selectedPart || !quantity) return null;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    const stock = selectedPart.quantityInStock ?? 0;
    if (stock < qty) {
      return "Insufficient stock. Request approval/procurement required.";
    }
    return null;
  }, [quantity, selectedPart]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRows, lineRows, costSummary] = await Promise.all([
        listPartRequests(workOrderId),
        listWorkOrderPartLines(workOrderId),
        getWorkOrderPartsSummary(workOrderId)
      ]);
      setRequests(reqRows);
      setLines(lineRows);
      setSummary(costSummary);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load parts data."));
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
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">1. Request Parts</h3>
        <p className="mt-1 text-xs text-slate-500">Technicians can request parts. Stock availability is shown before submit.</p>

        <div className="mt-3 grid gap-2">
          {partsSearchAvailable ? (
            <>
              <input
                value={partSearch}
                onChange={(event) => setPartSearch(event.target.value)}
                placeholder="Search by item code or name"
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
            </>
          ) : (
            <input
              value={partId}
              onChange={(event) => setPartId(event.target.value)}
              placeholder="Spare part ID (inventory search unavailable)"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            />
          )}

          {stockWarning ? (
            <p className="inline-flex items-center gap-1 text-xs text-amber-700">
              <AlertTriangle size={12} /> {stockWarning}
            </p>
          ) : null}

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
              <PackagePlus size={14} /> Request Part
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">2. Approval Status</h3>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-3 flex items-center text-xs text-slate-500">
            <Loader2 className="mr-1 animate-spin" size={14} /> Loading…
          </div>
        ) : requests.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">No part requests for this work order.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requests.map((pr) => (
              <li key={pr.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900">
                      {pr.part?.name ?? pr.partId}{" "}
                      <span className="text-slate-500">×{pr.requestedQuantity}</span>
                    </p>
                    {pr.reason ? <p className="text-slate-500">{pr.reason}</p> : null}
                    {pr.requiresFinanceApproval ? (
                      <p className="text-amber-700">High-cost part requires finance approval.</p>
                    ) : null}
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${requestBadge(pr.status)}`}>
                    {pr.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === pr.id || pr.status !== "PENDING_OPERATIONAL" || !canApprove}
                    title={!canApprove ? "Manager approval required." : undefined}
                    onClick={() =>
                      withBusy(pr.id, async () => {
                        try {
                          await approvePartRequestOperational(workOrderId, pr.id);
                          toast.success("Operational approval recorded.");
                          await refresh();
                        } catch (err) {
                          toast.error(getApiErrorMessage(err, "Approval failed."));
                        }
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === pr.id || pr.status !== "PENDING_FINANCE" || !canApprove}
                    onClick={() =>
                      withBusy(pr.id, async () => {
                        try {
                          await approvePartRequestFinance(workOrderId, pr.id);
                          toast.success("Finance approval recorded.");
                          await refresh();
                        } catch (err) {
                          toast.error(getApiErrorMessage(err, "Finance approval failed."));
                        }
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} /> Finance Approve
                  </button>
                  <button
                    type="button"
                    disabled={
                      busyId === pr.id ||
                      (pr.status !== "APPROVED" && pr.status !== "PARTIALLY_ISSUED") ||
                      !canIssue
                    }
                    title={!canIssue ? "Only storekeepers can issue stock." : undefined}
                    onClick={() =>
                      withBusy(pr.id, async () => {
                        try {
                          await issuePartRequest(workOrderId, pr.id);
                          toast.success("Part issued to work order.");
                          await refresh();
                        } catch (err) {
                          toast.error(getApiErrorMessage(err, "Issue failed."));
                        }
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
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
                        !canApprove ||
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
                            toast.error(getApiErrorMessage(err, "Reject failed."));
                          }
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">3–4. Issued Parts & Usage / Return</h3>
        {lines.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No part lines yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Req</th>
                  <th className="py-2 pr-3">Appr</th>
                  <th className="py-2 pr-3">Issued</th>
                  <th className="py-2 pr-3">Used</th>
                  <th className="py-2 pr-3">Ret</th>
                  <th className="py-2 pr-3">Stock</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const pending = pendingPartQuantity(line);
                  const action = lineActions[line.id] ?? {};
                  return (
                    <tr key={line.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 font-medium text-slate-900">{partLineLabel(line)}</td>
                      <td className="py-2 pr-3">{line.requestedQuantity}</td>
                      <td className="py-2 pr-3">{line.approvedQuantity ?? "—"}</td>
                      <td className="py-2 pr-3">{line.issuedQuantity}</td>
                      <td className="py-2 pr-3">{line.usedQuantity}</td>
                      <td className="py-2 pr-3">
                        {line.returnedQuantity}
                        {(line.pendingReturnQuantity ?? 0) > 0 ? (
                          <span className="ml-1 text-amber-600">(+{line.pendingReturnQuantity} pending)</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">{line.part?.quantityInStock ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${lineBadge(line.lineStatus)}`}>
                          {line.lineStatus.replace(/_/g, " ")}
                        </span>
                        {pending > 0 && line.issuedQuantity > 0 ? (
                          <p className="mt-1 text-amber-700">Balance: {pending}</p>
                        ) : null}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-col gap-1">
                          {line.issuedQuantity > 0 && pending > 0 && canMarkUsage ? (
                            <div className="flex gap-1">
                              <input
                                type="number"
                                min={1}
                                placeholder="Used qty"
                                value={action.usedQty ?? ""}
                                onChange={(e) =>
                                  setLineActions((prev) => ({
                                    ...prev,
                                    [line.id]: { ...prev[line.id], usedQty: e.target.value }
                                  }))
                                }
                                className="w-16 rounded border border-slate-200 px-1 py-0.5"
                              />
                              <button
                                type="button"
                                disabled={busyId === line.id}
                                onClick={() =>
                                  withBusy(line.id, async () => {
                                    const qty = Number(action.usedQty);
                                    if (!qty || qty <= 0) {
                                      toast.error("Enter used quantity.");
                                      return;
                                    }
                                    try {
                                      await markPartUsed(workOrderId, line.id, { usedQuantity: qty });
                                      toast.success("Usage recorded.");
                                      await refresh();
                                    } catch (err) {
                                      toast.error(getApiErrorMessage(err, "Failed to record usage."));
                                    }
                                  })
                                }
                                className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
                              >
                                Mark Used
                              </button>
                            </div>
                          ) : null}
                          {line.issuedQuantity > 0 && pending > 0 && canMarkUsage ? (
                            <div className="flex flex-wrap gap-1">
                              <input
                                type="number"
                                min={1}
                                placeholder="Return qty"
                                value={action.returnQty ?? ""}
                                onChange={(e) =>
                                  setLineActions((prev) => ({
                                    ...prev,
                                    [line.id]: { ...prev[line.id], returnQty: e.target.value }
                                  }))
                                }
                                className="w-16 rounded border border-slate-200 px-1 py-0.5"
                              />
                              <select
                                value={action.returnCondition ?? "UNUSED"}
                                onChange={(e) =>
                                  setLineActions((prev) => ({
                                    ...prev,
                                    [line.id]: {
                                      ...prev[line.id],
                                      returnCondition: e.target.value as PartReturnCondition
                                    }
                                  }))
                                }
                                className="rounded border border-slate-200 px-1 py-0.5 text-[10px]"
                              >
                                <option value="UNUSED">Unused</option>
                                <option value="USED_DAMAGED">Used/Damaged</option>
                                <option value="SCRAP">Scrap</option>
                                <option value="WRONG_PART">Wrong part</option>
                              </select>
                              <button
                                type="button"
                                disabled={busyId === line.id}
                                onClick={() =>
                                  withBusy(line.id, async () => {
                                    const qty = Number(action.returnQty);
                                    if (!qty || qty <= 0) {
                                      toast.error("Enter return quantity.");
                                      return;
                                    }
                                    try {
                                      await requestPartReturn(workOrderId, line.id, {
                                        returnedQuantity: qty,
                                        returnCondition: action.returnCondition ?? "UNUSED"
                                      });
                                      toast.success("Return requested.");
                                      await refresh();
                                    } catch (err) {
                                      toast.error(getApiErrorMessage(err, "Return request failed."));
                                    }
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
                              >
                                <RotateCcw size={10} /> Return
                              </button>
                            </div>
                          ) : null}
                          {(line.pendingReturnQuantity ?? 0) > 0 && canConfirmReturn ? (
                            <div className="flex gap-1">
                              <input
                                type="number"
                                min={1}
                                placeholder="Confirm qty"
                                value={action.confirmQty ?? ""}
                                onChange={(e) =>
                                  setLineActions((prev) => ({
                                    ...prev,
                                    [line.id]: { ...prev[line.id], confirmQty: e.target.value }
                                  }))
                                }
                                className="w-16 rounded border border-slate-200 px-1 py-0.5"
                              />
                              <button
                                type="button"
                                disabled={busyId === line.id}
                                onClick={() =>
                                  withBusy(line.id, async () => {
                                    const qty = Number(action.confirmQty);
                                    if (!qty || qty <= 0) {
                                      toast.error("Enter confirmed quantity.");
                                      return;
                                    }
                                    try {
                                      await confirmPartReturn(workOrderId, line.id, { confirmedQuantity: qty });
                                      toast.success("Return confirmed.");
                                      await refresh();
                                    } catch (err) {
                                      toast.error(getApiErrorMessage(err, "Confirm return failed."));
                                    }
                                  })
                                }
                                className="rounded bg-emerald-700 px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
                              >
                                Confirm Return
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">5. Cost Summary</h3>
        {summary ? (
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-slate-500">Requested</dt>
              <dd className="font-semibold">{formatCurrency(summary.requestedCost)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Approved</dt>
              <dd className="font-semibold">{formatCurrency(summary.approvedCost)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Issued</dt>
              <dd className="font-semibold">{formatCurrency(summary.issuedCost)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Used (net part cost)</dt>
              <dd className="font-semibold">{formatCurrency(summary.netPartCost)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Returned value</dt>
              <dd className="font-semibold">{formatCurrency(summary.returnedValue)}</dd>
            </div>
            {summary.unaccountedLines > 0 ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="inline-flex items-center gap-1 text-amber-700">
                  <AlertTriangle size={12} />
                  Issued parts are not fully accounted for ({summary.unaccountedLines} line
                  {summary.unaccountedLines === 1 ? "" : "s"}).
                </p>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Cost data not available.</p>
        )}
      </section>
    </div>
  );
}
