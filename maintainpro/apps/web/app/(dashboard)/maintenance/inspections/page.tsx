"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage, apiClient } from "@/lib/api-client";
import { formatDateTime } from "@/lib/localization";
import { useCurrentUser } from "@/lib/use-current-user";
import { listInspectionTemplates, listInspections, scheduleInspection } from "@/lib/planning-api";
import { listLocations } from "@/lib/organization-api";

const MANAGE_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ASSET_MANAGER",
  "MECHANIC",
  "TECHNICIAN"
]);

type InspectionRow = {
  id: string;
  displayCode?: string;
  status: string;
  result?: string | null;
  findings?: string | null;
  scheduledAt?: string | null;
  performedAt?: string | null;
  dueState?: string;
  criticalFindings?: number;
  subjectName?: string;
  subjectCode?: string;
  correctiveWorkOrderId?: string | null;
  template?: { name?: string; code?: string; version?: number } | null;
  findingRecords?: Array<{ severity?: string; workOrderId?: string | null; maintenanceRequestId?: string | null }>;
};

function resultLabel(result?: string | null) {
  if (result === "PASS") return "Pass";
  if (result === "OBSERVATION") return "Pass with Findings";
  if (result === "FAIL") return "Fail";
  return "—";
}

function statusLabel(status: string) {
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "SCHEDULED" || status === "OPEN") return "Scheduled";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function MaintenanceInspectionsPage() {
  const user = useCurrentUser();
  const canManage = MANAGE_ROLES.has(user.role ?? "") || user.permissions.includes("planning.manage");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view") ?? "all";
  const queryText = params.get("q") ?? "";
  const result = params.get("result") ?? "";
  const page = Math.max(Number(params.get("page") ?? "1") || 1, 1);
  const [draft, setDraft] = useState(queryText);
  const [items, setItems] = useState<InspectionRow[]>([]);
  const [summary, setSummary] = useState({ dueToday: 0, overdue: 0, failed: 0, completedThisWeek: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const write = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    const qs = next.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft.trim() === queryText.trim()) return;
      write({ q: draft.trim() || null });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listInspections({
      search: queryText || undefined,
      result: result || (view === "failed" ? "FAIL" : undefined),
      view: view === "all" || view === "failed" ? undefined : view,
      page,
      pageSize: 25
    })
      .then((payload) => {
        if (cancelled) return;
        setItems(payload.items as InspectionRow[]);
        setSummary(payload.summary);
        setTotal(payload.meta.total);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "We couldn't load inspections."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, queryText, result, page, params]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageBreadcrumbs />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inspections</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Plan, perform and track inspections for assets, vehicles and facilities.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={"/admin/checklist-templates" as Route} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium">
            Manage Templates
          </Link>
          {canManage ? (
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white" onClick={() => setCreateOpen(true)}>
              <Plus size={16} aria-hidden /> Create Inspection
            </button>
          ) : null}
        </div>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Due Today", summary.dueToday, "due"],
          ["Overdue", summary.overdue, "overdue"],
          ["Failed / Critical", summary.failed, "failed"],
          ["Completed This Week", summary.completedThisWeek, "completed"]
        ].map(([label, value, key]) => (
          <button key={String(label)} type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left" onClick={() => write({ view: String(key) })}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </button>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        {[
          ["all", "All Inspections"],
          ["due", "Due Today"],
          ["upcoming", "Upcoming"],
          ["overdue", "Overdue"],
          ["failed", "Failed"],
          ["completed", "Completed"]
        ].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} className={`min-h-11 rounded-lg px-3 text-sm ${view === id ? "bg-brand-600 text-white" : "border border-slate-200 bg-white"}`} onClick={() => write({ view: id === "all" ? null : id })}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_200px]">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search inspection, asset, vehicle or inspector..." aria-label="Search inspections" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm" />
        <select aria-label="Result" className="min-h-11 rounded-lg border px-2 text-sm" value={result} onChange={(event) => write({ result: event.target.value || null })}>
          <option value="">Result</option>
          <option value="PASS">Pass</option>
          <option value="OBSERVATION">Pass with Findings</option>
          <option value="FAIL">Fail</option>
        </select>
      </div>
      <p className="text-sm text-slate-600">{total} inspection{total === 1 ? "" : "s"}</p>

      {error ? <ErrorState title="We couldn't load inspections." description={error} onRetry={() => write({ retry: String(Date.now()) })} retryLabel="Retry" /> : null}
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
          <p className="font-medium">No inspections yet.</p>
          <p className="mt-1 text-sm text-slate-600">Create an inspection to check asset, vehicle or facility condition and record findings before they become maintenance problems.</p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Inspection</th>
                <th className="px-3 py-2">Asset / location</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Corrective action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const actionId = row.correctiveWorkOrderId || row.findingRecords?.find((finding) => finding.workOrderId)?.workOrderId;
                const requestId = row.findingRecords?.find((finding) => finding.maintenanceRequestId)?.maintenanceRequestId;
                return (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-3">
                      <div className="font-semibold">
                        <Link href={`/maintenance/inspections/${row.id}` as Route} className="text-brand-700">
                          {row.displayCode}
                        </Link>
                      </div>
                      <div>{row.template?.name || row.findings || "Inspection"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{row.subjectName}</div>
                      <div className="text-xs text-slate-500">{row.subjectCode}</div>
                    </td>
                    <td className="px-3 py-3">{row.scheduledAt ? new Date(row.scheduledAt).toLocaleDateString() : row.performedAt ? new Date(row.performedAt).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-3">
                      {resultLabel(row.result)}
                      {row.criticalFindings ? <div className="text-xs text-rose-800">{row.criticalFindings} critical/high</div> : null}
                    </td>
                    <td className="px-3 py-3">{statusLabel(row.status)}</td>
                    <td className="px-3 py-3">
                      {actionId ? <Link className="text-brand-700" href={`/work-orders?wo=${actionId}` as Route}>Work order</Link> : null}
                      {requestId ? <Link className="block text-brand-700" href={`/requests/${requestId}` as Route}>Request</Link> : null}
                      {!actionId && !requestId ? "—" : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {createOpen ? (
        <CreateInspectionWizard
          canManageTemplates={canManage || user.permissions.includes("planning.manage")}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            toast.success("Inspection scheduled");
            write({ refresh: String(Date.now()) });
          }}
        />
      ) : null}
    </div>
  );
}

function CreateInspectionWizard({
  canManageTemplates,
  onClose,
  onCreated
}: {
  canManageTemplates: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [inspectionType, setInspectionType] = useState("Safety Inspection");
  const [description, setDescription] = useState("");
  const [subjectKind, setSubjectKind] = useState<"asset" | "vehicle" | "location">("asset");
  const [subjectQuery, setSubjectQuery] = useState("");
  const [subjects, setSubjects] = useState<Array<{ id: string; label: string }>>([]);
  const [subjectId, setSubjectId] = useState("");
  const [inspectors, setInspectors] = useState<Array<{ id: string; label: string }>>([]);
  const [inspectorId, setInspectorId] = useState("");
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [templateId, setTemplateId] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listInspectionTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (subjectKind === "location") {
        void listLocations({ q: subjectQuery, pageSize: 8 })
          .then((rows) => setSubjects(rows.map((row) => ({ id: row.id, label: `${row.name} (${row.code})` }))))
          .catch(() => setSubjects([]));
        return;
      }
      const path = subjectKind === "asset" ? "/assets" : "/vehicles";
      void apiClient
        .get(path, { params: { search: subjectQuery, limit: 8 } })
        .then((response) => {
          const data = (response.data as { data?: unknown }).data;
          const rows = Array.isArray(data) ? data : Array.isArray((data as { items?: unknown[] })?.items) ? (data as { items: unknown[] }).items : [];
          setSubjects(
            rows.map((row) => {
              const item = row as { id: string; name?: string; assetTag?: string; registrationNo?: string; make?: string; vehicleModel?: string };
              const label = item.registrationNo
                ? `${item.make ?? ""} ${item.vehicleModel ?? ""} ${item.registrationNo}`.trim()
                : `${item.name ?? "Asset"} ${item.assetTag ?? ""}`.trim();
              return { id: item.id, label };
            })
          );
        })
        .catch(() => setSubjects([]));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [subjectKind, subjectQuery]);

  const template = templates.find((item) => item.id === templateId);
  const checklistCount = Array.isArray((template?.checklistTemplate as { items?: unknown[] } | undefined)?.items)
    ? ((template?.checklistTemplate as { items: unknown[] }).items.length)
    : 0;

  const continueFromStep = () => {
    if (step === 1 && title.trim().length < 3) {
      toast.error("Enter a title with at least 3 characters.");
      return;
    }
    if (step === 2 && !subjectId) {
      toast.error("Select a subject before continuing.");
      return;
    }
    if (step === 3 && !templateId) {
      toast.error("Select an active inspection template before continuing.");
      return;
    }
    if (step === 5 && !due) {
      toast.error("Choose a due date before continuing.");
      return;
    }
    setStep((current) => current + 1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 3 || !subjectId || !templateId || !due) {
      toast.error("Title, subject, template, and due date are required.");
      return;
    }
    setBusy(true);
    try {
      await scheduleInspection({
        title: title.trim(),
        inspectionType,
        description,
        templateId,
        assetId: subjectKind === "asset" ? subjectId : undefined,
        vehicleId: subjectKind === "vehicle" ? subjectId : undefined,
        functionalLocationId: subjectKind === "location" ? subjectId : undefined,
        inspectorId: inspectorId || undefined,
        scheduledAt: new Date(due).toISOString()
      });
      onCreated();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not schedule the inspection"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="rounded-xl border bg-white p-4" onSubmit={(event) => void submit(event)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Create Inspection</h2>
        <button type="button" className="min-h-11 px-2" onClick={onClose}>Close</button>
      </div>
      <p className="text-sm text-slate-500">Step {step} of 6</p>
      {step === 1 ? (
        <div className="mt-3 space-y-3">
          <label className="block text-sm">Title<input className="mt-1 min-h-11 w-full rounded-lg border px-3" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="block text-sm">Inspection type
            <select className="mt-1 min-h-11 w-full rounded-lg border px-2" value={inspectionType} onChange={(event) => setInspectionType(event.target.value)}>
              {["Pre-Start Inspection", "Safety Inspection", "Vehicle Inspection", "Machinery Inspection", "Facility Inspection", "Compliance Inspection"].map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="block text-sm">Description<textarea className="mt-1 w-full rounded-lg border px-3 py-2" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <button type="button" className={`min-h-11 rounded-lg px-3 ${subjectKind === "asset" ? "bg-slate-900 text-white" : "border"}`} onClick={() => { setSubjectKind("asset"); setSubjectId(""); }}>Asset</button>
            <button type="button" className={`min-h-11 rounded-lg px-3 ${subjectKind === "vehicle" ? "bg-slate-900 text-white" : "border"}`} onClick={() => { setSubjectKind("vehicle"); setSubjectId(""); }}>Vehicle</button>
            <button type="button" className={`min-h-11 rounded-lg px-3 ${subjectKind === "location" ? "bg-slate-900 text-white" : "border"}`} onClick={() => { setSubjectKind("location"); setSubjectId(""); }}>Location</button>
          </div>
          <input className="min-h-11 w-full rounded-lg border px-3" placeholder="Search" value={subjectQuery} onChange={(event) => setSubjectQuery(event.target.value)} />
          <div className="space-y-1">
            {subjects.map((subject) => (
              <button key={subject.id} type="button" className={`block min-h-11 w-full rounded-lg px-3 text-left text-sm ${subjectId === subject.id ? "bg-brand-50" : "border"}`} onClick={() => setSubjectId(subject.id)}>
                {subject.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="mt-3 space-y-2">
          {templates.map((item) => (
            <button key={String(item.id)} type="button" className={`block w-full rounded-lg border p-3 text-left text-sm ${templateId === item.id ? "border-brand-600" : ""}`} onClick={() => setTemplateId(String(item.id))}>
              <span className="font-medium">{String(item.name)}</span>
              <span className="block text-slate-500">Version {String(item.version ?? 1)} · {(item.checklistTemplate as { items?: unknown[] } | null)?.items?.length ?? 0} checklist items</span>
            </button>
          ))}
          {!templates.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>No active inspection templates are available.</p>
              {canManageTemplates ? (
                <Link href={"/admin/checklist-templates" as Route} className="mt-2 inline-block font-medium text-brand-700 underline">
                  Manage checklist templates
                </Link>
              ) : (
                <p className="mt-2 text-amber-800">Ask an administrator to publish an active template.</p>
              )}
            </div>
          ) : null}
          {templates.length > 0 && !templateId ? (
            <p className="text-sm text-amber-700">Select a template to continue.</p>
          ) : null}
        </div>
      ) : null}
      {step === 4 ? (
        <div className="mt-3 space-y-2">
          <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => void apiClient.get("/users", { params: { pageSize: 20 } }).then((response) => {
            const rows = ((response.data as { data?: Array<{ id: string; fullName?: string; email?: string; firstName?: string; lastName?: string }> }).data) ?? [];
            setInspectors(rows.map((user) => ({ id: user.id, label: user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || user.id })));
          }).catch(() => setInspectors([]))}>Load inspectors</button>
          <select className="min-h-11 w-full rounded-lg border px-2 text-sm" value={inspectorId} onChange={(event) => setInspectorId(event.target.value)}>
            <option value="">Signed-in user</option>
            {inspectors.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
          </select>
          <p className="text-sm text-slate-500">Team assignment is not a field on an inspection. Leave inspector blank to assign yourself.</p>
        </div>
      ) : null}
      {step === 5 ? (
        <label className="mt-3 block text-sm">Due
          <input type="datetime-local" className="mt-1 min-h-11 w-full rounded-lg border px-3" value={due} onChange={(event) => setDue(event.target.value)} />
        </label>
      ) : null}
      {step === 6 ? (
        <dl className="mt-3 space-y-1 text-sm">
          <div>Subject: {subjects.find((item) => item.id === subjectId)?.label || "Not selected"}</div>
          <div>Template: {String(template?.name ?? "Not selected")} · {checklistCount} items</div>
          <div>Inspector: signed-in user</div>
          <div>Due: {due ? formatDateTime(new Date(due).toISOString()) : "Not set"}</div>
        </dl>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {step > 1 ? <button type="button" className="min-h-11 rounded-lg border px-3" onClick={() => setStep((current) => current - 1)}>Back</button> : null}
        {step < 6 ? (
          <button
            type="button"
            className="min-h-11 rounded-lg bg-slate-900 px-3 text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={step === 3 && !templateId}
            onClick={continueFromStep}
          >
            Continue
          </button>
        ) : (
          <button type="submit" className="min-h-11 rounded-lg bg-brand-600 px-3 text-white" disabled={busy}>Create Inspection</button>
        )}
      </div>
    </form>
  );
}
