"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState, PageHeader, Section } from "@/components/farm/farm-ui";
import { farmGet, farmPost, formatLkr } from "@/lib/farm-api";
import { getActiveTenantId } from "@/lib/tenant-context";

type AttendanceLog = {
  id: string;
  date: string;
  status: string;
  hoursWorked?: number | null;
  wageLkr?: number | null;
  taskArea?: string | null;
  worker?: { id: string; name: string; workerType?: string } | null;
};

export default function FarmAttendancePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const tenantId = typeof window !== "undefined" ? getActiveTenantId() ?? "" : "";

  const list = useQuery({
    queryKey: ["farm-attendance", tenantId],
    queryFn: () => farmGet<AttendanceLog[]>("/farm/workers/attendance", { tenantId }),
    enabled: Boolean(tenantId)
  });

  const [form, setForm] = useState({
    workerId: "",
    date: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    hoursWorked: "",
    taskArea: "",
    wageLkr: ""
  });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => farmPost("/farm/workers/attendance", payload),
    onSuccess: () => {
      setShowForm(false);
      setError(null);
      qc.invalidateQueries({ queryKey: ["farm-attendance"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (err as Error).message;
      setError(String(msg));
    }
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      tenantId,
      workerId: form.workerId,
      date: form.date,
      status: form.status,
      taskArea: form.taskArea || undefined,
      hoursWorked: form.hoursWorked ? Number(form.hoursWorked) : undefined,
      wageLkr: form.wageLkr ? Number(form.wageLkr) : undefined
    };
    create.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Attendance"
        description="Daily attendance ledger for permanent and seasonal farm workers."
        actions={
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            {showForm ? "Cancel" : "+ Mark attendance"}
          </button>
        }
      />

      {showForm ? (
        <Section title="Mark attendance">
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Worker ID *</span>
              <input
                required
                value={form.workerId}
                onChange={(e) => setForm((s) => ({ ...s, workerId: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Date *</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Status *</span>
              <select
                value={form.status}
                onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Hours worked</span>
              <input
                type="number"
                step="0.1"
                value={form.hoursWorked}
                onChange={(e) => setForm((s) => ({ ...s, hoursWorked: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Task area</span>
              <input
                value={form.taskArea}
                onChange={(e) => setForm((s) => ({ ...s, taskArea: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Wage (LKR)</span>
              <input
                type="number"
                step="0.01"
                value={form.wageLkr}
                onChange={(e) => setForm((s) => ({ ...s, wageLkr: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={create.isPending || !tenantId}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {create.isPending ? "Saving…" : "Save"}
              </button>
              {error ? <span className="text-xs text-rose-600">{error}</span> : null}
            </div>
          </form>
        </Section>
      ) : null}

      <Section title="Recent attendance">
        {!tenantId ? (
          <p className="text-sm text-slate-500">Select an active tenant to view attendance.</p>
        ) : list.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState title="No attendance logged" description="Mark your first attendance with the button above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Worker</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Hours</th>
                  <th className="px-3 py-2 text-left">Task</th>
                  <th className="px-3 py-2 text-left">Wage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {list.data.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">{new Date(row.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{row.worker?.name ?? "—"}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">{row.hoursWorked ?? "—"}</td>
                    <td className="px-3 py-2">{row.taskArea ?? "—"}</td>
                    <td className="px-3 py-2">{formatLkr(row.wageLkr ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
