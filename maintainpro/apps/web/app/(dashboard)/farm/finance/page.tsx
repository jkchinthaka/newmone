"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState, PageHeader, Section, StatCard } from "@/components/farm/farm-ui";
import { farmGet, farmPost, formatLkr } from "@/lib/farm-api";
import { getActiveTenantId } from "@/lib/tenant-context";

type Expense = { id: string; date: string; category: string; description: string; amountLkr: number };
type Income = { id: string; date: string; source: string; cropType?: string | null; totalLkr: number; buyerName?: string | null };
type Summary = {
  totalExpense: number;
  totalIncome: number;
  netProfit: number;
  expenseByCategory: Record<string, number>;
  incomeBySource: Record<string, number>;
};

const EXPENSE_CATEGORIES = [
  "SEEDS",
  "FERTILIZER",
  "PESTICIDE",
  "LABOR",
  "EQUIPMENT_REPAIR",
  "FUEL",
  "IRRIGATION",
  "TRANSPORT",
  "PACKAGING",
  "VETERINARY",
  "FEED",
  "OTHER"
];

const INCOME_SOURCES = ["CROP_SALE", "LIVESTOCK_SALE", "MILK_SALE", "EGGS_SALE", "SUBSIDY", "RENTAL", "OTHER"];

export default function FarmFinancePage() {
  const qc = useQueryClient();
  const tenantId = typeof window !== "undefined" ? getActiveTenantId() ?? "" : "";

  const summary = useQuery({
    queryKey: ["farm-finance-summary", tenantId],
    queryFn: () => farmGet<Summary>("/farm/finance/summary", { tenantId }),
    enabled: Boolean(tenantId)
  });
  const expenses = useQuery({ queryKey: ["farm-expenses"], queryFn: () => farmGet<Expense[]>("/farm/finance/expenses") });
  const income = useQuery({ queryKey: ["farm-income"], queryFn: () => farmGet<Income[]>("/farm/finance/income") });

  const [tab, setTab] = useState<"expense" | "income">("expense");
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const createExpense = useMutation({
    mutationFn: (payload: Record<string, unknown>) => farmPost("/farm/finance/expenses", payload),
    onSuccess: () => {
      setForm({});
      setError(null);
      qc.invalidateQueries({ queryKey: ["farm-expenses"] });
      qc.invalidateQueries({ queryKey: ["farm-finance-summary"] });
    },
    onError: (err: unknown) => setError(String((err as Error)?.message ?? "failed"))
  });

  const createIncome = useMutation({
    mutationFn: (payload: Record<string, unknown>) => farmPost("/farm/finance/income", payload),
    onSuccess: () => {
      setForm({});
      setError(null);
      qc.invalidateQueries({ queryKey: ["farm-income"] });
      qc.invalidateQueries({ queryKey: ["farm-finance-summary"] });
    },
    onError: (err: unknown) => setError(String((err as Error)?.message ?? "failed"))
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { tenantId, ...form };
    if (form.amountLkr) payload.amountLkr = Number(form.amountLkr);
    if (form.totalLkr) payload.totalLkr = Number(form.totalLkr);
    if (form.quantityKg) payload.quantityKg = Number(form.quantityKg);
    if (form.pricePerKgLkr) payload.pricePerKgLkr = Number(form.pricePerKgLkr);
    if (tab === "expense") createExpense.mutate(payload);
    else createIncome.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Farm Finance"
        description="Income, expenses, and net profitability across your farm operations."
      />

      {tenantId && summary.data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Total income" value={formatLkr(summary.data.totalIncome)} />
          <StatCard label="Total expense" value={formatLkr(summary.data.totalExpense)} />
          <StatCard label="Net profit" value={formatLkr(summary.data.netProfit)} />
        </div>
      ) : null}

      <Section title="Add transaction">
        <div className="mb-3 flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setTab("expense");
              setForm({});
            }}
            className={`rounded-lg px-3 py-1.5 font-medium ${tab === "expense" ? "bg-amber-600 text-white" : "bg-slate-100"}`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("income");
              setForm({});
            }}
            className={`rounded-lg px-3 py-1.5 font-medium ${tab === "income" ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
          >
            Income
          </button>
        </div>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            <span>Date *</span>
            <input
              type="date"
              required
              value={form.date ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          {tab === "expense" ? (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Category *</span>
                <select
                  required
                  value={form.category ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {EXPENSE_CATEGORIES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
                <span>Description *</span>
                <input
                  required
                  value={form.description ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Amount (LKR) *</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.amountLkr ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, amountLkr: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Source *</span>
                <select
                  required
                  value={form.source ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, source: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {INCOME_SOURCES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Crop / item</span>
                <input
                  value={form.cropType ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, cropType: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Quantity (kg)</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.quantityKg ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, quantityKg: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Price per kg</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.pricePerKgLkr ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, pricePerKgLkr: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Total (LKR) *</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.totalLkr ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, totalLkr: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Buyer name</span>
                <input
                  value={form.buyerName ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, buyerName: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </>
          )}
          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={!tenantId || createExpense.isPending || createIncome.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Save
            </button>
            {error ? <span className="text-xs text-rose-600">{error}</span> : null}
          </div>
        </form>
      </Section>

      <Section title="Recent expenses">
        {expenses.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !expenses.data?.length ? (
          <EmptyState title="No expenses yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {expenses.data.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{e.category}</td>
                    <td className="px-3 py-2">{e.description}</td>
                    <td className="px-3 py-2">{formatLkr(e.amountLkr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Recent income">
        {income.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !income.data?.length ? (
          <EmptyState title="No income yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Crop</th>
                  <th className="px-3 py-2 text-left">Buyer</th>
                  <th className="px-3 py-2 text-left">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {income.data.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2">{new Date(i.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{i.source}</td>
                    <td className="px-3 py-2">{i.cropType ?? "—"}</td>
                    <td className="px-3 py-2">{i.buyerName ?? "—"}</td>
                    <td className="px-3 py-2">{formatLkr(i.totalLkr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
