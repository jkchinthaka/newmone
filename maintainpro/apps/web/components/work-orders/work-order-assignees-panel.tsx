"use client";

import { formatEnumLabel } from "@/lib/display-labels";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, Loader2, UserMinus, UserPlus, Star } from "lucide-react";
import { toast } from "sonner";

import { DateTimeField } from "@/components/forms/date-fields";
import { formatDrawerDateTime } from "@/lib/work-order-drawer-display";
import { EmptyState, ErrorState, SectionCard, SkeletonCard } from "@/components/ui/dashboard";
import { visibleFieldMessage } from "@/lib/form-feedback";
import { apiClient, getApiErrorMessageForRoute } from "@/lib/api-client";
import {
  canManageWorkforceEmployees,
  canOverrideLeaveConflict,
  canViewWorkforceEmployees,
  canViewWorkOrderAssignees,
  dateTimeLocalToIso,
  assignmentEmployeeListParams,
  designationChoices,
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
  openJobCount?: number | null;
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
  readOnly?: boolean;
  actualHours?: number | string | null;
}

function employeeName(row: AssigneeRow) {
  if (row.employee?.fullName) {
    return row.employee.fullName;
  }
  return row.employeeId;
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return letters || "?";
}

export function WorkOrderAssigneesPanel({ workOrderId, readOnly = false, actualHours }: Props) {
  const currentUser = useCurrentUser();
  const [assignees, setAssignees] = useState<AssigneeRow[]>([]);
  const [employees, setEmployees] = useState<WorkforceEmployee[]>([]);
  const [designationCatalog, setDesignationCatalog] = useState<WorkforceEmployee[]>([]);
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
  const [hoursTouched, setHoursTouched] = useState(false);
  const [assignmentSubmitAttempted, setAssignmentSubmitAttempted] = useState(false);
  const [leaveOverride, setLeaveOverride] = useState(false);
  const [leaveOverrideReason, setLeaveOverrideReason] = useState("");
  const [assignmentPreview, setAssignmentPreview] = useState<AssignmentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  const assignedIds = useMemo(() => new Set(assignees.map((a) => a.employeeId)), [assignees]);

  const designationOptions = useMemo(
    () => designationChoices(designationCatalog.length > 0 ? designationCatalog : employees),
    [designationCatalog, employees]
  );

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

  const canSeeAssignees = canViewWorkOrderAssignees(currentUser.role);
  const canSeeEmployees = canViewWorkforceEmployees(currentUser.role);

  const loadAssignees = useCallback(async () => {
    if (!canSeeAssignees) {
      setAssignees([]);
      setAssigneesError(null);
      return;
    }
    setLoadingAssignees(true);
    setAssigneesError(null);
    try {
      const assigneeRes = await apiClient.get<{ data: AssigneeRow[] }>(`/work-orders/${workOrderId}/assignees`);
      const rows = assigneeRes.data.data;
      setAssignees(Array.isArray(rows) ? rows : []);
    } catch (err) {
      const message = getApiErrorMessageForRoute(err, "work-order-assignees", "Failed to load assignees.");
      setAssigneesError(message);
      setAssignees([]);
      toast.error(message);
    } finally {
      setLoadingAssignees(false);
    }
  }, [workOrderId, canSeeAssignees]);

  const loadEmployees = useCallback(async () => {
    if (!canSeeEmployees) {
      setEmployees([]);
      setEmployeesError(null);
      return;
    }
    setLoadingEmployees(true);
    setEmployeesError(null);
    try {
      const employeeRes = await apiClient.get<{ data: WorkforceEmployee[] }>("/workforce/employees", {
        params: assignmentEmployeeListParams(designationFilter)
      });
      const rows = employeeRes.data.data;
      const list = Array.isArray(rows) ? rows : [];
      setEmployees(list);
      if (!designationFilter.trim()) {
        setDesignationCatalog(list);
      }
    } catch (err) {
      const message = getApiErrorMessageForRoute(err, "workforce", "Failed to load employees.");
      setEmployeesError(message);
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }, [canSeeEmployees, designationFilter]);

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

  async function handleAdd() {
    setAssignmentSubmitAttempted(true);
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
      setHoursTouched(false);
      setAssignmentSubmitAttempted(false);
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
    const reason = removeReason.trim();
    if (!reason || reason.length < 3) {
      toast.error("Reason required for this action.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.delete(`/work-orders/${workOrderId}/assignees/${assigneeId}`, {
        data: { reason }
      });
      toast.success("Assignee removed.");
      setPendingRemoveId(null);
      setRemoveReason("");
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

  const plannedHours = assignees.reduce((sum, row) => sum + (Number(row.estimatedHours) || 0), 0);
  const primaryName = assignees.find((row) => row.isPrimary)?.employee?.fullName;
  const actualLabel =
    actualHours === null || actualHours === undefined || actualHours === "" || Number.isNaN(Number(actualHours))
      ? null
      : `${actualHours} h`;

  return (
    <section className="space-y-4">
      <h4 className="text-sm font-semibold text-slate-900">Assigned team</h4>
      <p className="mt-1 text-xs text-slate-500">
        Choose a designation, then add the people doing this job. Mark one person as the primary assignee.
      </p>

      {!canSeeAssignees ? (
        <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
          Your role does not have permission to view or manage job assignments. Contact a manager or
          administrator.
        </p>
      ) : loadingAssignees ? (
        <div>
          <p className="sr-only">Loading assignees...</p>
          <SkeletonCard />
        </div>
      ) : assigneesError ? (
        <ErrorState message={assigneesError} onRetry={() => void loadAssignees()} />
      ) : assignees.length === 0 ? (
        <EmptyState title="No employees assigned yet" description="Add a team member when this job is still open." />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <p className="text-xs text-slate-500">Team members</p>
              <p className="font-semibold text-slate-900">{assignees.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <p className="text-xs text-slate-500">Planned hours</p>
              <p className="font-semibold text-slate-900">{plannedHours} h</p>
            </div>
            {actualLabel ? (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <p className="text-xs text-slate-500">Actual hours</p>
                <p className="font-semibold text-slate-900">{actualLabel}</p>
              </div>
            ) : null}
          </div>
        <ul className="space-y-2">
          {assignees.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800" aria-hidden>
                  {initials(employeeName(row))}
                </span>
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
                    Planned: {row.plannedStartAt ? formatDrawerDateTime(row.plannedStartAt) : "—"} →{" "}
                    {row.plannedEndAt ? formatDrawerDateTime(row.plannedEndAt) : "—"}
                    {row.estimatedHours ? ` · ${row.estimatedHours}h` : ""}
                  </p>
                ) : null}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {pendingRemoveId === row.id ? (
                  <div className="w-full max-w-sm space-y-2 rounded-md border border-rose-200 bg-rose-50/60 p-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Reason for removal
                      <textarea
                        rows={2}
                        value={removeReason}
                        onChange={(event) => setRemoveReason(event.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        placeholder="Required for audit trail"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRemove(row.id)}
                        className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white"
                      >
                        Confirm remove
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setPendingRemoveId(null);
                          setRemoveReason("");
                        }}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : readOnly ? null : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPendingRemoveId(row.id);
                      setRemoveReason("");
                    }}
                    className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  >
                    <UserMinus size={12} aria-hidden /> Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        </div>
      )}

      {canSeeAssignees && !readOnly ? (
      <SectionCard title="Add team member">
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.target instanceof HTMLTextAreaElement) {
            return;
          }
          event.preventDefault();
          void handleAdd();
        }}
      >
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Filter by designation</span>
          {loadingEmployees ? (
            <p className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500" role="status">
              <Loader2 size={14} className="animate-spin" /> Loading designations...
            </p>
          ) : employeesError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{employeesError}</p>
          ) : designationOptions.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              No designations are available for this tenant.
            </p>
          ) : (
          <select
            aria-label="Filter by designation"
            value={designationOptions.includes(designationFilter) ? designationFilter : ""}
            onChange={(event) => {
              setDesignationFilter(event.target.value);
              setEmployeeId("");
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All designations</option>
            {designationOptions.map((designation) => (
              <option key={designation} value={designation}>
                {formatEnumLabel(designation)}
              </option>
            ))}
          </select>
          )}
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Employee</span>
          {!canSeeEmployees ? (
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
              Your role cannot browse the employee list. Ask a manager or administrator to add assignees.
            </p>
          ) : loadingEmployees ? (
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
                      workloadPercentage: employee.workloadPercentage,
                      openJobCount: employee.openJobCount
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
            onChange={(event) => {
              setHoursTouched(true);
              setEstimatedHours(event.target.value);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {visibleFieldMessage(
            Number.isFinite(parsedEstimatedHours) && parsedEstimatedHours <= 0 ? "Estimated hours must be greater than 0." : "",
            { touched: hoursTouched, submitAttempted: assignmentSubmitAttempted }
          ) ? (
            <span className="text-xs text-rose-600" role="alert">Estimated hours must be greater than 0.</span>
          ) : null}
        </label>

        <DateTimeField label="Planned start" value={plannedStartAt} onChange={setPlannedStartAt} />

        <div className="space-y-1">
          <DateTimeField label="Planned end" value={plannedEndAt} onChange={setPlannedEndAt} />
          {plannedStartAt && plannedEndAt && !plannedRangeValid ? (
            <span className="text-xs text-rose-600">Planned end must be after planned start.</span>
          ) : null}
        </div>

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
          Primary assignee{primaryName ? ` (replaces ${primaryName})` : ""}
        </label>

        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.disabled = true;
              void handleAdd();
            }}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} aria-hidden />}
            Add assignee
          </button>
        </div>
      </div>
      </SectionCard>
      ) : null}
    </section>
  );
}
