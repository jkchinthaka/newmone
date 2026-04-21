"use client";

import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";

interface VisitRow {
  id: string;
  scannedAt: string;
  status: string;
  location: { id: string; name: string; area: string };
  cleaner: { firstName: string; lastName: string; email: string };
  signedOffBy?: { firstName: string; lastName: string } | null;
}

const statusBadge: Record<string, string> = {
  IN_PROGRESS: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800"
};

export default function CleaningVisitsPage() {
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/cleaning/visits", { params: status ? { status } : {} })
      .then((res) => setRows(res.data?.data ?? res.data ?? []))
      .then(() => setError(null))
      .catch((err: { response?: { data?: { message?: string } } }) => {
        setError(err?.response?.data?.message ?? "Failed to load visits");
      })
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cleaning Visits</h1>
          <p className="text-sm text-slate-600">All QR-scanned cleaning visits.</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Cleaner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Signed off by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No visits found.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-slate-700">
                    {new Date(r.scannedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.location.name}</div>
                    <div className="text-xs text-slate-500">{r.location.area}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.cleaner.firstName} {r.cleaner.lastName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        statusBadge[r.status] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.signedOffBy
                      ? `${r.signedOffBy.firstName} ${r.signedOffBy.lastName}`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
