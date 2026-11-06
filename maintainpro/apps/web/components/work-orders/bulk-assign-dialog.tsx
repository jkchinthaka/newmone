"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api-client";

import { bulkAssignWorkOrders, bulkUpdateWorkOrders } from "./api";
import { getErrorMessage } from "./helpers";

type Employee = { id: string; fullName: string; designation?: string | null; effectiveDesignation?: string | null };

type Props = {
  workOrderIds: string[];
  onClose: () => void;
  onDone: (result: { success: string[]; failed: Array<{ workOrderId: string; reason: string }> }) => void;
};

/** Assign the same people (and optional due date) to many jobs in one step. */
export function BulkAssignDialog({ workOrderIds, onClose, onDone }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient
      .get<{ data: Employee[] }>("/workforce/employees")
      .then((res) => {
        if (alive) setEmployees(Array.isArray(res.data.data) ? res.data.data : []);
      })
      .catch((err) => {
        if (alive) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? employees.filter((e) => e.fullName.toLowerCase().includes(q)) : employees;
  }, [employees, search]);

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async () => {
    if (picked.length === 0 && !priority && !dueDate) return;
    setSaving(true);
    try {
      const due = dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : undefined;
      const failed: Array<{ workOrderId: string; reason: string }> = [];
      let ok = 0;
      if (picked.length > 0) {
        const r = await bulkAssignWorkOrders({ workOrderIds, assigneeEmployeeIds: picked, expectedCompletionDate: due });
        failed.push(...r.failed);
        ok = r.success.length;
      }
      if (priority || (dueDate && picked.length === 0)) {
        const r = await bulkUpdateWorkOrders({ workOrderIds, priority: priority || undefined, dueDate: due });
        failed.push(...r.failed);
        ok = Math.max(ok, r.success.length);
      }
      if (ok > 0) toast.success(`Updated ${ok} job(s)`);
      if (failed.length > 0) toast.error(`${failed.length} job(s) failed: ${failed[0].reason}`);
      onDone({ success: [], failed });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Assign jobs">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">{workOrderIds.length === 1 ? "Add people to this job" : `Assign people to ${workOrderIds.length} jobs`}</h2>
          <p className="text-sm text-slate-500">Tick as many people as you need. They are added to each job and people already on a job stay. The first person becomes the main assignee only if the job has none.</p>
        </div>
        <div className="space-y-3 overflow-y-auto px-4 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {loading ? <p className="text-sm text-slate-500">Loading people…</p> : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
            {visible.map((e) => (
              <li key={e.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={picked.includes(e.id)} onChange={() => toggle(e.id)} />
                  <span className="font-medium text-slate-900">{e.fullName}</span>
                  <span className="text-slate-500">{e.effectiveDesignation ?? e.designation ?? ""}</span>
                </label>
              </li>
            ))}
            {!loading && visible.length === 0 ? <li className="px-3 py-2 text-sm text-slate-500">No people found.</li> : null}
          </ul>
          <label className="block text-sm">
            <span className="text-slate-700">Priority (optional)</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Keep as is</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Due date (optional)</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || (picked.length === 0 && !priority && !dueDate)}
            className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
