"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { FacilityIssueRoomSelector } from "@/components/cleaning/facility-issue-room-selector";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  buildCreateFacilityIssuePayload,
  buildUpdateFacilityIssueRoomPayload,
  FACILITY_ISSUE_CATEGORY_OPTIONS,
  filterIssuesByCategory,
  formatFacilityIssueCategory,
  getFacilityIssueLocationDetail,
  getFacilityIssueLocationLabel,
  issueRoomSelectionFromRow,
  roomSelectionToRoomId,
  type FacilityIssueCategory,
  type FacilityIssueRoomSelection,
  type FacilityIssueRow,
  type FacilityIssueSeverity,
  type FacilityIssueStatus
} from "@/lib/facility-issue-ui";

interface LocationOption {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
}

const severityStyles: Record<FacilityIssueSeverity, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800"
};

export function FacilityIssuesPage() {
  const [rows, setRows] = useState<FacilityIssueRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<FacilityIssueCategory | "ALL">("ALL");
  const [createRoomSelection, setCreateRoomSelection] = useState<Partial<FacilityIssueRoomSelection>>({});
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editRoomSelection, setEditRoomSelection] = useState<Partial<FacilityIssueRoomSelection>>({});
  const [editCategory, setEditCategory] = useState<string>("");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

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
      .catch((err: unknown) => {
        setError(getApiErrorMessage(err, "Failed to load issues"));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(
    () => filterIssuesByCategory(rows, categoryFilter),
    [categoryFilter, rows]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setSubmitting(true);
    setError(null);

    try {
      const payload = buildCreateFacilityIssuePayload({
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        severity: String(formData.get("severity") ?? "MEDIUM"),
        locationId: String(formData.get("locationId") ?? "") || undefined,
        roomId: roomSelectionToRoomId(createRoomSelection),
        category: String(formData.get("category") ?? ""),
        assignedToId: String(formData.get("assignedToId") ?? "") || undefined,
        slaHours: Number(formData.get("slaHours") ?? 24),
        photos: String(formData.get("photos") ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      });

      await apiClient.post("/cleaning/issues", payload);

      setOpen(false);
      setCreateRoomSelection({});
      event.currentTarget.reset();
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit issue"));
    } finally {
      setSubmitting(false);
    }
  };

  const updateIssue = async (
    id: string,
    payload: Partial<{ status: FacilityIssueStatus; assignedToId: string }>
  ) => {
    try {
      await apiClient.patch(`/cleaning/issues/${id}`, payload);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update issue"));
    }
  };

  const startEditIssue = (row: FacilityIssueRow) => {
    setEditingIssueId(row.id);
    setEditRoomSelection(issueRoomSelectionFromRow(row));
    setEditCategory(row.category ?? "");
  };

  const cancelEditIssue = () => {
    setEditingIssueId(null);
    setEditRoomSelection({});
    setEditCategory("");
  };

  const saveIssueLink = async (row: FacilityIssueRow) => {
    setSavingEditId(row.id);
    setError(null);

    try {
      const roomId = editRoomSelection.roomId?.trim() ? editRoomSelection.roomId : null;
      await apiClient.patch(
        `/cleaning/issues/${row.id}`,
        buildUpdateFacilityIssueRoomPayload({
          roomId,
          category: editCategory
        })
      );
      cancelEditIssue();
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update issue link"));
    } finally {
      setSavingEditId(null);
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
      return slaTime < Date.now() && row.status !== "RESOLVED" && row.status !== "CLOSED";
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
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
              In progress: {summary.inProgress}
            </span>
            <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">SLA breached: {summary.breached}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {open ? "Cancel" : "+ Report issue"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <span className="font-medium">Category filter</span>
          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value as FacilityIssueCategory | "ALL")
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="ALL">All categories</option>
            {FACILITY_ISSUE_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500">
          Showing {filteredRows.length} of {rows.length} issue{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      {open ? (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Title</span>
              <input
                required
                name="title"
                placeholder="Short title"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Severity</span>
              <select
                name="severity"
                defaultValue="MEDIUM"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Category (optional)</span>
              <select
                name="category"
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">No category</option>
                {FACILITY_ISSUE_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Cleaning location (optional)</span>
              <select
                name="locationId"
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">No location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Assign to</span>
              <select
                name="assignedToId"
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">SLA hours</span>
              <input
                type="number"
                name="slaHours"
                min={1}
                max={720}
                defaultValue={24}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <FacilityIssueRoomSelector
            idPrefix="create-issue-room"
            value={createRoomSelection}
            onChange={setCreateRoomSelection}
            disabled={submitting}
          />

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Description</span>
            <textarea
              required
              name="description"
              placeholder="Describe the issue..."
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Photo URLs (optional)</span>
            <textarea
              name="photos"
              rows={2}
              placeholder="Photo URLs (one per line)"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">Category</th>
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
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No issues reported.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const slaBreached =
                    row.slaTargetAt &&
                    new Date(row.slaTargetAt).getTime() < Date.now() &&
                    row.status !== "RESOLVED" &&
                    row.status !== "CLOSED";
                  const locationDetail = getFacilityIssueLocationDetail(row);
                  const isEditing = editingIssueId === row.id;

                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{row.title}</div>
                          <div className="text-xs text-slate-500">
                            {getFacilityIssueLocationLabel(row)}
                            {row.roomId && row.location?.name ? (
                              <span className="text-slate-400"> · legacy: {row.location.name}</span>
                            ) : null}
                          </div>
                          {locationDetail ? (
                            <div className="mt-0.5 text-xs text-slate-400">{locationDetail}</div>
                          ) : null}
                          {row.photos?.length ? (
                            <div className="mt-1 text-xs text-sky-700">{row.photos.length} image(s)</div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => (isEditing ? cancelEditIssue() : startEditIssue(row))}
                            className="mt-2 text-xs font-medium text-brand-700 hover:text-brand-800"
                          >
                            {isEditing ? "Cancel link edit" : "Edit room/category"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {row.category ? (
                            <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800">
                              {formatFacilityIssueCategory(row.category)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${severityStyles[row.severity]}`}
                          >
                            {row.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={row.status}
                            onChange={(event) =>
                              void updateIssue(row.id, {
                                status: event.target.value as FacilityIssueStatus
                              })
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
                        <td className="px-4 py-3 text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
                      </tr>
                      {isEditing ? (
                        <tr key={`${row.id}-edit`}>
                          <td colSpan={8} className="bg-slate-50 px-4 py-4">
                            <div className="space-y-3">
                              <label className="block max-w-xs text-sm">
                                <span className="font-medium text-slate-700">Category</span>
                                <select
                                  value={editCategory}
                                  onChange={(event) => setEditCategory(event.target.value)}
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                >
                                  <option value="">No category</option>
                                  {FACILITY_ISSUE_CATEGORY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <FacilityIssueRoomSelector
                                idPrefix={`edit-${row.id}`}
                                value={editRoomSelection}
                                onChange={setEditRoomSelection}
                                disabled={savingEditId === row.id}
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={savingEditId === row.id}
                                  onClick={() => void saveIssueLink(row)}
                                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                                >
                                  {savingEditId === row.id ? "Saving..." : "Save room/category"}
                                </button>
                                <button
                                  type="button"
                                  disabled={savingEditId === row.id}
                                  onClick={cancelEditIssue}
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
