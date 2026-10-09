"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ActiveFilterChips } from "@/components/operational/active-filter-chips";
import { JobsPagination } from "@/components/operational/jobs-pagination";
import { OperationalEmptyState, TableLoadingRows } from "@/components/operational/operational-list-states";
import { OperationalPageHeader } from "@/components/operational/operational-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  OPERATIONS_COMPLETION_RATE_DEFINITION,
  REPORT_EMPTY,
  reportRowHref,
  visibleWorkspaceModules,
  workspaceModuleFromSearch,
  type WorkspaceModule
} from "@/lib/report-workspace";
import { useCurrentUser } from "@/lib/use-current-user";

import { defaultReportFilters, downloadReportExport, getReportModule, toQueryParams } from "./api";
import { ReportFilters } from "./types";

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

export function ReportsDashboardPage() {
  const user = useCurrentUser();
  const isAdmin = ADMIN_ROLES.has(user.role ?? "");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const modules = visibleWorkspaceModules(user.role, user.permissions);
  const requestedModule = workspaceModuleFromSearch(params.get("module"));
  const moduleSlug = modules.some((item) => item.slug === requestedModule) ? requestedModule : "operations";
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

  const query = useQuery({
    queryKey: ["reports", "workspace", moduleSlug, filters],
    queryFn: () => getReportModule(moduleSlug, filters)
  });
  const templates = useQuery({
    queryKey: ["reports", "templates"],
    queryFn: async () => {
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.get<{ data?: Array<{ id: string; name: string; reportType: WorkspaceModule; defaultStatus: string; exportFormat: "csv" | "xlsx" }> }>("/reports/templates");
      return response.data.data ?? [];
    }
  });

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
        eyebrow="Reports"
        title="Reports"
        description="Live work-order reporting. Numbers use the same server query as the export."
        actions={
          <>
            <button type="button" className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium" onClick={() => query.refetch()}>
              Generate report
            </button>
            <button type="button" className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium" disabled={exporting} onClick={() => exportReport("csv")}>
              CSV
            </button>
            <button type="button" className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium" disabled={exporting} onClick={() => exportReport("xlsx")}>
              Excel
            </button>
          </>
        }
      />
      <p className="text-xs text-slate-500">{OPERATIONS_COMPLETION_RATE_DEFINITION}</p>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report category">
        {modules.map((item) => (
          <button
            key={item.slug}
            type="button"
            role="tab"
            aria-selected={moduleSlug === item.slug}
            className={`h-9 rounded-md px-3 text-sm ${moduleSlug === item.slug ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"}`}
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
        <select
          aria-label="Saved report"
          className="h-9 rounded-md border border-slate-300 px-2 text-sm"
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
          {(templates.data ?? []).map((template) => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </select>
        <Link href={"/reports/operations" as Route} className="inline-flex h-9 items-center px-2 text-sm text-brand-700">
          All report modules
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 p-2">
          <input aria-label="Date from" type="date" className="h-10 rounded-md border px-2 text-sm" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value, page: 1 })} />
          <input aria-label="Date to" type="date" className="h-10 rounded-md border px-2 text-sm" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value, page: 1 })} />
          <select aria-label="Work order status" className="h-10 rounded-md border px-2 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}>
            <option value="">Status</option>
            {(report?.filterOptions.statuses ?? ["OPEN", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"]).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <input aria-label="Category" placeholder="Category" className="h-10 w-32 rounded-md border px-2 text-sm" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value, page: 1 })} />
          <input aria-label="Search reports" placeholder="WO, asset, vehicle, technician" className="h-10 min-w-[12rem] flex-1 rounded-md border px-2 text-sm" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <button type="button" className="h-10 px-2 text-sm font-medium" aria-expanded={more} onClick={() => setMore((open) => !open)}>
            More filters
          </button>
        </div>
        {more ? (
          <div className="grid gap-2 border-t border-slate-100 p-2 sm:grid-cols-2 lg:grid-cols-3">
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

        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-2 py-2">
            <input aria-label="Template name" placeholder="Template name" className="h-10 rounded-md border px-2 text-sm" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            <button type="button" className="h-10 rounded-lg border px-3 text-sm font-medium" onClick={saveTemplate}>
              Save template
            </button>
            <p className="text-xs text-slate-500">Templates store layout and filters only. Uploaded spreadsheets are not executed.</p>
          </div>
        ) : null}

        {query.isLoading ? (
          <TableLoadingRows label="Loading report" />
        ) : query.isError ? (
          <div className="p-4">
            <ErrorState title="We couldn't load this report." description={getApiErrorMessage(query.error, "The report could not be loaded.")} onRetry={() => query.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <OperationalEmptyState title={REPORT_EMPTY} onClear={clearFilters} />
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
                          <td key={column.key} className={`px-3 py-2 text-slate-800 ${index > 4 ? "hidden lg:table-cell" : ""}`}>{row[column.key] ?? "—"}</td>
                        ))}
                        <td className="px-3 py-2">
                          {href ? (
                            <Link href={href as Route} className="font-medium text-brand-700">Open</Link>
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
