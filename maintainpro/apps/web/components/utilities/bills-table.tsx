"use client";

import { CheckCircle2, CreditCard, Eye, Plus } from "lucide-react";

import { billStatusTone, formatCurrency, formatDate, formatQuantity, getComputedBillStatus } from "./helpers";
import { DataTable, EmptyState, StatusBadge } from "./shared-ui";
import type { UtilityBill, UtilityMeter } from "./types";

type BillsTableProps = {
  bills: UtilityBill[];
  meters: UtilityMeter[];
  onGenerateBill: () => void;
  onMarkPaid: (bill: UtilityBill) => void;
  onViewBreakdown: (bill: UtilityBill) => void;
  canManage: boolean;
  payingBillId: string | null;
};

export function BillsTable({
  bills,
  meters,
  onGenerateBill,
  onMarkPaid,
  onViewBreakdown,
  canManage,
  payingBillId
}: BillsTableProps) {
  const meterById = new Map(meters.map((meter) => [meter.id, meter]));

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Utility Bills</p>
            <p className="mt-1 text-xs text-slate-500">Track generated bills, payment status, and overdue balances.</p>
          </div>
          <button
            type="button"
            onClick={onGenerateBill}
            disabled={!canManage}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={15} /> Generate Bill
          </button>
        </div>
      </div>

      {bills.length === 0 ? (
        <EmptyState
          title="No bills available"
          description="Generate bills from meter consumption data to start payment tracking."
        />
      ) : (
        <DataTable minWidthClass="min-w-[980px]">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Meter</th>
              <th className="px-4 py-3">Billing Period</th>
              <th className="px-4 py-3">Consumption</th>
              <th className="px-4 py-3">Total Amount</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {bills.map((bill) => {
              const meter = bill.meter ?? meterById.get(bill.meterId);
              const status = getComputedBillStatus(bill);
              const isOverdue = status === "OVERDUE";

              return (
                <tr key={bill.id} className={`transition hover:bg-slate-50/70 ${isOverdue ? "bg-rose-50/50" : ""}`}>
                  <td className="px-4 py-3 font-medium text-slate-900">{meter?.meterNumber ?? "Unknown"}</td>
                  <td className="px-4 py-3">
                    {formatDate(bill.billingPeriodStart)} - {formatDate(bill.billingPeriodEnd)}
                  </td>
                  <td className="px-4 py-3">
                    {formatQuantity(bill.totalConsumption)} {meter?.unit ?? ""}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(bill.totalAmount)}</td>
                  <td className={`px-4 py-3 ${isOverdue ? "font-semibold text-rose-700" : ""}`}>{formatDate(bill.dueDate)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={status} toneClass={billStatusTone(status)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onViewBreakdown(bill)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        <Eye size={13} /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => onMarkPaid(bill)}
                        disabled={!canManage || status === "PAID" || payingBillId === bill.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {status === "PAID" ? <CheckCircle2 size={13} /> : <CreditCard size={13} />}
                        {status === "PAID" ? "Paid" : payingBillId === bill.id ? "Paying..." : "Mark Paid"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </section>
  );
}
