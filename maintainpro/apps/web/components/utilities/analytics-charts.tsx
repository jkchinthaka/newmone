"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import {
  buildConsumptionTrendSeries,
  buildCostByTypeSeries,
  buildTopMeterSeries,
  formatCompact,
  formatCurrency,
  utilityTypeLabel
} from "./helpers";
import { EmptyState } from "./shared-ui";
import type { AnalyticsFilters, UtilityAnalytics, UtilityBill, UtilityMeter, UtilityTypeFilter } from "./types";

type AnalyticsChartsProps = {
  analytics: UtilityAnalytics;
  bills: UtilityBill[];
  meters: UtilityMeter[];
  filters: AnalyticsFilters;
  onFiltersChange: (next: AnalyticsFilters) => void;
};

const PIE_COLORS = ["#1476d6", "#0e9aa7", "#8b5cf6", "#f59e0b"];

export function AnalyticsCharts({ analytics, bills, meters, filters, onFiltersChange }: AnalyticsChartsProps) {
  const consumptionSeries = buildConsumptionTrendSeries(analytics, filters);

  const costByMonth = consumptionSeries.map((point) => ({
    label: point.label,
    month: point.month,
    totalCost: analytics.monthly
      .filter((entry) => entry.month === point.month)
      .filter((entry) => (filters.utilityType === "ALL" ? true : entry.meterType === filters.utilityType))
      .reduce((sum, entry) => sum + entry.totalAmount, 0)
  }));

  const typeDistribution = buildCostByTypeSeries(analytics, filters).map((entry) => ({
    name: utilityTypeLabel(entry.type),
    value: entry.totalCost
  }));

  const topMeters = buildTopMeterSeries(bills, meters, filters).map((entry) => ({
    name: entry.meterNumber,
    consumption: entry.consumption,
    cost: entry.cost
  }));

  const hasAnalyticsData = consumptionSeries.length > 0 || typeDistribution.length > 0 || topMeters.length > 0;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Start
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => onFiltersChange({ ...filters, startDate: event.target.value })}
              className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            End
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => onFiltersChange({ ...filters, endDate: event.target.value })}
              className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Utility
            <select
              value={filters.utilityType}
              onChange={(event) => onFiltersChange({ ...filters, utilityType: event.target.value as UtilityTypeFilter })}
              className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700"
            >
              <option value="ALL">All</option>
              <option value="ELECTRICITY">Electricity</option>
              <option value="WATER">Water</option>
              <option value="GAS">Gas</option>
            </select>
          </label>
        </div>
      </div>

      {!hasAnalyticsData ? (
        <EmptyState
          title="No analytics data"
          description="Adjust the filters or generate additional bills to unlock trend insights."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Monthly consumption trend</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={consumptionSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => formatCompact(Number(value))} />
                  <Tooltip formatter={(value: number) => formatCompact(value)} />
                  <Legend />
                  <Line dataKey="ELECTRICITY" name="Electricity" stroke="#1476d6" strokeWidth={2.5} dot={false} />
                  <Line dataKey="WATER" name="Water" stroke="#0e9aa7" strokeWidth={2.5} dot={false} />
                  <Line dataKey="GAS" name="Gas" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Monthly cost trend</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => formatCompact(Number(value))} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="totalCost" fill="#1476d6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Utility type cost distribution</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeDistribution} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={4}>
                    {typeDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Top consuming meters</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMeters} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(value) => formatCompact(Number(value))} />
                  <YAxis type="category" dataKey="name" width={110} stroke="#64748b" fontSize={12} />
                  <Tooltip formatter={(value: number, name) => (name === "cost" ? formatCurrency(value) : formatCompact(value))} />
                  <Legend />
                  <Bar dataKey="consumption" fill="#0e9aa7" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="cost" fill="#1476d6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
