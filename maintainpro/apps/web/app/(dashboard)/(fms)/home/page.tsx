"use client";

import { useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CarFront, Cog, Factory, PlusCircle, Users } from "lucide-react";

import { createRequestDraft, useMaintenanceJobApp } from "@/components/maintenance-job/provider";
import type { PendingRequest, RequestType } from "@/components/maintenance-job/types";

const filters: Array<{ label: string; value: RequestType | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Vehicle", value: "VEHICLE" },
  { label: "Machinery", value: "MACHINERY" },
  { label: "Service", value: "SERVICE" },
  { label: "Other", value: "OTHER" }
];

const requestMeta = {
  VEHICLE: { icon: CarFront, accent: "from-sky-100 to-cyan-50 text-sky-800 border-sky-200" },
  MACHINERY: { icon: Cog, accent: "from-violet-100 to-fuchsia-50 text-violet-800 border-violet-200" },
  SERVICE: { icon: Users, accent: "from-amber-100 to-orange-50 text-amber-800 border-amber-200" },
  OTHER: { icon: Factory, accent: "from-emerald-100 to-teal-50 text-emerald-800 border-emerald-200" }
} as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getOverdueDays(value: string) {
  const delta = Math.max(0, Math.round((new Date().setHours(0, 0, 0, 0) - new Date(value).getTime()) / 86400000));
  return delta;
}

export default function MaintenanceHomePage() {
  const router = useRouter();
  const { canEdit, createJobFromRequest, getPendingRequests, previewJobId, schedules } = useMaintenanceJobApp();
  const [filter, setFilter] = useState<RequestType | "ALL">("ALL");
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);

  const requests = useMemo(() => getPendingRequests(filter), [filter, getPendingRequests]);
  const draft = useMemo(() => {
    if (!selectedRequest) return null;
    return createRequestDraft(selectedRequest, previewJobId(selectedRequest.type === "VEHICLE" ? "vehicle" : selectedRequest.type === "SERVICE" ? "service" : "machinery"));
  }, [previewJobId, selectedRequest]);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="card rounded-[26px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Home</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Pending Requests</h2>
              <p className="mt-2 text-sm text-slate-500">Overdue items are automatically pinned to the top so the team acts on the oldest commitments first.</p>
            </div>
            <span className="rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">{requests.length} active requests</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  filter === item.value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            {requests.map((request) => {
              const meta = requestMeta[request.type];
              const Icon = meta.icon;
              const overdueDays = getOverdueDays(request.dueDate);

              return (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => setSelectedRequest(request)}
                  className="grid gap-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md md:grid-cols-[auto_1fr_auto]"
                >
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border bg-gradient-to-br ${meta.accent}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{request.reqNumber}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-600">{request.type}</span>
                      {overdueDays > 0 ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-rose-700">Overdue {overdueDays} day{overdueDays > 1 ? "s" : ""}</span> : null}
                    </div>
                    <p className="mt-2 text-base font-medium text-slate-800">{request.mainJob}</p>
                    <p className="mt-1 text-sm text-slate-500">{request.assetNumber} · {request.department} · {request.subJob}</p>
                  </div>
                  <div className="text-sm text-slate-500 md:text-right">
                    <p>{formatDate(request.date)}</p>
                    <p className="mt-1">Due {formatDate(request.dueDate)}</p>
                  </div>
                </button>
              );
            })}

            {requests.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No pending requests in this view.</div> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card rounded-[26px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Schedule Maintenance</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Upcoming Maintenance Queue</h3>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Future ready</span>
            </div>
            <div className="mt-4 space-y-3">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{schedule.title}</p>
                    <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{schedule.module}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{schedule.target} · {schedule.interval}</p>
                  <p className="mt-2 text-sm text-slate-600">Due {formatDate(schedule.dueDate)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card rounded-[26px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Role Access</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Workflow Controls</h3>
            <p className="mt-2 text-sm text-slate-500">Executives can review dashboards and reports. Managers, admins, and category specialists can convert requests into jobs and progress them through completion.</p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Editing is currently {canEdit ? "enabled" : "locked to view-only mode"} for this signed-in role.
            </div>
          </div>
        </div>
      </section>

      {selectedRequest && draft ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Create Job</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedRequest.mainJob}</h3>
                <p className="mt-2 text-sm text-slate-500">Convert the selected pending request into a live maintenance job.</p>
              </div>
              <button type="button" onClick={() => setSelectedRequest(null)} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Close</button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Request Date</span><input readOnly value={draft.requestDate} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900" /></label>
              <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Request No</span><input readOnly value={draft.requestNo} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900" /></label>
              <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Requested By</span><input readOnly value={draft.requestedBy} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900" /></label>
              <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Job No</span><input readOnly value={draft.jobNo} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900" /></label>
              <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Department</span><input readOnly value={draft.department} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900" /></label>
              <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Main Job</span><input readOnly value={draft.mainJob} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900" /></label>
              <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sub Job</span><input readOnly value={draft.subJob} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900" /></label>
              <label className="text-sm text-slate-600 md:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Narration</span><textarea readOnly rows={4} value={draft.narration} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900" /></label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setSelectedRequest(null)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => {
                  const created = createJobFromRequest(selectedRequest.id);
                  if (!created) return;
                  setSelectedRequest(null);
                  router.push(`/${created.module}/${created.id}` as Route);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <PlusCircle size={16} /> Create Job
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}