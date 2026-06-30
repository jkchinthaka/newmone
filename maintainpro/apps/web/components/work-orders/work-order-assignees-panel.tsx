"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserPlus, UserMinus, Star } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";

type AssigneeRow = {
  id: string;
  employeeId: string;
  designation?: string | null;
  roleInTask?: string | null;
  isPrimary: boolean;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  estimatedHours?: number | null;
  assignmentStatus: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    designation?: string | null;
    dailyCapacityHours?: number | null;
  } | null;
};

type WorkforceEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  designation?: string | null;
  dailyCapacityHours?: number | null;
  skills?: string[];
};

interface Props {
  workOrderId: string;
}

function employeeName(row: AssigneeRow) {
  if (row.employee) {
    return `${row.employee.firstName} ${row.employee.lastName}`.trim();
  }
  return row.employeeId;
}

export function WorkOrderAssigneesPanel({ workOrderId }: Props) {
  const [assignees, setAssignees] = useState<AssigneeRow[]>([]);
  const [employees, setEmployees] = useState<WorkforceEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [designationFilter, setDesignationFilter] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [roleInTask, setRoleInTask] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [plannedStartAt, setPlannedStartAt] = useState("");
  const [plannedEndAt, setPlannedEndAt] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [leaveOverride, setLeaveOverride] = useState(false);

  const designations = useMemo(() => {
    const values = new Set<string>();
    for (const employee of employees) {
      if (employee.designation?.trim()) values.add(employee.designation.trim());
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (!designationFilter.trim()) return employees;
    return employees.filter(
      (e) => e.designation?.toLowerCase() === designationFilter.trim().toLowerCase()
    );
  }, [employees, designationFilter]);

  const assignedIds = useMemo(() => new Set(assignees.map((a) => a.employeeId)), [assignees]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [assigneeRes, employeeRes] = await Promise.all([
        apiClient.get<{ data: AssigneeRow[] }>(`/work-orders/${workOrderId}/assignees`),
        apiClient.get<{ data: WorkforceEmployee[] }>("/workforce/employees", {
          params: designationFilter.trim() ? { designation: designationFilter.trim() } : undefined
        })
      ]);
      setAssignees(assigneeRes.data.data ?? []);
      setEmployees(employeeRes.data.data ?? []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load assignees."));
    } finally {
      setLoading(false);
    }
  }, [workOrderId, designationFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!employeeId) return;

    setBusy(true);
    try {
      await apiClient.post(`/work-orders/${workOrderId}/assignees`, {
        employeeId,
        designation: designationFilter.trim() || undefined,
        roleInTask: roleInTask.trim() || undefined,
        isPrimary,
        plannedStartAt: plannedStartAt ? new Date(`${plannedStartAt}T00:00:00.000Z`).toISOString() : undefined,
        plannedEndAt: plannedEndAt ? new Date(`${plannedEndAt}T23:59:59.000Z`).toISOString() : undefined,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        leaveOverride: leaveOverride || undefined
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not add assignee."));
      setBusy(false);
      return;
    }

    toast.success("Assignee added.");
    setEmployeeId("");
    setRoleInTask("");
    setIsPrimary(false);
    setPlannedStartAt("");
    setPlannedEndAt("");
    setEstimatedHours("");
    setLeaveOverride(false);
    setBusy(false);
    await refresh();
  }

  async function handleRemove(assigneeId: string) {
    setBusy(true);
    try {
      await apiClient.delete(`/work-orders/${workOrderId}/assignees/${assigneeId}`);
      toast.success("Assignee removed.");
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not remove assignee."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Workforce assignments</h4>
      <p className="mt-1 text-xs text-slate-500">
        Assign multiple employees by designation. One primary assignee syncs to the legacy technician field.
        Leave conflicts block assignment unless override is checked (audited).
      </p>

      {loading ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" aria-hidden /> Loading assignees...
        </p>
      ) : (
        <>
          {assignees.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No employees assigned yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {assignees.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium text-slate-900">{employeeName(row)}</span>
                    {row.isPrimary ? (
                      <span className="ml-2 inline-flex items-center gap-0.5 rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-800">
                        <Star size={10} aria-hidden /> Primary
                      </span>
                    ) : null}
                    {row.designation ? (
                      <span className="ml-2 text-xs text-slate-500">{row.designation}</span>
                    ) : null}
                    {row.roleInTask ? (
                      <span className="ml-2 text-xs text-slate-500">· {row.roleInTask}</span>
                    ) : null}
                    {row.plannedStartAt || row.plannedEndAt ? (
                      <p className="text-xs text-slate-500">
                        Planned:{" "}
                        {row.plannedStartAt ? new Date(row.plannedStartAt).toLocaleDateString() : "—"} →{" "}
                        {row.plannedEndAt ? new Date(row.plannedEndAt).toLocaleDateString() : "—"}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRemove(row.id)}
                    className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  >
                    <UserMinus size={12} aria-hidden /> Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={(e) => void handleAdd(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
              <span className="font-medium">Filter by designation</span>
              <select
                value={designationFilter}
                onChange={(event) => {
                  setDesignationFilter(event.target.value);
                  setEmployeeId("");
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All designations</option>
                {designations.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
              <span className="font-medium">Employee</span>
              <select
                required
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select employee...</option>
                {filteredEmployees
                  .filter((e) => !assignedIds.has(e.id))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                      {e.designation ? ` (${e.designation})` : ""}
                      {e.dailyCapacityHours ? ` · ${e.dailyCapacityHours}h/day` : ""}
                    </option>
                  ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">Role in task</span>
              <input
                value={roleInTask}
                onChange={(event) => setRoleInTask(event.target.value)}
                placeholder="e.g. Lead electrician"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">Estimated hours</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={estimatedHours}
                onChange={(event) => setEstimatedHours(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">Planned start</span>
              <input
                type="date"
                value={plannedStartAt}
                onChange={(event) => setPlannedStartAt(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">Planned end</span>
              <input
                type="date"
                value={plannedEndAt}
                onChange={(event) => setPlannedEndAt(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(event) => setIsPrimary(event.target.checked)}
                className="rounded border-slate-300"
              />
              Primary assignee
            </label>

            <label className="flex items-center gap-2 text-sm text-amber-800 sm:col-span-2">
              <input
                type="checkbox"
                checked={leaveOverride}
                onChange={(event) => setLeaveOverride(event.target.checked)}
                className="rounded border-amber-400"
              />
              Override approved leave conflict (requires manager permission; audited)
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy || !employeeId}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} aria-hidden />}
                Add assignee
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
