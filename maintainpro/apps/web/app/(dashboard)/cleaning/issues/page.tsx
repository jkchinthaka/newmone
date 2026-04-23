"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "@/lib/api-client";

interface LocationOption {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface IssueRow {
  id: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string;
  slaTargetAt?: string | null;
  resolutionMinutes?: number | null;
  photos?: string[];
  location?: { name: string } | null;
  reportedBy: { firstName: string; lastName: string };
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
}

const severityStyles: Record<IssueRow["severity"], string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800"
};

export default function FacilityIssuesPage() {
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient.get("/cleaning/issues"),
      apiClient.get("/cleaning/locations"),
      apiClient.get("/cleaning/users/cleaners")
    ])
      .then(([issuesRes, locationsRes, staffRes]) => {
        setRows(issuesRes.data?.data ?? []);
        setLocations(
          (locationsRes.data?.data ?? []).map((location: { id: string; name: string }) => ({
            id: location.id,
            name: location.name
          }))
        );
        setStaff(staffRes.data?.data ?? []);
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post("/cleaning/issues", {
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        severity: String(formData.get("severity") ?? "MEDIUM"),
        locationId: String(formData.get("locationId") ?? "") || undefined,
        assignedToId: String(formData.get("assignedToId") ?? "") || undefined,
        slaHours: Number(formData.get("slaHours") ?? 24),
        photos: String(formData.get("photos") ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      });

      setOpen(false);
      event.currentTarget.reset();
      load();
    } catch (err) {
      const typedError = err as { response?: { data?: { message?: string } } };
      setError(typedError?.response?.data?.message ?? "Failed to submit issue");
    } finally {
      setSubmitting(false);
    }
  };

  const updateIssue = async (id: string, payload: Partial<{ status: IssueRow["status"]; assignedToId: string }>) => {
    try {
      await apiClient.patch(`/cleaning/issues/${id}`, payload);
      load();
    } catch (err) {
      const typedError = err as { response?: { data?: { message?: string } } };
      setError(typedError?.response?.data?.message ?? "Failed to update issue");
    }
  };

  const summary = useMemo(() => {
    const totalOpen = rows.filter((row) => row.status === "OPEN").length;
    const inProgress = rows.filter((row) => row.status === "IN_PROGRESS").length;
    const breached = rows.filter((row) => {
      if (!row.slaTargetAt) {
        return false;
      }

      const slaTime = new Date(row.slaTargetAt).getTime();
      return (
        slaTime < Date.now() &&
        row.status !== "RESOLVED" &&
        row.status !== "CLOSED"
      );
    }).length;

    return { totalOpen, inProgress, breached };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Issue Management</h1>
          <p className="text-sm text-slate-600">
            Track facility issues across OPEN → IN_PROGRESS → RESOLVED → CLOSED with SLA monitoring.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Open: {summary.totalOpen}</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">In progress: {summary.inProgress}</span>
            <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">SLA breached: {summary.breached}</span>
          </div>
        </div>

        <button
          onClick={() => setOpen((value) => !value)}
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <select
              name="locationId"
              defaultValue=""
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">No location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <select
              name="assignedToId"
              defaultValue=""
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
            <input
              type="number"
              name="slaHours"
              min={1}
              max={720}
              defaultValue={24}
              placeholder="SLA hours"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <textarea
            required
            name="description"
            placeholder="Describe the issue..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          <textarea
            name="photos"
            rows={2}
            placeholder="Photo URLs (one per line)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          <button
            disabled={submitting}
            type="submit"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit issue"}
          </button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Issue</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3">Reported by</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No issues reported.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const slaBreached =
                  row.slaTargetAt &&
                  new Date(row.slaTargetAt).getTime() < Date.now() &&
                  row.status !== "RESOLVED" &&
                  row.status !== "CLOSED";

                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.title}</div>
                      <div className="text-xs text-slate-500">{row.location?.name ?? "No location"}</div>
                      {row.photos?.length ? (
                        <div className="mt-1 text-xs text-sky-700">{row.photos.length} image(s)</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${severityStyles[row.severity]}`}>
                        {row.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.status}
                        onChange={(event) =>
                          void updateIssue(row.id, { status: event.target.value as IssueRow["status"] })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.assignedTo?.id ?? ""}
                        onChange={(event) =>
                          void updateIssue(row.id, { assignedToId: event.target.value || "" })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="">Unassigned</option>
                        {staff.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.firstName} {member.lastName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className={slaBreached ? "text-red-700" : "text-slate-600"}>
                        {row.slaTargetAt ? new Date(row.slaTargetAt).toLocaleString() : "No SLA"}
                      </p>
                      {row.resolutionMinutes ? (
                        <p className="text-slate-500">Resolved in {row.resolutionMinutes} min</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.reportedBy.firstName} {row.reportedBy.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
