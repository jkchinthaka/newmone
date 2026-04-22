"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { apiClient } from "@/lib/api-client";

interface LocationOption {
  id: string;
  name: string;
}

interface VisitRow {
  id: string;
  scannedAt: string;
  status: string;
  method: string;
  notes?: string | null;
  location: {
    id: string;
    name: string;
    area: string;
    building?: string | null;
    floor?: string | null;
  };
  cleaner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface VisitResponse {
  items: VisitRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const statusBadge: Record<string, string> = {
  IN_PROGRESS: "bg-slate-100 text-slate-700",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  PENDING_VERIFICATION: "bg-amber-100 text-amber-800",
  SUBMITTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800"
};

export default function CleaningVisitsPage() {
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({
    date: new Date().toISOString().slice(0, 10),
    locationId: "",
    cleanedBy: "",
    status: ""
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<VisitResponse["pagination"]>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });

  const requestParams = useMemo(
    () => ({
      ...appliedFilters,
      page,
      pageSize: 20
    }),
    [appliedFilters, page]
  );

  const loadLocations = useCallback(() => {
    apiClient
      .get("/cleaning/locations")
      .then((response) => {
        const data = response.data?.data ?? [];
        setLocations(data.map((item: LocationOption) => ({ id: item.id, name: item.name })));
      })
      .catch(() => {
        setLocations([]);
      });
  }, []);

  const loadVisits = useCallback(() => {
    setLoading(true);

    apiClient
      .get("/cleaning/visits", {
        params: requestParams
      })
      .then((response) => {
        const data = (response.data?.data ?? { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } }) as VisitResponse;
        setRows(data.items ?? []);
        setPagination(data.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 });
        setError(null);
      })
      .catch((err: { response?: { data?: { message?: string } } }) => {
        setError(err?.response?.data?.message ?? "Failed to load visits");
      })
      .finally(() => setLoading(false));
  }, [requestParams]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  const exportToExcel = async () => {
    setExporting(true);
    setError(null);

    try {
      const response = await apiClient.get("/cleaning/visits/export", {
        params: appliedFilters,
        responseType: "blob"
      });

      const url = window.URL.createObjectURL(response.data as Blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cleaning-visits-${appliedFilters.date || new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const typedError = err as { response?: { data?: { message?: string } } };
      setError(typedError?.response?.data?.message ?? "Failed to export visits");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Cleaning Visits</h1>
            <p className="text-sm text-slate-600">
              Monitor every QR cleaning visit by date, location, and cleaner.
            </p>
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Download size={16} />
            {exporting ? "Exporting..." : "Export to Excel"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-600">
            <span className="mb-1 block">Date</span>
            <input
              type="date"
              value={filters.date}
              onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm text-slate-600">
            <span className="mb-1 block">Location</span>
            <select
              value={filters.locationId}
              onChange={(event) => setFilters((current) => ({ ...current, locationId: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-600">
            <span className="mb-1 block">Cleaner</span>
            <input
              value={filters.cleanedBy}
              onChange={(event) => setFilters((current) => ({ ...current, cleanedBy: event.target.value }))}
              placeholder="Name, email, or user ID"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm text-slate-600">
            <span className="mb-1 block">Status</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="IN_PROGRESS">In Progress</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setAppliedFilters(filters);
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              const reset = {
                date: new Date().toISOString().slice(0, 10),
                locationId: "",
                cleanedBy: "",
                status: ""
              };
              setFilters(reset);
              setAppliedFilters(reset);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Cleaned By</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading visits...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No visits found for the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{row.location.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {[row.location.area, row.location.building, row.location.floor]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <div>
                        {row.cleaner.firstName} {row.cleaner.lastName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{row.cleaner.email}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{new Date(row.scannedAt).toLocaleString()}</td>
                    <td className="px-4 py-4 text-slate-700">{row.method}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          statusBadge[row.status] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{row.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <p>
            Showing page {pagination.page} of {pagination.totalPages} · {pagination.total} total visits
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}