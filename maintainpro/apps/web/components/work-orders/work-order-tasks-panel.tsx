"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, SectionCard, SkeletonCard } from "@/components/ui/dashboard";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { assignmentEmployeeListParams } from "@/lib/workforce-designations";
import {
  canManageJobTasks,
  formatTaskTime,
  taskProgressLabel,
  TASK_STATUS_LABEL,
  type JobTask,
  type JobTaskList,
  type TaskStatus
} from "@/lib/work-order-tasks";

type Employee = { id: string; fullName: string; designation?: string | null };

const STATUS_STYLE: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700",
  WORKING: "bg-amber-100 text-amber-800",
  DONE: "bg-emerald-100 text-emerald-800"
};

function PeoplePicker({
  employees,
  selected,
  onChange
}: {
  employees: Employee[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const byId = new Map(employees.map((e) => [e.id, e]));
  const visible = employees.filter(
    (e) => !selected.includes(e.id) && e.fullName.toLowerCase().includes(query.trim().toLowerCase())
  );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-sm text-brand-800">
            {byId.get(id)?.fullName ?? "Person"}
            <button
              type="button"
              aria-label={`Remove ${byId.get(id)?.fullName ?? "person"}`}
              onClick={() => onChange(selected.filter((x) => x !== id))}
              className="ml-1 text-brand-700 hover:text-brand-900"
            >
              ✕
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-h-9 rounded-full px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          + Add person
        </button>
      </div>
      {open ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            autoFocus
            className="w-full rounded-t-lg border-b border-slate-200 px-3 py-2 text-sm outline-none"
          />
          <ul className="max-h-44 overflow-y-auto p-1">
            {visible.length === 0 ? <li className="px-2 py-2 text-sm text-slate-500">No one found</li> : null}
            {visible.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...selected, e.id]);
                    setQuery("");
                  }}
                  className="flex min-h-10 w-full items-center justify-between rounded px-2 text-left text-sm hover:bg-slate-50"
                >
                  <span>{e.fullName}</span>
                  {e.designation ? <span className="text-xs text-slate-500">{e.designation}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function WorkOrderTasksPanel({
  workOrderId,
  readOnly,
  onChanged
}: {
  workOrderId: string;
  readOnly?: boolean;
  /** Called after any change so the page can refresh counts. */
  onChanged?: (list: JobTaskList) => void;
}) {
  const currentUser = useCurrentUser();
  const canManage = canManageJobTasks(currentUser.role) && !readOnly;
  const [list, setList] = useState<JobTaskList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPeople, setEditPeople] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: JobTaskList }>(`/work-orders/${workOrderId}/tasks`);
      setList(res.data.data);
      setError(null);
      onChanged?.(res.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load tasks."));
    }
  }, [workOrderId, onChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    apiClient
      .get<{ data: Employee[] }>("/workforce/employees", { params: assignmentEmployeeListParams("") })
      .then((res) => setEmployees(Array.isArray(res.data.data) ? res.data.data : []))
      .catch(() => setEmployees([]));
  }, [canManage]);

  const progress = useMemo(() => (list && list.total ? Math.round((list.done / list.total) * 100) : 0), [list]);

  async function addTask() {
    if (!title.trim()) {
      toast.error("Type what needs to be done.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/work-orders/${workOrderId}/tasks`, {
        title: title.trim(),
        employeeIds: people,
        estimatedHours: hours.trim() ? Number(hours) : null
      });
      setTitle("");
      setHours("");
      setPeople([]);
      setAdding(false);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not add the task."));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(task: JobTask, status: TaskStatus) {
    setBusyId(task.id);
    try {
      await apiClient.post(`/work-orders/${workOrderId}/tasks/${task.id}/status`, { status });
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not update the task."));
    } finally {
      setBusyId(null);
    }
  }

  async function removeTask(task: JobTask) {
    if (!window.confirm(`Remove task "${task.title}"?`)) return;
    setBusyId(task.id);
    try {
      await apiClient.delete(`/work-orders/${workOrderId}/tasks/${task.id}`);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not remove the task."));
    } finally {
      setBusyId(null);
    }
  }

  async function saveAssignees(task: JobTask) {
    setBusyId(task.id);
    try {
      await apiClient.patch(`/work-orders/${workOrderId}/tasks/${task.id}`, { employeeIds: editPeople });
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not change people."));
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!list) return <SkeletonCard />;

  return (
    <SectionCard
      title="Tasks"
      description={
        list.total
          ? `${taskProgressLabel(list)}. The job can be completed when every task is done.`
          : "Optional. Split the job into steps so different people can work on them at the same time."
      }
      action={
        canManage ? (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add task
          </button>
        ) : null
      }
    >
      {list.total > 0 ? (
        <div className="mb-4" aria-label={`Progress ${progress}%`}>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {adding && canManage ? (
        <div className="mb-4 space-y-3 rounded-xl border border-brand-100 bg-brand-50/30 p-3">
          <label className="block text-sm font-medium text-slate-800">
            What needs to be done
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              autoFocus
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Drain and replace hydraulic oil"
            />
          </label>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-800">Who does it</p>
            <PeoplePicker employees={employees} selected={people} onChange={setPeople} />
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand-700">More options (estimated hours)</summary>
            <label className="mt-2 block text-sm font-medium text-slate-800">
              Estimated hours
              <input
                value={hours}
                onChange={(e) => setHours(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                className="mt-1 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </details>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void addTask()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Save task
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {list.total === 0 ? (
        <EmptyState
          title="No tasks on this job"
          description={canManage ? "Use Add task if the job has separate steps." : "This job has no separate steps."}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.tasks.map((task) => {
            const canAct = !readOnly && (task.isMine || canManage);
            const busy = busyId === task.id;
            return (
              <li key={task.id} className="py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-base font-medium ${task.status === "DONE" ? "text-slate-500 line-through" : "text-slate-900"}`}>
                      {task.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {task.assignees.length ? task.assignees.map((a) => a.fullName).join(", ") : "No one assigned"}
                      {task.estimatedHours ? ` · est. ${task.estimatedHours} h` : ""}
                      {task.timeSpentMinutes ? ` · took ${formatTaskTime(task.timeSpentMinutes)}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[task.status]}`}>
                    {TASK_STATUS_LABEL[task.status]}
                  </span>
                </div>
                {canAct || canManage ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {canAct && task.status === "NOT_STARTED" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(task, "WORKING")}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Play className="h-4 w-4" aria-hidden /> Start
                      </button>
                    ) : null}
                    {canAct && task.status !== "DONE" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(task, "DONE")}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" aria-hidden /> Mark done
                      </button>
                    ) : null}
                    {canAct && task.status === "DONE" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(task, "WORKING")}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden /> Reopen
                      </button>
                    ) : null}
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(editingId === task.id ? null : task.id);
                            setEditPeople(task.assignees.map((a) => a.employeeId));
                          }}
                          className="min-h-10 rounded-lg px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
                        >
                          Change people
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeTask(task)}
                          aria-label={`Remove task ${task.title}`}
                          className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden /> Remove
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {editingId === task.id && canManage ? (
                  <div className="mt-2 space-y-2">
                    <PeoplePicker employees={employees} selected={editPeople} onChange={setEditPeople} />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveAssignees(task)}
                        className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        Save people
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
