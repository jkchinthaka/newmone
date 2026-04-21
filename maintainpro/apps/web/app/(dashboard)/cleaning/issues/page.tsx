"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";

interface IssueRow {
  id: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string;
  location?: { name: string } | null;
  reportedBy: { firstName: string; lastName: string };
}

const sevColor: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800"
};

export default function FacilityIssuesPage() {
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .get("/cleaning/issues")
      .then((res) => {
        setRows(res.data?.data ?? res.data ?? []);
        setError(null);
      })
      .catch((err: { response?: { data?: { message?: string } } }) => {
        setError(err?.response?.data?.message ?? "Failed to load issues");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/cleaning/issues", {
        title: String(fd.get("title") ?? ""),
        description: String(fd.get("description") ?? ""),
        severity: String(fd.get("severity") ?? "MEDIUM")
      });
      setOpen(false);
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "Failed to submit issue");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: IssueRow["status"]) => {
    try {
      await apiClient.patch(`/cleaning/issues/${id}`, { status });
      load();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "Failed to update issue");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Facility Issues</h1>
          <p className="text-sm text-slate-600">Report and track facility cleaning issues.</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {open ? "Cancel" : "+ Report issue"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {open ? (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              name="title"
              placeholder="Short title"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              name="severity"
              defaultValue="MEDIUM"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <textarea
            required
            name="description"
            placeholder="Describe the issue..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            disabled={submitting}
            type="submit"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit issue"}
          </button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reported by</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No issues reported.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.title}</div>
                    <div className="text-xs text-slate-500">
                      {r.location?.name ?? "No location"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${sevColor[r.severity]}`}
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      onChange={(e) => updateStatus(r.id, e.target.value as IssueRow["status"])}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.reportedBy.firstName} {r.reportedBy.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
