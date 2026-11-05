"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, Star } from "lucide-react";
import { toast } from "sonner";

import { DateField } from "@/components/forms/date-fields";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ActiveFilterChips } from "@/components/operational/active-filter-chips";
import { JobsPagination } from "@/components/operational/jobs-pagination";
import { OperationalPageHeader } from "@/components/operational/operational-page-header";
import { DonutChart } from "@/components/ui/donut-chart";
import { BarList, EmptyState, ErrorState, KpiCard, SectionCard, SkeletonCard } from "@/components/ui/dashboard";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  REPORT_EMPTY,
  REPORT_PAGE_DESCRIPTION,
  REPORT_PIN_LIMIT,
  pinReport,
  readReportPins,
  reportModuleFromSearch,
  reportRowHref,
  unpinReport,
  visiblePinnedReports,
  visibleReportModules,
  writeReportPins,
  type RetainedReportSlug
} from "@/lib/report-workspace";
import { useCurrentUser } from "@/lib/use-current-user";

import { defaultReportFilters, downloadReportExport, getReportModule, toQueryParams } from "./api";
import { ReportFilters } from "./types";

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

const toDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: "7", label: "Last 7 days", range: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 6); return [toDate(s), toDate(e)]; } },
  { key: "30", label: "Last 30 days", range: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 29); return [toDate(s), toDate(e)]; } },
  { key: "90", label: "Last 90 days", range: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 89); return [toDate(s), toDate(e)]; } },
  { key: "month", label: "This month", range: () => { const e = new Date(); return [toDate(new Date(e.getFullYear(), e.getMonth(), 1)), toDate(e)]; } },
  { key: "year", label: "This year", range: () => { const e = new Date(); return [toDate(new Date(e.getFullYear(), 0, 1)), toDate(e)]; } }
];

const PILL: Record<string, string> = {
  CLOSED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  TECHNICIAN_COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-600",
  ON_HOLD: "bg-amber-100 text-amber-700",
  ASSIGNED: "bg-sky-100 text-sky-700",
  OPEN: "bg-brand-50 text-brand-700",
  IN_PROGRESS: "bg-brand-50 text-brand-700"
};

function Cell({ column, value }: { column: string; value: unknown }) {
  const text = value === null || value === undefined || value === "" ? "—" : String(value);
  if (/status/i.test(column) && PILL[text]) {
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[text]}`}>{text.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>;
  }
  return <>{text}</>;
}

export function ReportsDashboardPage() {
  const user = useCurrentUser();
  const isAdmin = ADMIN_ROLES.has(user.role ?? "");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const modules = visibleReportModules(user.role, user.permissions);
  const moduleSlug = reportModuleFromSearch(params.get("module"), user.role, user.permissions);
  const [pins, setPins] = useState<RetainedReportSlug[]>([]);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>(() => ({
    ...defaultReportFilters(),
    pageSize: 25,
    search: params.get("search") ?? "",
    status: params.get("status") ?? "",
    category: params.get("category") ?? "",
    startDate: params.get("from") ?? defaultReportFilters().startDate,
    endDate: params.get("to") ?? defaultReportFilters().endDate
  }));
  const [draft, setDraft] = useState(filters.search);
  const [more, setMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  const query = useQuery({
    queryKey: ["reports", "workspace", moduleSlug, filters],
    queryFn: () => getReportModule(moduleSlug, filters)
  });
  const templates = useQuery({
    queryKey: ["reports", "templates"],
    queryFn: async () => {
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.get<{ data?: Array<{ id: string; name: string; reportType: RetainedReportSlug; defaultStatus: string; exportFormat: "csv" | "xlsx" }> }>("/reports/templates");
      return response.data.data ?? [];
    }
  });

  useEffect(() => {
    setPins(visiblePinnedReports(readReportPins(user.id, user.tenantId, window.localStorage), user.role, user.permissions));
  }, [user.id, user.tenantId, user.role, user.permissions]);

  function togglePin(slug: RetainedReportSlug) {
    const stored = readReportPins(user.id, user.tenantId, window.localStorage);
    if (pins.includes(slug)) {
      const saved = unpinReport(stored, slug);
      writeReportPins(user.id, user.tenantId, saved, window.localStorage);
      setPins(visiblePinnedReports(saved, user.role, user.permissions));
      setPinMessage(null);
    } else {
      const next = pinReport(stored, slug, user.role, user.permissions);
      if (!next.ok) {
        setPinMessage(`You can pin up to ${REPORT_PIN_LIMIT} reports. Unpin one before adding another.`);
        return;
      }
      writeReportPins(user.id, user.tenantId, next.pins, window.localStorage);
      setPins(next.pins);
      setPinMessage(null);
    }
    window.dispatchEvent(new CustomEvent("maintainpro-report-pins-changed"));
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = draft.trim();
      const applied = next.length < 2 ? "" : next;
      if (applied === filters.search) return;
      setFilters((current) => ({ ...current, search: applied, page: 1 }));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draft]);

  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    next.set("module", moduleSlug);
    if (filters.search) next.set("search", filters.search);
    else next.delete("search");
    if (filters.status) next.set("status", filters.status);
    else next.delete("status");
    if (filters.category) next.set("category", filters.category);
    else next.delete("category");
    if (filters.startDate) next.set("from", filters.startDate);
    if (filters.endDate) next.set("to", filters.endDate);
    const qs = next.toString();
    if (qs !== params.toString()) router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  }, [filters.search, filters.status, filters.category, filters.startDate, filters.endDate, moduleSlug]);

  const report = query.data;
  const rows = report?.table.rows ?? [];
  const columns = (report?.table.columns ?? []).filter((column) => column.exportable !== false);

  const chips = [
    filters.startDate || filters.endDate ? { key: "dates", label: `${filters.startDate} – ${filters.endDate}` } : null,
    filters.status ? { key: "status", label: filters.status } : null,
    filters.category ? { key: "category", label: filters.category } : null,
    filters.search ? { key: "search", label: filters.search } : null,
    filters.departmentId ? { key: "departmentId", label: "Department" } : null,
    filters.assetId ? { key: "assetId", label: "Asset" } : null,
    filters.vehicleId ? { key: "vehicleId", label: "Vehicle" } : null,
    filters.userId ? { key: "userId", label: "Technician" } : null,
    filters.supplierId ? { key: "supplierId", label: "Vendor" } : null
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));

  async function exportReport(format: "csv" | "xlsx") {
    setExporting(true);
    try {
      await downloadReportExport(moduleSlug, format, filters);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "The report could not be downloaded."));
    } finally {
      setExporting(false);
    }
  }

  async function saveTemplate() {
    try {
      const { apiClient } = await import("@/lib/api-client");
      await apiClient.post("/reports/templates", {
        name: templateName,
        reportType: moduleSlug,
        description: "Saved from the reports workspace.",
        columns: columns.map((column) => column.key).slice(0, 8),
        exportFormat: "xlsx",
        defaultStatus: filters.status
      });
      toast.success("Report template saved.");
      setTemplateName("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "The template could not be saved."));
    }
  }

  function clearFilters() {
    const next = defaultReportFilters();
    next.pageSize = 25;
    setFilters(next);
    setDraft("");
  }

  return (
    <div className="min-w-0 space-y-3 p-4 md:p-6">
      <PageBreadcrumbs />
      <OperationalPageHeader
        title="Reports"
        description={REPORT_PAGE_DESCRIPTION}
        actions={
          <>
            <div className="relative">
              <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium" disabled={exporting} aria-busy={exporting} aria-expanded={exportOpen} onClick={() => setExportOpen((o) => !o)}>
                {exporting ? "Preparing export…" : "Export"} <ChevronDown size={14} />
              </button>
              {exportOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setExportOpen(false); void exportReport("csv"); }}>CSV</button>
                  <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setExportOpen(false); void exportReport("xlsx"); }}>Excel</button>
                </div>
              ) : null}
            </div>
            <button type="button" className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700" onClick={() => query.refetch()}>
              Generate report
            </button>
          </>
        }
      />
      {query.dataUpdatedAt ? <p className="text-xs text-slate-500">Loaded {new Date(query.dataUpdatedAt).toLocaleString()}.</p> : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-slate-200">
        <div className="flex flex-wrap gap-x-6" role="tablist" aria-label="Report category">
          {modules.map((item) => (
            <button
              key={item.slug}
              type="button"
              role="tab"
              aria-selected={moduleSlug === item.slug}
              className={`-mb-px min-h-11 border-b-2 px-1 text-sm ${moduleSlug === item.slug ? "border-brand-600 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              onClick={() => {
                const next = new URLSearchParams(params.toString());
                next.set("module", item.slug);
                router.replace(`${pathname}?${next.toString()}` as Route);
                setFilters((current) => ({ ...current, page: 1 }));
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 pb-1">
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-100"
            aria-pressed={pins.includes(moduleSlug)}
            onClick={() => togglePin(moduleSlug)}
          >
            <Star size={14} className={pins.includes(moduleSlug) ? "fill-amber-400 text-amber-500" : ""} />
            {pins.includes(moduleSlug) ? "Pinned to sidebar" : "Pin to sidebar"}
          </button>
          <select
            aria-label="Saved report"
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
            defaultValue=""
            onChange={(event) => {
              const template = (templates.data ?? []).find((item) => item.id === event.target.value);
              if (!template) return;
              const next = new URLSearchParams(params.toString());
              next.set("module", template.reportType);
              router.replace(`${pathname}?${next.toString()}` as Route);
              setFilters((current) => ({ ...current, status: template.defaultStatus, page: 1 }));
            }}
          >
            <option value="">Saved reports</option>
            {(templates.data ?? []).filter((template) => modules.some((item) => item.slug === template.reportType)).map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>
      </div>
      {pinMessage ? (
        <p className="text-sm text-amber-900" role="status">
          {pinMessage}
        </p>
      ) : null}

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading report">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : report?.summaryCards?.length ? (
        <div className={`grid gap-3 sm:grid-cols-2 ${report.summaryCards.length >= 5 ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
          {report.summaryCards.map((card) => (
            <KpiCard key={card.label} label={card.label} value={String(card.value)} delta={card.subLabel} tone={card.tone === "danger" ? "red" : card.tone === "warning" ? "amber" : card.tone === "success" ? "emerald" : "neutral"} />
          ))}
        </div>
      ) : null}

      {report?.charts?.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {report.charts.map((chart) => {
            const nameKey = chart.xKey ?? chart.nameKey ?? "name";
            const valueKey = chart.yKeys?.[0] ?? chart.valueKey ?? "value";
            const chartItems = chart.data.map((row, index) => ({ name: String(row[nameKey] ?? index), value: Number(row[valueKey] ?? 0) || 0 }));
            // A chart with one value (e.g. everything "Unassigned") says nothing; hide it.
            if (chartItems.filter((item) => item.value > 0).length < 2) return null;
            return (
              <SectionCard key={chart.id} title={chart.title}>
                <BarList items={chartItems} />
              </SectionCard>
            );
          })}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 p-2">
          <select
            aria-label="Date range"
            className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm"
            value={PRESETS.find((p) => { const [f, t] = p.range(); return f === filters.startDate && t === filters.endDate; })?.key ?? "custom"}
            onChange={(event) => {
              const preset = PRESETS.find((p) => p.key === event.target.value);
              if (!preset) return;
              const [startDate, endDate] = preset.range();
              setFilters({ ...filters, startDate, endDate, page: 1 });
            }}
          >
            {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            <option value="custom">Custom range</option>
          </select>
          <select aria-label="Job status" className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}>
            <option value="">Status</option>
            {(report?.filterOptions.statuses ?? ["OPEN", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"]).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <input aria-label="Category" placeholder="Category" className="h-10 w-32 rounded-md border px-2 text-sm" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value, page: 1 })} />
          <div className="relative min-w-[12rem] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input aria-label="Search reports" placeholder="Job, asset, vehicle, technician" className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-2 text-sm" value={draft} onChange={(event) => setDraft(event.target.value)} />
          </div>
          <button type="button" className="h-10 px-2 text-sm font-medium" aria-expanded={more} onClick={() => setMore((open) => !open)}>
            More filters
          </button>
        </div>
        {more ? (
          <div className="grid gap-2 border-t border-slate-100 p-2 sm:grid-cols-2 lg:grid-cols-3">
            <DateField bare label="Date from" value={filters.startDate} onChange={(startDate) => setFilters({ ...filters, startDate, page: 1 })} />
            <DateField bare label="Date to" value={filters.endDate} onChange={(endDate) => setFilters({ ...filters, endDate, page: 1 })} />
            <select aria-label="Asset" className="h-10 rounded-md border px-2 text-sm" value={filters.assetId} onChange={(event) => setFilters({ ...filters, assetId: event.target.value, page: 1 })}>
              <option value="">Asset</option>
              {(report?.filterOptions.assets ?? []).filter((item) => item.type === "asset").map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <select aria-label="Vehicle" className="h-10 rounded-md border px-2 text-sm" value={filters.vehicleId} onChange={(event) => setFilters({ ...filters, vehicleId: event.target.value, page: 1 })}>
              <option value="">Vehicle</option>
              {(report?.filterOptions.vehicles ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <select aria-label="Department" className="h-10 rounded-md border px-2 text-sm" value={filters.departmentId} onChange={(event) => setFilters({ ...filters, departmentId: event.target.value, page: 1 })}>
              <option value="">Department</option>
              {(report?.filterOptions.departments ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <select aria-label="Technician" className="h-10 rounded-md border px-2 text-sm" value={filters.userId} onChange={(event) => setFilters({ ...filters, userId: event.target.value, page: 1 })}>
              <option value="">Technician</option>
              {(report?.filterOptions.users ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <select aria-label="Vendor" className="h-10 rounded-md border px-2 text-sm" value={filters.supplierId} onChange={(event) => setFilters({ ...filters, supplierId: event.target.value, page: 1 })}>
              <option value="">Vendor</option>
              {(report?.filterOptions.suppliers ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
        ) : null}
        {more && isAdmin ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-2 py-2">
            <input aria-label="Template name" placeholder="Template name" className="h-10 rounded-md border px-2 text-sm" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            <button type="button" className="h-10 rounded-lg border px-3 text-sm font-medium" onClick={saveTemplate}>
              Save template
            </button>
            <p className="text-xs text-slate-500">Templates store layout and filters only. Uploaded spreadsheets are not executed.</p>
          </div>
        ) : null}
        <ActiveFilterChips
          chips={chips}
          onRemove={(key) => {
            if (key === "dates") setFilters({ ...filters, startDate: "", endDate: "", page: 1 });
            else if (key === "search") {
              setDraft("");
              setFilters({ ...filters, search: "", page: 1 });
            } else setFilters({ ...filters, [key]: "", page: 1 });
          }}
          onClearAll={clearFilters}
        />

        {query.isLoading ? (
          <div className="p-4" aria-busy="true"><SkeletonCard /></div>
        ) : query.isError ? (
          <div className="p-4">
            <ErrorState message={`We couldn't load this report. ${getApiErrorMessage(query.error, "The report could not be loaded.")}`} onRetry={() => query.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4"><EmptyState title={REPORT_EMPTY} description="Clear the filters or choose another report." action={<button type="button" className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" onClick={clearFilters}>Clear filters</button>} /></div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-y border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    {columns.map((column, index) => (
                      <th key={column.key} className={`px-3 py-2 ${index > 4 ? "hidden lg:table-cell" : ""}`}>{column.label}</th>
                    ))}
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const href = reportRowHref(row);
                    return (
                      <tr key={String(row.workOrderId ?? row.woNumber ?? index)} className="border-b border-slate-100">
                        {columns.map((column, index) => (
                          <td key={column.key} className={`px-3 py-2 text-slate-800 ${index > 4 ? "hidden lg:table-cell" : ""}`}><Cell column={column.key} value={row[column.key]} /></td>
                        ))}
                        <td className="px-3 py-2">
                          {href ? (
                            <Link href={href as Route} className="font-semibold text-brand-600 hover:underline">Open →</Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((row, index) => {
                const href = reportRowHref(row);
                const body = (
                  <>
                    <p className="font-medium text-slate-900">{columns[0] ? String(row[columns[0].key] ?? "—") : "—"}</p>
                    <p className="text-sm text-slate-700">{columns[1] ? String(row[columns[1].key] ?? "") : ""}</p>
                  </>
                );
                return (
                  <li key={String(row.workOrderId ?? index)} className="px-3 py-3">
                    {href ? <Link href={href as Route}>{body}</Link> : body}
                  </li>
                );
              })}
            </ul>
            <JobsPagination
              page={report?.table.pagination.page ?? filters.page}
              totalPages={Math.max(report?.table.pagination.totalPages ?? 1, 1)}
              total={report?.table.pagination.total ?? rows.length}
              pageSize={filters.pageSize}
              onPageChange={(page) => setFilters({ ...filters, page })}
              onPageSizeChange={(pageSize) => setFilters({ ...filters, pageSize, page: 1 })}
            />
          </>
        )}
      </section>
      <p className="text-xs text-slate-500">
        Export uses the selected filters on the server, up to the export cap, and does not read only the rows on this page.
        {toQueryParams(filters).search ? "" : ""}
      </p>
    </div>
  );
}
