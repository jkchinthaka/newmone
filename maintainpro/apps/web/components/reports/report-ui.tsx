"use client";

import { ArrowDown, ArrowUp, Download, FileSpreadsheet, FileText, Loader2, Printer, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
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

import { getApiErrorMessage } from "@/lib/api-client";
import { DepartmentMultiSelect } from "@/components/departments/department-select";

import { downloadReportExport, formatReportValue } from "./api";
import {
  ReportChart,
  ReportExportFormat,
  ReportFilterOptions,
  ReportFilters,
  ReportModuleSlug,
  ReportSummaryCard,
  ReportTable
} from "./types";

const chartColors = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0f766e", "#475569"];

const toneClasses: Record<string, string> = {
  neutral: "border-slate-200 bg-white text-slate-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800"
};

export function ReportHeader({
  title,
  description,
  generatedAt,
  backHref
}: {
  title: string;
  description: string;
  generatedAt?: string;
  backHref?: Route;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between print:block">
      <div>
        {backHref ? (
          <Link href={backHref} className="text-xs font-semibold uppercase tracking-wide text-brand-700 print:hidden">
            Reports Dashboard
          </Link>
        ) : null}
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
      </div>
      {generatedAt ? (
        <p className="text-xs font-medium text-slate-500">Last updated {new Date(generatedAt).toLocaleString()}</p>
      ) : null}
    </div>
  );
}

export function SummaryCards({ cards }: { cards: ReportSummaryCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${toneClasses[card.tone ?? "neutral"]}`}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{card.label}</p>
          <p className="mt-2 break-words text-2xl font-bold leading-tight">{card.value}</p>
          {card.subLabel ? <p className="mt-1 text-xs text-slate-600">{card.subLabel}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function ReportFiltersBar({
  filters,
  options,
  onChange,
  onReset,
  compact = false
}: {
  filters: ReportFilters;
  options?: ReportFilterOptions;
  onChange: (filters: ReportFilters) => void;
  onReset: () => void;
  compact?: boolean;
}) {
  function patch(next: Partial<ReportFilters>) {
    onChange({ ...filters, ...next, page: next.page ?? 1 });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
      <div className={`grid gap-2 ${compact ? "md:grid-cols-3 xl:grid-cols-6" : "md:grid-cols-4 xl:grid-cols-10"}`}>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Start
          <input type="date" value={filters.startDate} onChange={(event) => patch({ startDate: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          End
          <input type="date" value={filters.endDate} onChange={(event) => patch({ endDate: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" />
        </label>
        <DepartmentMultiSelect value={filters.departmentIds} onChange={(value) => patch({ departmentIds: value, departmentId: value[0] ?? "" })} options={options?.departments ?? []} label="Departments" />
        {!compact ? <SelectFilter label="User" value={filters.userId} onChange={(value) => patch({ userId: value })} options={options?.users ?? []} /> : null}
        <SelectFilter label="Driver" value={filters.driverId} onChange={(value) => patch({ driverId: value })} options={options?.drivers ?? []} />
        <SelectFilter label="Vehicle" value={filters.vehicleId} onChange={(value) => patch({ vehicleId: value })} options={options?.vehicles ?? []} />
        {!compact ? <SelectFilter label="Asset" value={filters.assetId} onChange={(value) => patch({ assetId: value })} options={options?.assets ?? []} /> : null}
        <SelectFilter label="Status" value={filters.status} onChange={(value) => patch({ status: value })} options={(options?.statuses ?? []).map((status) => ({ id: status, label: status }))} />
        {!compact ? <SelectFilter label="Supplier" value={filters.supplierId} onChange={(value) => patch({ supplierId: value })} options={options?.suppliers ?? []} /> : null}
        {!compact ? <SelectFilter label="Category" value={filters.category} onChange={(value) => patch({ category: value })} options={(options?.categories ?? []).map((category) => ({ id: category, label: category }))} /> : null}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block flex-1 text-xs font-medium text-slate-600">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 mt-1 text-slate-400" />
          <span className="sr-only">Search reports</span>
          <input
            value={filters.search}
            onChange={(event) => patch({ search: event.target.value })}
            placeholder="Search reports..."
            className="mt-1 w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-800"
          />
        </label>
        <button type="button" onClick={onReset} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
          Reset filters
        </button>
      </div>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800">
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ExportActions({ module, filters, isExporting, setIsExporting }: { module: ReportModuleSlug; filters: ReportFilters; isExporting: boolean; setIsExporting: (value: boolean) => void }) {
  async function handleExport(format: ReportExportFormat) {
    setIsExporting(true);
    try {
      await downloadReportExport(module, format, filters);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Report export failed."));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button type="button" disabled={isExporting} onClick={() => handleExport("csv")} title="Export CSV" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60">
        {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} CSV
      </button>
      <button type="button" disabled={isExporting} onClick={() => handleExport("xlsx")} title="Export Excel" className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60">
        <FileSpreadsheet size={15} /> Excel
      </button>
      <button type="button" disabled={isExporting} onClick={() => handleExport("pdf")} title="Export PDF" className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-60">
        <FileText size={15} /> PDF
      </button>
      <button type="button" onClick={() => window.print()} title="Print report" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
        <Printer size={15} /> Print
      </button>
    </div>
  );
}

export function ReportCharts({ charts }: { charts: ReportChart[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {charts.map((chart) => (
        <div key={chart.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid">
          <p className="text-sm font-semibold text-slate-900">{chart.title}</p>
          <div className="mt-3 h-72">
            <ChartRenderer chart={chart} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartRenderer({ chart }: { chart: ReportChart }) {
  if (!chart.data.length) {
    return <div className="grid h-full place-items-center text-sm text-slate-500">No chart data for this filter.</div>;
  }

  if (chart.type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie data={chart.data} dataKey={chart.valueKey ?? "value"} nameKey={chart.nameKey ?? "name"} outerRadius={92} innerRadius={46} paddingAngle={2}>
            {chart.data.map((_, index) => (
              <Cell key={index} fill={chartColors[index % chartColors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart.data} margin={{ top: 8, right: 8, left: -12, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={chart.xKey ?? "name"} tick={{ fontSize: 11, fill: "#64748b" }} angle={-15} textAnchor="end" height={48} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
          <Legend />
          {(chart.yKeys ?? ["value"]).map((key, index) => (
            <Bar key={key} dataKey={key} fill={chartColors[index % chartColors.length]} radius={[5, 5, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chart.data} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={chart.xKey ?? "period"} tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={18} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
        <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
        <Legend />
        {(chart.yKeys ?? ["value"]).map((key, index) => (
          <Line key={key} type="monotone" dataKey={key} stroke={chartColors[index % chartColors.length]} strokeWidth={2.5} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ReportTableView({ table, filters, onChange }: { table: ReportTable; filters: ReportFilters; onChange: (filters: ReportFilters) => void }) {
  function sortBy(columnKey: string) {
    const nextDirection = filters.sortBy === columnKey && filters.sortDirection === "desc" ? "asc" : "desc";
    onChange({ ...filters, sortBy: columnKey, sortDirection: nextDirection, page: 1 });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Report Details</p>
          <p className="text-xs text-slate-500">Searchable, sortable, paginated server-side results</p>
        </div>
        <select value={filters.pageSize} onChange={(event) => onChange({ ...filters, pageSize: Number(event.target.value), page: 1 })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 print:hidden">
          {[10, 15, 25, 50].map((size) => (
            <option key={size} value={size}>
              {size} rows
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {table.columns.map((column) => {
                const active = filters.sortBy === column.key;
                return (
                  <th key={column.key} className="px-4 py-3">
                    <button type="button" onClick={() => sortBy(column.key)} className="inline-flex items-center gap-1 font-semibold hover:text-slate-900 print:pointer-events-none">
                      {column.label}
                      {active ? filters.sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 ? (
              <tr>
                <td colSpan={table.columns.length} className="px-6 py-10 text-center text-sm text-slate-500">
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-slate-100 hover:bg-slate-50">
                  {table.columns.map((column) => (
                    <td key={column.key} className="max-w-[260px] truncate px-4 py-3 text-slate-700" title={formatReportValue(row[column.key], column.type)}>
                      {formatReportValue(row[column.key], column.type)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm print:hidden">
        <p className="text-slate-600">
          Showing <span className="font-semibold text-slate-900">{table.pagination.total === 0 ? 0 : (table.pagination.page - 1) * table.pagination.pageSize + 1}</span> to{" "}
          <span className="font-semibold text-slate-900">{Math.min(table.pagination.total, table.pagination.page * table.pagination.pageSize)}</span> of{" "}
          <span className="font-semibold text-slate-900">{table.pagination.total}</span>
        </p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={filters.page <= 1} onClick={() => onChange({ ...filters, page: filters.page - 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
            Previous
          </button>
          <span className="text-xs font-medium text-slate-600">
            Page {table.pagination.page} / {table.pagination.totalPages}
          </span>
          <button type="button" disabled={filters.page >= table.pagination.totalPages} onClick={() => onChange({ ...filters, page: filters.page + 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export function InsightsPanel({ insights, notes }: { insights: string[]; notes?: string[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 print:block">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Decision Signals</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          {insights.map((insight) => (
            <p key={insight} className="rounded-lg bg-slate-50 px-3 py-2">
              {insight}
            </p>
          ))}
        </div>
      </div>
      {notes?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-950">Data Coverage</p>
          <div className="mt-3 space-y-2 text-sm text-amber-900">
            {notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-state";

export function StatePanel({ type, title, message, onRetry }: { type: "loading" | "error" | "empty"; title: string; message: string; onRetry?: () => void }) {
  if (type === "loading") {
    return <LoadingState title={title} description={message} />;
  }

  if (type === "error") {
    return <ErrorState title={title} description={message} onRetry={onRetry} />;
  }

  return <EmptyState title={title} description={message} />;
}