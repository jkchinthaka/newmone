"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  defaultManagementFilters,
  downloadManagementReportExport,
  fetchCostByCategory,
  fetchCostByDepartment,
  fetchProfitabilitySummary,
  fetchRepeatedBreakdowns,
  fetchRepairVsReplace,
  fetchTopHighCostAssets,
  fetchTopHighCostVehicles,
  fetchVendorCostComparison,
  formatCurrency,
  severityClass,
  type CostEntityRow,
  type ManagementReportFilters,
  type ManagementSummaryCard,
  type ProfitabilitySummary
} from "@/lib/management-intelligence-api";

export function ManagementIntelligencePage() {
  const [filters, setFilters] = useState<ManagementReportFilters>(defaultManagementFilters);
  const [summary, setSummary] = useState<ProfitabilitySummary | null>(null);
  const [topAssets, setTopAssets] = useState<CostEntityRow[]>([]);
  const [topVehicles, setTopVehicles] = useState<CostEntityRow[]>([]);
  const [departments, setDepartments] = useState<Record<string, unknown>[]>([]);
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [repeated, setRepeated] = useState<Record<string, unknown>[]>([]);
  const [vendors, setVendors] = useState<Record<string, unknown>[]>([]);
  const [repairReviews, setRepairReviews] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, assets, vehicles, deptData, catData, repeatData, vendorData, repairData] = await Promise.all([
        fetchProfitabilitySummary(filters),
        fetchTopHighCostAssets(filters),
        fetchTopHighCostVehicles(filters),
        fetchCostByDepartment(filters),
        fetchCostByCategory(filters),
        fetchRepeatedBreakdowns(filters),
        fetchVendorCostComparison(filters),
        fetchRepairVsReplace(filters)
      ]);
      setSummary(summaryData);
      setTopAssets(assets);
      setTopVehicles(vehicles);
      setDepartments(deptData.rows ?? []);
      setCategories(catData.rows ?? []);
      setRepeated(repeatData.rows ?? []);
      setVendors(vendorData.rows ?? []);
      setRepairReviews(repairData.rows ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load management reports. Please retry."));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthlyTrend = useMemo(() => summary?.monthlyTrend ?? [], [summary]);

  const exportReport = async (reportKey: string) => {
    try {
      const blob = await downloadManagementReportExport(reportKey, filters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `management-${reportKey}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, "Export failed. Please retry."));
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand-700" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900">Management Intelligence</h1>
        </div>
        <p className="text-sm text-slate-600">
          Where maintenance money is leaking — rule-based cost intelligence, not AI prediction.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="From" type="date" value={filters.dateFrom ?? ""} onChange={(v) => setFilters((p) => ({ ...p, dateFrom: v }))} />
          <FilterField label="To" type="date" value={filters.dateTo ?? ""} onChange={(v) => setFilters((p) => ({ ...p, dateTo: v }))} />
          <FilterField label="Branch" value={filters.branch ?? ""} onChange={(v) => setFilters((p) => ({ ...p, branch: v || undefined }))} />
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white">
            <RefreshCw size={14} /> Apply
          </button>
          <button type="button" onClick={() => void exportReport("profitability-summary")} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
            <Download size={14} /> Export summary
          </button>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading management intelligence…
        </div>
      ) : null}

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      {summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.cards.map((card) => (
              <SummaryCardView key={card.key} card={card} />
            ))}
          </section>

          <Section title="Monthly maintenance cost trend" icon={<TrendingUp size={16} />}>
            {monthlyTrend.length === 0 ? (
              <EmptyState message="No cost trend data for selected period." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Parts</th>
                      <th className="px-3 py-2">Vendor</th>
                      <th className="px-3 py-2">Work orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTrend.map((row) => (
                      <tr key={row.month} className="border-b border-slate-100">
                        <td className="px-3 py-2">{row.month}</td>
                        <td className="px-3 py-2">{formatCurrency(row.totalCost)}</td>
                        <td className="px-3 py-2">{formatCurrency(row.partsCost)}</td>
                        <td className="px-3 py-2">{formatCurrency(row.vendorCost)}</td>
                        <td className="px-3 py-2">{row.workOrderCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <div className="grid gap-4 xl:grid-cols-2">
            <EntityTable title="Top high-cost assets" rows={topAssets} />
            <EntityTable title="Top high-cost vehicles" rows={topVehicles} />
          </div>

          <GroupedTable title="Cost by department" rows={departments} labelKey="departmentName" />
          <GroupedTable title="Cost by category" rows={categories} labelKey="category" />
          <GroupedTable title="Repeated breakdowns" rows={repeated} labelKey="assetOrVehicle" />
          <GroupedTable title="Vendor cost comparison" rows={vendors} labelKey="vendorName" />
          <GroupedTable title="Repair vs replace review" rows={repairReviews} labelKey="entity" />

          <p className="text-xs text-slate-500">{summary.disclaimer}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href={"/reports/fraud-control" as Route} className="text-brand-700 hover:underline">Fraud & Control</Link>
            <Link href={"/reports/maintenance-exceptions" as Route} className="text-brand-700 hover:underline">Maintenance Exceptions</Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function SummaryCardView({ card }: { card: ManagementSummaryCard }) {
  const numeric = typeof card.value === "number";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{numeric ? formatCurrency(card.value as number) : card.value}</p>
      {card.subLabel ? <p className="mt-1 text-xs text-slate-500">{card.subLabel}</p> : null}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EntityTable({ title, rows }: { title: string; rows: CostEntityRow[] }) {
  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <EmptyState message="No high-cost assets found for selected period." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Total cost</th>
                <th className="px-2 py-2">WOs</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{row.rank}</td>
                  <td className="px-2 py-2">{row.label}</td>
                  <td className="px-2 py-2">{formatCurrency(row.totalMaintenanceCost)}</td>
                  <td className="px-2 py-2">{row.workOrderCount}</td>
                  <td className="px-2 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityClass(row.riskSeverity)}`}>
                      {row.recommendedAction}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function GroupedTable({
  title,
  rows,
  labelKey
}: {
  title: string;
  rows: Record<string, unknown>[];
  labelKey: string;
}) {
  return (
    <Section title={title}>
      {rows.length === 0 ? <EmptyState message="No records for selected period." /> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">Total cost</th>
                <th className="px-2 py-2">Work orders</th>
                <th className="px-2 py-2">Repeated</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row, index) => (
                <tr key={`${String(row[labelKey])}-${index}`} className="border-b border-slate-100">
                  <td className="px-2 py-2">{String(row[labelKey] ?? "—")}</td>
                  <td className="px-2 py-2">{formatCurrency(Number(row.totalMaintenanceCost ?? row.totalCost ?? row.totalVendorCost ?? 0))}</td>
                  <td className="px-2 py-2">{String(row.workOrderCount ?? row.repeatedCount ?? "—")}</td>
                  <td className="px-2 py-2">{String(row.repeatedBreakdownCount ?? row.repeatedCount ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-slate-600">{message}</p>;
}
