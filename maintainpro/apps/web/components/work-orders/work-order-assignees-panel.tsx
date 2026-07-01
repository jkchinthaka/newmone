"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, Loader2, UserMinus, UserPlus, Star } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessageForRoute } from "@/lib/api-client";
import {
  ASSIGNABLE_WORKFORCE_DESIGNATIONS,
  canManageWorkforceEmployees,
  canOverrideLeaveConflict,
  dateTimeLocalToIso,
  DESIGNATION_FALLBACK_NOTE,
  formatEmployeeOptionLabel,
  toDateTimeLocalValue
} from "@/lib/workforce-designations";
import { useCurrentUser } from "@/lib/use-current-user";

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
    fullName: string;
    designation?: string | null;
    branchName?: string | null;
    department?: { id: string; name: string; code: string } | null;
  } | null;
};

type WorkforceEmployee = {
  id: string;
  fullName: string;
  designation?: string | null;
  effectiveDesignation?: string | null;
  dailyCapacityHours?: number | null;
  workloadPercentage?: number | null;
  availabilityLabel?: string | null;
  branchName?: string | null;
  department?: { id: string; name: string; code: string } | null;
  canLogin?: boolean;
};

type AssignmentPreview = {
  onApprovedLeave: boolean;
  exceedsDailyCapacity: boolean;
  todayAllocatedHours: number;
  dailyCapacityHours: number;
  incomingHours: number;
};

interface Props {
  workOrderId: string;
}

function employeeName(row: AssigneeRow) {
  if (row.employee?.fullName) {
    return row.employee.fullName;
  }
  return row.employeeId;
}

export function WorkOrderAssigneesPanel({ workOrderId }: Props) {
  const currentUser = useCurrentUser();
  const [assignees, setAssignees] = useState<AssigneeRow[]>([]);
  const [employees, setEmployees] = useState<WorkforceEmployee[]>([]);
  const [loadingAssignees, setLoadingAssignees] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [assigneesError, setAssigneesError] = useState<string | null>(null);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [designationFilter, setDesignationFilter] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [roleInTask, setRoleInTask] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [plannedStartAt, setPlannedStartAt] = useState("");
  const [plannedEndAt, setPlannedEndAt] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [leaveOverride, setLeaveOverride] = useState(false);
  const [leaveOverrideReason, setLeaveOverrideReason] = useState("");
  const [assignmentPreview, setAssignmentPreview] = useState<AssignmentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const assignedIds = useMemo(() => new Set(assignees.map((a) => a.employeeId)), [assignees]);

  const selectableEmployees = useMemo(
    () => employees.filter((employee) => !assignedIds.has(employee.id)),
    [assignedIds, employees]
  );

  const parsedEstimatedHours = useMemo(() => {
    const value = Number(estimatedHours);
    return Number.isFinite(value) ? value : NaN;
  }, [estimatedHours]);

  const plannedRangeValid = useMemo(() => {
    if (!plannedStartAt || !plannedEndAt) {
      return false;
    }

    const start = new Date(plannedStartAt);
    const end = new Date(plannedEndAt);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime();
  }, [plannedEndAt, plannedStartAt]);

  const canSubmit =
    Boolean(employeeId) &&
    plannedRangeValid &&
    Number.isFinite(parsedEstimatedHours) &&
    parsedEstimatedHours > 0 &&
    (!leaveOverride || (canOverrideLeaveConflict(currentUser.role) && leaveOverrideReason.trim().length > 0));

  const loadAssignees = useCallback(async () => {
    setLoadingAssignees(true);
    setAssigneesError(null);
    try {
      const assigneeRes = await apiClient.get<{ data: AssigneeRow[] }>(`/work-orders/${workOrderId}/assignees`);
      setAssignees(assigneeRes.data.data ?? []);
    } catch (err) {
      const message = getApiErrorMessageForRoute(err, "work-order-assignees", "Failed to load assignees.");
      setAssigneesError(message);
      setAssignees([]);
      toast.error(message);
    } finally {
      setLoadingAssignees(false);
    }
  }, [workOrderId]);

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    setEmployeesError(null);
    try {
      const employeeRes = await apiClient.get<{ data: WorkforceEmployee[] }>("/workforce/employees", {
        params: designationFilter.trim() ? { designation: designationFilter.trim() } : undefined
      });
      setEmployees(employeeRes.data.data ?? []);
    } catch (err) {
      const message = getApiErrorMessageForRoute(err, "workforce", "Failed to load employees.");
      setEmployeesError(message);
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }, [designationFilter]);

  useEffect(() => {
    void loadAssignees();
  }, [loadAssignees]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    setLeaveOverride(false);
    setLeaveOverrideReason("");
  }, [employeeId, plannedStartAt, plannedEndAt, estimatedHours]);

  useEffect(() => {
    if (!employeeId || !plannedStartAt || !plannedEndAt || !Number.isFinite(parsedEstimatedHours) || parsedEstimatedHours <= 0) {
      setAssignmentPreview(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const startIso = dateTimeLocalToIso(plannedStartAt);
        const endIso = dateTimeLocalToIso(plannedEndAt);
        const response = await apiClient.get<{ data: AssignmentPreview }>("/workforce/assignment-preview", {
          params: {
            employeeId,
            plannedStartAt: startIso,
            plannedEndAt: endIso,
            estimatedHours: parsedEstimatedHours
          },
          signal: controller.signal
        });
        setAssignmentPreview(response.data.data ?? null);
      } catch (err) {
        if (!controller.signal.aborted) {
          setAssignmentPreview(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [employeeId, parsedEstimatedHours, plannedEndAt, plannedStartAt]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setBusy(true);
    try {
      await apiClient.post(`/work-orders/${workOrderId}/assignees`, {
        employeeId,
        designation: designationFilter.trim() || undefined,
        roleInTask: roleInTask.trim() || undefined,
        isPrimary,
        plannedStartAt: dateTimeLocalToIso(plannedStartAt),
        plannedEndAt: dateTimeLocalToIso(plannedEndAt),
        estimatedHours: parsedEstimatedHours,
        leaveOverride: leaveOverride || undefined,
        leaveOverrideReason: leaveOverride ? leaveOverrideReason.trim() : undefined
      });
      toast.success("Assignee added.");
      setEmployeeId("");
      setRoleInTask("");
      setIsPrimary(false);
      setPlannedStartAt("");
      setPlannedEndAt("");
      setEstimatedHours("");
      setLeaveOverride(false);
      setLeaveOverrideReason("");
      setAssignmentPreview(null);
      await Promise.all([loadAssignees(), loadEmployees()]);
    } catch (err) {
      toast.error(getApiErrorMessageForRoute(err, "work-order-assignees", "Could not add assignee."));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(assigneeId: string) {
    setBusy(true);
    try {
      await apiClient.delete(`/work-orders/${workOrderId}/assignees/${assigneeId}`);
      toast.success("Assignee removed.");
      await Promise.all([loadAssignees(), loadEmployees()]);
    } catch (err) {
      toast.error(getApiErrorMessageForRoute(err, "work-order-assignees", "Could not remove assignee."));
    } finally {
      setBusy(false);
    }
  }

  const showLeaveOverride =
    assignmentPreview?.onApprovedLeave === true && canOverrideLeaveConflict(currentUser.role);

  const canAddEmployee = canManageWorkforceEmployees(currentUser.role);
  const addEmployeeHref = designationFilter.trim()
    ? (`/master-data/employees?designation=${encodeURIComponent(designationFilter.trim())}` as Route)
    : ("/master-data/employees" as Route);

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Workforce assignments</h4>
      <p className="mt-1 text-xs text-slate-500">
        Assign multiple employees by designation. One primary assignee syncs to the legacy technician field.{" "}
        {DESIGNATION_FALLBACK_NOTE}
      </p>

      {loadingAssignees ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" aria-hidden /> Loading assignees...
        </p>
      ) : assigneesError ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{assigneesError}</p>
      ) : assignees.length === 0 ? (
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
                {row.roleInTask ? <span className="ml-2 text-xs text-slate-500">· {row.roleInTask}</span> : null}
                {row.plannedStartAt || row.plannedEndAt ? (
                  <p className="text-xs text-slate-500">
                    Planned: {row.plannedStartAt ? new Date(row.plannedStartAt).toLocaleString() : "—"} →{" "}
                    {row.plannedEndAt ? new Date(row.plannedEndAt).toLocaleString() : "—"}
                    {row.estimatedHours ? ` · ${row.estimatedHours}h` : ""}
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

      <form onSubmit={(event) => void handleAdd(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
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
            {ASSIGNABLE_WORKFORCE_DESIGNATIONS.map((designation) => (
              <option key={designation} value={designation}>
                {designation.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
          <span className="font-medium">Employee</span>
          {loadingEmployees ? (
            <p className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Loading employees...
            </p>
          ) : employeesError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{employeesError}</p>
          ) : (
            <>
              <select
                required
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select employee...</option>
                {selectableEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {formatEmployeeOptionLabel({
                      fullName: employee.fullName,
                      effectiveDesignation: employee.effectiveDesignation ?? employee.designation,
                      branchName: employee.branchName,
                      departmentName: employee.department?.name,
                      availabilityLabel: employee.availabilityLabel,
                      workloadPercentage: employee.workloadPercentage
                    })}
                  </option>
                ))}
              </select>
              {!loadingEmployees && selectableEmployees.length === 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-amber-700">
                    {designationFilter.trim()
                      ? `No employees found for designation "${designationFilter}".`
                      : "No assignable employees found for this tenant."}
                  </p>
                  {canAddEmployee ? (
                    <Link
                      href={addEmployeeHref}
                      className="text-xs font-semibold text-brand-700 underline hover:text-brand-800"
                    >
                      Add new employee
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
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
            min="0.5"
            step="0.5"
            required
            value={estimatedHours}
            onChange={(event) => setEstimatedHours(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {Number.isFinite(parsedEstimatedHours) && parsedEstimatedHours <= 0 ? (
            <span className="text-xs text-rose-600">Estimated hours must be greater than 0.</span>
          ) : null}
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Planned start</span>
          <input
            type="datetime-local"
            required
            value={plannedStartAt}
            onChange={(event) => setPlannedStartAt(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Planned end</span>
          <input
            type="datetime-local"
            required
            value={plannedEndAt}
            onChange={(event) => setPlannedEndAt(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {plannedStartAt && plannedEndAt && !plannedRangeValid ? (
            <span className="text-xs text-rose-600">Planned end must be after planned start.</span>
          ) : null}
        </label>

        {previewLoading ? (
          <p className="inline-flex items-center gap-2 text-xs text-slate-500 sm:col-span-2">
            <Loader2 size={12} className="animate-spin" /> Checking availability...
          </p>
        ) : null}

        {assignmentPreview?.exceedsDailyCapacity ? (
          <p className="inline-flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            Daily capacity warning: {assignmentPreview.todayAllocatedHours + assignmentPreview.incomingHours}h planned /{" "}
            {assignmentPreview.dailyCapacityHours}h capacity. Assignment may be blocked by the server.
          </p>
        ) : null}

        {assignmentPreview?.onApprovedLeave && !showLeaveOverride ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 sm:col-span-2">
            Employee has approved leave in this window. Choose another employee or ask a manager to override.
          </p>
        ) : null}

        {showLeaveOverride ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={leaveOverride}
                onChange={(event) => setLeaveOverride(event.target.checked)}
                className="rounded border-amber-400"
              />
              Override approved leave conflict (manager permission required; audited)
            </label>
            {leaveOverride ? (
              <input
                value={leaveOverrideReason}
                onChange={(event) => setLeaveOverrideReason(event.target.value)}
                placeholder="Override reason (required)"
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
              />
            ) : null}
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
            className="rounded border-slate-300"
          />
          Primary assignee
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} aria-hidden />}
            Add assignee
          </button>
        </div>
      </form>
    </section>
  );
}
