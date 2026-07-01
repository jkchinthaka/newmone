"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  canApproveVendorQuotation,
  canFinanceApproveVendorInvoice,
  canRequestVendorRepair,
  formatCurrency,
  vendorStatusLabel,
  type VendorRepairResponse
} from "@/lib/work-order-vendor-repair";

type ApiEnvelope<T> = { data: T; message?: string };

type Props = {
  workOrderId: string;
  verificationStatus?: string;
};

export function WorkOrderVendorRepairPanel({ workOrderId, verificationStatus }: Props) {
  const currentUser = useCurrentUser();
  const role = currentUser?.role;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payload, setPayload] = useState<VendorRepairResponse | null>(null);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; blacklisted?: boolean }>>([]);

  const [requestReason, setRequestReason] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [quotationNo, setQuotationNo] = useState("");
  const [quotedAmount, setQuotedAmount] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [exceedsReason, setExceedsReason] = useState("");

  const vendorCase = payload?.vendorCase;
  const costSummary = payload?.costSummary;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<ApiEnvelope<VendorRepairResponse>>(`/work-orders/${workOrderId}/vendor-repair`);
      setPayload(response.data.data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load vendor repair details."));
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!canRequestVendorRepair(role)) return;
    void apiClient
      .get<ApiEnvelope<Array<{ id: string; name: string; blacklisted?: boolean }>>>("/suppliers")
      .then((response) => setSuppliers(response.data.data ?? []))
      .catch(() => setSuppliers([]));
  }, [role]);

  const selectedSupplier = useMemo(
    () => suppliers.find((item) => item.id === selectedVendorId),
    [selectedVendorId, suppliers]
  );

  async function runAction(label: string, action: () => Promise<void>) {
    setSubmitting(true);
    try {
      await action();
      toast.success(label);
      await refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to complete vendor repair action."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 size={16} className="animate-spin" /> Loading vendor repair...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor repair status</p>
            <p className="text-base font-semibold text-slate-900">{vendorStatusLabel(vendorCase?.status)}</p>
          </div>
          {vendorCase?.supplier ? (
            <div className="text-sm text-slate-700">
              <Truck size={14} className="mr-1 inline" />
              {vendorCase.supplier.name}
              {vendorCase.supplier.blacklisted ? (
                <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Blacklisted</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {vendorCase?.externalRepairReason ? (
          <p className="mt-2 text-sm text-slate-600">{vendorCase.externalRepairReason}</p>
        ) : null}
      </div>

      {costSummary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Approved quotation" value={formatCurrency(costSummary.approvedQuotationTotal)} />
          <Metric label="Invoice total" value={formatCurrency(costSummary.invoiceTotal)} />
          <Metric
            label="Variance"
            value={formatCurrency(costSummary.varianceAmount)}
            warn={costSummary.varianceAmount > 0}
          />
          <Metric label="Total maintenance cost" value={formatCurrency(costSummary.totalMaintenanceCost)} />
        </div>
      ) : null}

      {!vendorCase && canRequestVendorRepair(role) ? (
        <section className="space-y-3 rounded-lg border border-slate-200 p-4">
          <h4 className="font-semibold text-slate-900">Request vendor repair</h4>
          <textarea
            value={requestReason}
            onChange={(event) => setRequestReason(event.target.value)}
            rows={2}
            placeholder="Reason for external repair"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isEmergency} onChange={(event) => setIsEmergency(event.target.checked)} />
            Emergency vendor repair
          </label>
          {isEmergency ? (
            <input
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Emergency override reason"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          ) : null}
          <select
            value={selectedVendorId}
            onChange={(event) => setSelectedVendorId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select vendor (optional)</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id} disabled={supplier.blacklisted}>
                {supplier.name}
                {supplier.blacklisted ? " (blacklisted)" : ""}
              </option>
            ))}
          </select>
          {selectedSupplier?.blacklisted ? (
            <p className="text-sm text-red-700">Blacklisted vendor cannot be selected without admin override.</p>
          ) : null}
          <button
            type="button"
            disabled={submitting || !requestReason.trim()}
            onClick={() =>
              void runAction("Vendor repair requested", async () => {
                await apiClient.post(`/work-orders/${workOrderId}/vendor-repair/request`, {
                  externalRepairReason: requestReason.trim(),
                  supplierId: selectedVendorId || undefined,
                  isEmergency,
                  overrideReason: overrideReason.trim() || undefined
                });
              })
            }
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Request Vendor Repair
          </button>
        </section>
      ) : null}

      {vendorCase && canRequestVendorRepair(role) ? (
        <section className="space-y-3 rounded-lg border border-slate-200 p-4">
          <h4 className="font-semibold text-slate-900">Vendor & quotations</h4>
          {!vendorCase.supplier ? (
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedVendorId}
                onChange={(event) => setSelectedVendorId(event.target.value)}
                className="min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select vendor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={submitting || !selectedVendorId}
                onClick={() =>
                  void runAction("Vendor selected", async () => {
                    await apiClient.post(`/work-orders/${workOrderId}/vendor-repair/select-vendor`, {
                      supplierId: selectedVendorId
                    });
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Select Vendor
              </button>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={quotationNo}
              onChange={(event) => setQuotationNo(event.target.value)}
              placeholder="Quotation no"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={quotedAmount}
              onChange={(event) => setQuotedAmount(event.target.value)}
              placeholder="Quoted amount"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={submitting || !quotationNo.trim() || !quotedAmount || !vendorCase.supplier?.id}
              onClick={() =>
                void runAction("Quotation submitted", async () => {
                  await apiClient.post(`/work-orders/${workOrderId}/vendor-repair/quotations`, {
                    supplierId: vendorCase.supplier!.id,
                    quotationNo: quotationNo.trim(),
                    quotationDate: new Date().toISOString(),
                    quotedAmount: Number(quotedAmount)
                  });
                })
              }
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
            >
              Add Quotation
            </button>
          </div>

          {vendorCase.quotations.length ? (
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {vendorCase.quotations.map((quotation) => (
                <li key={quotation.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{quotation.quotationNo}</p>
                    <p className="text-slate-600">
                      {formatCurrency(quotation.quotedAmount, quotation.currency)} · {quotation.status}
                    </p>
                  </div>
                  {quotation.status === "SUBMITTED" && canApproveVendorQuotation(role) ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          void runAction("Quotation approved", async () => {
                            await apiClient.post(
                              `/work-orders/${workOrderId}/vendor-repair/quotations/${quotation.id}/approve`,
                              {}
                            );
                          })
                        }
                        className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          void runAction("Quotation rejected", async () => {
                            await apiClient.post(
                              `/work-orders/${workOrderId}/vendor-repair/quotations/${quotation.id}/reject`,
                              { reason: "Rejected from vendor repair panel" }
                            );
                          })
                        }
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-800 hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-amber-800">Quotation required before vendor work authorization.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() =>
                void runAction("Vendor work authorized", async () => {
                  await apiClient.post(`/work-orders/${workOrderId}/vendor-repair/authorize`, {});
                })
              }
              className="rounded-lg border border-brand-300 px-3 py-2 text-sm text-brand-800 hover:bg-brand-50"
            >
              Authorize Vendor Work
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() =>
                void runAction("Vendor marked completed", async () => {
                  await apiClient.post(`/work-orders/${workOrderId}/vendor-repair/vendor-completed`, {});
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Mark Vendor Completed
            </button>
          </div>
        </section>
      ) : null}

      {vendorCase && canRequestVendorRepair(role) ? (
        <section className="space-y-3 rounded-lg border border-slate-200 p-4">
          <h4 className="font-semibold text-slate-900">Invoice review</h4>
          {verificationStatus !== "VERIFIED" ? (
            <p className="text-sm text-amber-800">Supervisor verification required before invoice approval.</p>
          ) : (
            <p className="flex items-center gap-1 text-sm text-emerald-700">
              <CheckCircle2 size={14} /> Supervisor verification completed
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              value={invoiceNo}
              onChange={(event) => setInvoiceNo(event.target.value)}
              placeholder="Invoice no"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={invoiceAmount}
              onChange={(event) => setInvoiceAmount(event.target.value)}
              placeholder="Invoice amount"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={taxAmount}
              onChange={(event) => setTaxAmount(event.target.value)}
              placeholder="Tax"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={submitting || !invoiceNo.trim() || !invoiceAmount || !vendorCase.supplier?.id}
              onClick={() =>
                void runAction("Invoice submitted", async () => {
                  await apiClient.post(`/work-orders/${workOrderId}/vendor-repair/invoices`, {
                    supplierId: vendorCase.supplier!.id,
                    invoiceNo: invoiceNo.trim(),
                    invoiceDate: new Date().toISOString(),
                    invoiceAmount: Number(invoiceAmount),
                    taxAmount: Number(taxAmount || 0),
                    exceedsQuotationReason: exceedsReason.trim() || undefined
                  });
                })
              }
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
            >
              Submit Invoice
            </button>
          </div>
          <input
            value={exceedsReason}
            onChange={(event) => setExceedsReason(event.target.value)}
            placeholder="Reason if invoice exceeds approved quotation"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          {vendorCase.invoices.map((invoice) => (
            <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{invoice.invoiceNo}</p>
                <p className="text-slate-600">
                  {formatCurrency(invoice.totalAmount, invoice.currency)} · {invoice.status}
                </p>
              </div>
              {(invoice.status === "SUBMITTED" || invoice.status === "UNDER_REVIEW") && canFinanceApproveVendorInvoice(role) ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submitting || verificationStatus !== "VERIFIED"}
                    onClick={() =>
                      void runAction("Invoice approved", async () => {
                        await apiClient.post(`/work-orders/${workOrderId}/vendor-repair/invoices/${invoice.id}/approve`, {});
                      })
                    }
                    className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    Finance Approve
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      void runAction("Invoice rejected", async () => {
                        await apiClient.post(`/work-orders/${workOrderId}/vendor-repair/invoices/${invoice.id}/reject`, {
                          reason: "Rejected from vendor repair panel"
                        });
                      })
                    }
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-800 hover:bg-red-50"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ))}

          {canFinanceApproveVendorInvoice(role) ? (
            <button
              type="button"
              disabled={submitting || vendorCase.status === "CLOSED"}
              onClick={() =>
                void runAction("Vendor repair closed", async () => {
                  await apiClient.post(`/work-orders/${workOrderId}/vendor-repair/close`, {});
                })
              }
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Close Vendor Repair
            </button>
          ) : null}
        </section>
      ) : null}

      {costSummary && costSummary.varianceAmount > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          Invoice exceeds quotation by {formatCurrency(costSummary.varianceAmount)} (
          {costSummary.variancePercentage.toFixed(1)}%).
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${warn ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${warn ? "text-amber-900" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
