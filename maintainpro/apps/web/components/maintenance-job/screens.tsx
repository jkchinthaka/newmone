"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, CheckCircle2, ChevronRight, Clock3, Cog, Factory, PackagePlus, PlusCircle, Settings2, UserRound, Wrench } from "lucide-react";

import { useMaintenanceJobApp } from "./provider";
import type { Employee, MaintenanceJob, ModuleKey, RequestedItem } from "./types";

type EditorStep = "basic" | "allocation" | "timing" | "items" | "summary";

const moduleMeta: Record<ModuleKey, { title: string; description: string; accent: string }> = {
  machinery: {
    title: "Machinery Jobs",
    description: "Workshop and equipment jobs with staff allocation, item requests, and completion control.",
    accent: "from-violet-100 to-fuchsia-50 border-violet-200"
  },
  service: {
    title: "Service Jobs",
    description: "Service contracts, vendor work, time estimation, and pending service execution.",
    accent: "from-amber-100 to-orange-50 border-amber-200"
  },
  vehicle: {
    title: "Vehicle Jobs",
    description: "Fleet repair and maintenance jobs with position-level definitions and costing.",
    accent: "from-sky-100 to-cyan-50 border-sky-200"
  }
};

const editorSteps: Array<{ value: EditorStep; label: string }> = [
  { value: "basic", label: "Basic Info" },
  { value: "allocation", label: "Allocated Staff & Directs" },
  { value: "timing", label: "Estimated Time Frame" },
  { value: "items", label: "Request Items" },
  { value: "summary", label: "Job Summary / Complete" }
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

function formatDate(value: string) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(value);
}

function buildClientDraft(module: ModuleKey, jobId: string): MaintenanceJob {
  return {
    id: "",
    module,
    jobId,
    status: "PENDING",
    date: todayIso(),
    dueDate: todayIso(),
    assetNumber: "",
    department: "",
    jobType: "Internal",
    jobSegment: module === "service" ? "Service" : "Repair",
    mainJobCategory: "",
    subJobCategory: "",
    title: "",
    narration: "",
    buildingName: "",
    departmentName: "",
    sectionName: "",
    serviceJobDefinition: "",
    serviceValue: "",
    vehicleInternalName: "",
    position: "",
    subJobDefinitions: [],
    servicePartyCode: "",
    servicePartyName: "",
    onlineOrdering: false,
    mainJobCode: "",
    staff: [],
    workers: [],
    estimateState: "Quoted",
    estimateTime: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    faultCondition: "Operational",
    faultNarration: "",
    previousReading: "",
    currentReading: "",
    maintenanceMode: "Regular",
    requestedItems: [],
    machineNumber: "",
    completionDate: todayIso(),
    completionTime: nowTime(),
    completionNotes: "",
    costing: { labor: 0, parts: 0, vendor: 0, total: 0 }
  };
}

function StatusBadge({ status }: { status: MaintenanceJob["status"] }) {
  const styles = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    IN_PROGRESS: "bg-sky-50 text-sky-700 border-sky-200",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200"
  };

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${styles[status]}`}>{status.replaceAll("_", " ")}</span>;
}

function JobCard({ job, onOpen }: { job: MaintenanceJob; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-slate-900">{job.jobId}</span>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-2 text-base font-medium text-slate-800">{job.title || job.mainJobCategory || "Untitled job"}</p>
          <p className="mt-1 text-sm text-slate-500">{job.assetNumber || "No asset selected"} · {job.department || "No department"}</p>
        </div>
        <ChevronRight size={18} className="text-slate-400" />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Job Type</p>
          <p className="mt-1">{job.jobType}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Date</p>
          <p className="mt-1">{formatDate(job.date)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Due Date</p>
          <p className="mt-1">{formatDate(job.dueDate)}</p>
        </div>
      </div>
    </button>
  );
}

function DateTimePair(props: {
  label: string;
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm text-slate-600">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label} Date</span>
        <input type="date" value={props.date} onChange={(event) => props.onDateChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" />
      </label>
      <label className="text-sm text-slate-600">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label} Time</span>
        <input type="time" value={props.time} onChange={(event) => props.onTimeChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" />
      </label>
    </div>
  );
}

function EPFSelector(props: {
  label: string;
  people: Employee[];
  selected: Employee[];
  onChange: (next: Employee[]) => void;
  disabled?: boolean;
}) {
  const selectedIds = new Set(props.selected.map((person) => person.epf));

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{props.label}</p>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">ADD</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {props.people.map((person) => {
          const active = selectedIds.has(person.epf);
          return (
            <button
              key={person.epf}
              type="button"
              disabled={props.disabled}
              onClick={() => props.onChange(active ? props.selected.filter((entry) => entry.epf !== person.epf) : [...props.selected, person])}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${active ? "border-brand-200 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50"}`}
            >
              {person.epf} {person.name}
            </button>
          );
        })}
      </div>
      <div className="mt-4 space-y-2">
        {props.selected.map((person) => (
          <div key={person.epf} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <span>{person.epf} {person.name}</span>
            <button type="button" disabled={props.disabled} onClick={() => props.onChange(props.selected.filter((entry) => entry.epf !== person.epf))} className="text-slate-500 hover:text-slate-900">X</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemRequestModal(props: {
  open: boolean;
  inventory: Array<{ id: string; group: string; name: string; unit: string; unitCost: number }>;
  initialItems: RequestedItem[];
  onClose: () => void;
  onSubmit: (items: RequestedItem[]) => void;
}) {
  const [group, setGroup] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [staged, setStaged] = useState<RequestedItem[]>(props.initialItems);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setGroup("");
    setItemId("");
    setQuantity(1);
    setStaged(props.initialItems);
    setError(null);
  }, [props.initialItems, props.open]);

  const groups = useMemo(() => Array.from(new Set(props.inventory.map((item) => item.group))).sort(), [props.inventory]);
  const visibleItems = useMemo(() => props.inventory.filter((item) => !group || item.group === group), [group, props.inventory]);

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Request Items</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">Item Request Popup</h3>
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.2fr_auto]">
          <label className="text-sm text-slate-600">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Item Group</span>
            <select value={group} onChange={(event) => { setGroup(event.target.value); setItemId(""); }} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400">
              <option value="">All Groups</option>
              {groups.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Item</span>
            <select value={itemId} onChange={(event) => setItemId(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400">
              <option value="">Select item</option>
              {visibleItems.map((entry) => <option key={entry.id} value={entry.id}>{entry.id} {entry.name}</option>)}
            </select>
          </label>
          <div className="text-sm text-slate-600">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quantity</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQuantity((current) => Math.max(0, current - 1))} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700 hover:bg-slate-100">-</button>
              <input value={quantity} onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))} className="w-20 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-center text-slate-900 outline-none focus:border-brand-400" />
              <button type="button" onClick={() => setQuantity((current) => current + 1)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700 hover:bg-slate-100">+</button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const selected = props.inventory.find((entry) => entry.id === itemId);
              if (!selected) {
                setError("Select an item before adding.");
                return;
              }
              if (quantity <= 0) {
                setError("Quantity must be greater than zero.");
                return;
              }

              setError(null);
              setStaged((current) => {
                const existing = current.find((entry) => entry.itemId === selected.id);
                if (existing) {
                  return current.map((entry) => (entry.itemId === selected.id ? { ...entry, quantity: entry.quantity + quantity } : entry));
                }

                return [...current, { itemId: selected.id, name: selected.name, group: selected.group, quantity, unit: selected.unit, unitCost: selected.unitCost }];
              });
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            <PackagePlus size={16} /> Add Item
          </button>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>

        <div className="mt-5 space-y-2">
          {staged.map((item) => (
            <div key={item.itemId} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div>
                <p className="font-medium text-slate-900">{item.itemId} {item.name}</p>
                <p className="text-slate-500">{item.quantity} {item.unit}</p>
              </div>
              <button type="button" onClick={() => setStaged((current) => current.filter((entry) => entry.itemId !== item.itemId))} className="text-slate-500 hover:text-slate-900">Remove</button>
            </div>
          ))}
          {staged.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No items added yet.</div> : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={props.onClose} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={() => props.onSubmit(staged)} className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Submit</button>
        </div>
      </div>
    </div>
  );
}

export function ModuleJobListScreen({ module }: { module: ModuleKey }) {
  const meta = moduleMeta[module];
  const { getJobsByModule } = useMaintenanceJobApp();
  const [filter, setFilter] = useState<MaintenanceJob["status"] | "ALL">("ALL");

  const jobs = useMemo(() => getJobsByModule(module, filter), [filter, getJobsByModule, module]);
  const pendingServiceJobs = useMemo(() => (module === "service" ? getJobsByModule("service", "ALL").filter((job) => job.status !== "COMPLETED") : []), [getJobsByModule, module]);

  return (
    <div className="space-y-5">
      <section className={`card rounded-[28px] border bg-gradient-to-br ${meta.accent} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Module 1</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{meta.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{meta.description}</p>
          </div>
          <button type="button" onClick={() => window.location.assign(`/${module}/new`)} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
            <PlusCircle size={16} /> New Job
          </button>
        </div>
      </section>

      <section className="card rounded-[28px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Job List</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">{meta.title}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "IN_PROGRESS", label: "In-Progress" },
              { value: "COMPLETED", label: "Completed" },
              { value: "ALL", label: "All" }
            ].map((item) => (
              <button key={item.value} type="button" onClick={() => setFilter(item.value as MaintenanceJob["status"] | "ALL")} className={`rounded-full px-4 py-2 text-sm font-medium ${filter === item.value ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {jobs.map((job, index) => <JobCard key={job.id || job.jobId || `${module}-job-${index}`} job={job} onOpen={() => window.location.assign(`/${module}/${job.id}`)} />)}
          {jobs.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No jobs found for this status filter.</div> : null}
        </div>
      </section>

      {module === "service" ? (
        <section className="card rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-brand-600" />
            <h3 className="text-lg font-semibold text-slate-900">Pending Service Jobs</h3>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {pendingServiceJobs.map((job, index) => <JobCard key={job.id || job.jobId || `service-pending-${index}`} job={job} onOpen={() => window.location.assign(`/service/${job.id}`)} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function JobEditorScreen({ module, jobId }: { module: ModuleKey; jobId?: string }) {
  const meta = moduleMeta[module];
  const { canEdit, completeJob, createManualJob, employees, inventory, jobs, saveJob, vendors, previewJobId } = useMaintenanceJobApp();
  const existingJob = useMemo(() => jobs.find((job) => job.id === jobId && job.module === module) ?? null, [jobId, jobs, module]);
  const [form, setForm] = useState<MaintenanceJob | null>(null);
  const [step, setStep] = useState<EditorStep>("basic");
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [subJobDraft, setSubJobDraft] = useState("");

  useEffect(() => {
    setForm(existingJob ?? buildClientDraft(module, previewJobId(module)));
  }, [existingJob, module, previewJobId]);

  if (!form) {
    return <div className="card rounded-[28px] p-5 text-sm text-slate-500">Loading job editor...</div>;
  }

  if (jobId && !existingJob) {
    return <div className="card rounded-[28px] p-5 text-sm text-slate-500">Job not found for this module.</div>;
  }

  const selectedVendor = vendors.find((vendor) => vendor.code === form.servicePartyCode) ?? vendors[0];

  return (
    <div className="space-y-5">
      <section className={`card rounded-[28px] border bg-gradient-to-br ${meta.accent} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">{jobId ? "Job Detail" : "New Job"}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{meta.title} Workspace</h2>
            <p className="mt-2 text-sm text-slate-600">Use the tabs below to replicate the complete mobile workflow in a connected web flow.</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={form.status} />
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">{form.jobId}</span>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {editorSteps.map((item) => (
          <button key={item.value} type="button" onClick={() => setStep(item.value)} className={`rounded-full px-4 py-2 text-sm font-medium ${step === item.value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {step === "basic" ? (
        <section className="card rounded-[28px] p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Job Type</span><select value={form.jobType} onChange={(event) => setForm((current) => current ? { ...current, jobType: event.target.value as MaintenanceJob["jobType"] } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400"><option>Internal</option><option>External</option></select></label>
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Job Segment</span><input value={form.jobSegment} onChange={(event) => setForm((current) => current ? { ...current, jobSegment: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Job Date</span><input type="date" value={form.date} onChange={(event) => setForm((current) => current ? { ...current, date: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Job ID</span><input readOnly value={form.jobId} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900" /></label>
            <label className="text-sm text-slate-600 md:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Asset / Vehicle No</span><input value={form.assetNumber} onChange={(event) => setForm((current) => current ? { ...current, assetNumber: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.onlineOrdering} onChange={(event) => setForm((current) => current ? { ...current, onlineOrdering: event.target.checked } : current)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" /> Online Job Ordering</label>
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Main Job Code</span><input value={form.mainJobCode} onChange={(event) => setForm((current) => current ? { ...current, mainJobCode: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>

            {module === "machinery" ? (
              <>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Building Name & Number</span><input value={form.buildingName} onChange={(event) => setForm((current) => current ? { ...current, buildingName: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Department Name</span><input value={form.departmentName} onChange={(event) => setForm((current) => current ? { ...current, departmentName: event.target.value, department: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Section Name</span><input value={form.sectionName} onChange={(event) => setForm((current) => current ? { ...current, sectionName: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Main Job Category</span><input value={form.mainJobCategory} onChange={(event) => setForm((current) => current ? { ...current, mainJobCategory: event.target.value, title: event.target.value || current.title } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                <label className="text-sm text-slate-600 md:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sub Job Category</span><input value={form.subJobCategory} onChange={(event) => setForm((current) => current ? { ...current, subJobCategory: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
              </>
            ) : null}

            {module === "service" ? (
              <>
                <label className="text-sm text-slate-600 md:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Service Job Definition</span><input value={form.serviceJobDefinition} onChange={(event) => setForm((current) => current ? { ...current, serviceJobDefinition: event.target.value, title: event.target.value || current.title } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Department Name</span><input value={form.departmentName} onChange={(event) => setForm((current) => current ? { ...current, departmentName: event.target.value, department: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Section Name</span><input value={form.sectionName} onChange={(event) => setForm((current) => current ? { ...current, sectionName: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Service Party</span><select value={form.servicePartyCode} onChange={(event) => { const vendor = vendors.find((entry) => entry.code === event.target.value); setForm((current) => current ? { ...current, servicePartyCode: event.target.value, servicePartyName: vendor?.name ?? "" } : current); }} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400">{vendors.map((vendor) => <option key={vendor.code} value={vendor.code}>{vendor.code} {vendor.name}</option>)}</select></label>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Service Value</span><input value={form.serviceValue} onChange={(event) => setForm((current) => current ? { ...current, serviceValue: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
              </>
            ) : null}

            {module === "vehicle" ? (
              <>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Department</span><input value={form.department} onChange={(event) => setForm((current) => current ? { ...current, department: event.target.value, departmentName: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Job Definition</span><input value={form.title} onChange={(event) => setForm((current) => current ? { ...current, title: event.target.value, mainJobCategory: event.target.value || current.mainJobCategory } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vehicle Internal Name</span><input value={form.vehicleInternalName} onChange={(event) => setForm((current) => current ? { ...current, vehicleInternalName: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Service Party</span><select value={form.servicePartyCode} onChange={(event) => { const vendor = vendors.find((entry) => entry.code === event.target.value); setForm((current) => current ? { ...current, servicePartyCode: event.target.value, servicePartyName: vendor?.name ?? "" } : current); }} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400">{vendors.map((vendor) => <option key={vendor.code} value={vendor.code}>{vendor.code} {vendor.name}</option>)}</select></label>
                <div className="md:col-span-2">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Position</span><input value={form.position} onChange={(event) => setForm((current) => current ? { ...current, position: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                    <button type="button" onClick={() => setForm((current) => current ? { ...current, position: current.position.trim() } : current)} className="self-end rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">ADD</button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sub Job Definition</span><input value={subJobDraft} onChange={(event) => setSubJobDraft(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
                    <button type="button" onClick={() => { if (!subJobDraft.trim()) return; setForm((current) => current ? { ...current, subJobDefinitions: [...current.subJobDefinitions, subJobDraft.trim()] } : current); setSubJobDraft(""); }} className="self-end rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">ADD</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {form.subJobDefinitions.map((entry) => <button key={entry} type="button" onClick={() => setForm((current) => current ? { ...current, subJobDefinitions: current.subJobDefinitions.filter((item) => item !== entry) } : current)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">{entry} X</button>)}
                  </div>
                </div>
              </>
            ) : null}

            <label className="text-sm text-slate-600 md:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Job Narration</span><textarea rows={5} value={form.narration} onChange={(event) => setForm((current) => current ? { ...current, narration: event.target.value, faultNarration: current.faultNarration || event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => window.location.assign(`/${module}`)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="button" disabled={!canEdit} onClick={() => { if (form.id) { const saved = saveJob(form.id, form); if (saved) setForm(saved); } else { const created = createManualJob(module, form); window.location.assign(`/${module}/${created.id}`); } }} className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-55">{form.id ? "Save Basic Info" : "Create Job"}</button>
          </div>
        </section>
      ) : null}

      {step === "allocation" ? (
        <section className="card rounded-[28px] p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Service Party</span><select value={form.servicePartyCode} onChange={(event) => { const vendor = vendors.find((entry) => entry.code === event.target.value); setForm((current) => current ? { ...current, servicePartyCode: event.target.value, servicePartyName: vendor?.name ?? "" } : current); }} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400">{vendors.map((vendor) => <option key={vendor.code} value={vendor.code}>{vendor.code} {vendor.name}</option>)}</select></label>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Credit / Payment</p>
              <p className="mt-2">Vendor Code: {selectedVendor?.code ?? "-"}</p>
              <p>Vendor Name: {selectedVendor?.name ?? "-"}</p>
              <p>C/P: {selectedVendor?.creditPayment ?? "-"}</p>
              <p>Credit Days: {selectedVendor?.creditDays ?? 0}</p>
              <p>S/W: {selectedVendor?.settlementWindow ?? "-"}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <EPFSelector label="Staff" people={employees} selected={form.staff} onChange={(next) => setForm((current) => current ? { ...current, staff: next } : current)} disabled={!canEdit} />
            <EPFSelector label="Workers" people={employees} selected={form.workers} onChange={(next) => setForm((current) => current ? { ...current, workers: next } : current)} disabled={!canEdit} />
          </div>

          <div className="mt-6 flex justify-end">
            <button type="button" disabled={!canEdit || !form.id} onClick={() => { if (!form.id) return; const saved = saveJob(form.id, form); if (saved) setForm(saved); }} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"><UserRound size={16} /> Save Allocation</button>
          </div>
        </section>
      ) : null}

      {step === "timing" ? (
        <section className="card rounded-[28px] p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estimate States</span><select value={form.estimateState} onChange={(event) => setForm((current) => current ? { ...current, estimateState: event.target.value as MaintenanceJob["estimateState"] } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400"><option>Quoted</option><option>Approved</option><option>Waiting Parts</option><option>Vendor Review</option></select></label>
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estimate Time</span><input value={form.estimateTime} onChange={(event) => setForm((current) => current ? { ...current, estimateTime: event.target.value } : current)} placeholder="4h" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <DateTimePair label="Start" date={form.startDate} time={form.startTime} onDateChange={(value) => setForm((current) => current ? { ...current, startDate: value } : current)} onTimeChange={(value) => setForm((current) => current ? { ...current, startTime: value } : current)} />
            <DateTimePair label="End" date={form.endDate} time={form.endTime} onDateChange={(value) => setForm((current) => current ? { ...current, endDate: value } : current)} onTimeChange={(value) => setForm((current) => current ? { ...current, endTime: value } : current)} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Fault Conditions</span><select value={form.faultCondition} onChange={(event) => setForm((current) => current ? { ...current, faultCondition: event.target.value as MaintenanceJob["faultCondition"] } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400"><option>Operational</option><option>Minor Fault</option><option>Major Fault</option><option>Breakdown</option></select></label>
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Maintenance Type</span><div className="flex gap-2 pt-2">{["Regular", "Sudden"].map((entry) => <button key={entry} type="button" onClick={() => setForm((current) => current ? { ...current, maintenanceMode: entry as MaintenanceJob["maintenanceMode"] } : current)} className={`rounded-full px-4 py-2 text-sm font-medium ${form.maintenanceMode === entry ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{entry}</button>)}</div></label>
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Previous Reading</span><input value={form.previousReading} onChange={(event) => setForm((current) => current ? { ...current, previousReading: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
            <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current Reading</span><input value={form.currentReading} onChange={(event) => setForm((current) => current ? { ...current, currentReading: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
            <label className="text-sm text-slate-600 md:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Job Narration</span><textarea rows={5} value={form.faultNarration} onChange={(event) => setForm((current) => current ? { ...current, faultNarration: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>
          </div>

          <div className="mt-6 flex justify-end">
            <button type="button" disabled={!canEdit || !form.id} onClick={() => { if (!form.id) return; const saved = saveJob(form.id, { ...form, status: "IN_PROGRESS" }); if (saved) setForm(saved); }} className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-55"><Clock3 size={16} /> Start</button>
          </div>
        </section>
      ) : null}

      {step === "items" ? (
        <section className="card rounded-[28px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Request Items</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">Item Request Flow</h3>
            </div>
            <button type="button" onClick={() => setShowItemsModal(true)} className="inline-flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100"><PackagePlus size={16} /> Request Items</button>
          </div>

          <div className="mt-5 space-y-3">
            {form.requestedItems.map((item) => (
              <div key={item.itemId} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div>
                  <p className="font-medium text-slate-900">{item.itemId} {item.name}</p>
                  <p className="text-slate-500">{item.quantity} {item.unit}</p>
                </div>
                <button type="button" onClick={() => setForm((current) => current ? { ...current, requestedItems: current.requestedItems.filter((entry) => entry.itemId !== item.itemId) } : current)} className="text-slate-500 hover:text-slate-900">Remove</button>
              </div>
            ))}
            {form.requestedItems.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No items requested yet.</div> : null}
          </div>

          <div className="mt-6 flex justify-end">
            <button type="button" disabled={!canEdit || !form.id} onClick={() => { if (!form.id) return; const saved = saveJob(form.id, { requestedItems: form.requestedItems }); if (saved) setForm(saved); }} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55">Submit</button>
          </div>

          <ItemRequestModal open={showItemsModal} inventory={inventory} initialItems={form.requestedItems} onClose={() => setShowItemsModal(false)} onSubmit={(items) => { setForm((current) => current ? { ...current, requestedItems: items } : current); setShowItemsModal(false); }} />
        </section>
      ) : null}

      {step === "summary" ? (
        <section className="card rounded-[28px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Job Summary</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">Complete Job</h3>
            </div>
            <StatusBadge status={form.status} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{form.jobId}</p>
              <p className="mt-2 text-sm text-slate-600">{form.title || form.mainJobCategory || "Job definition pending"}</p>
              <p className="mt-1 text-sm text-slate-500">Due {formatDate(form.dueDate)}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>Labor: {formatCurrency(form.costing.labor)}</p>
              <p>Parts: {formatCurrency(form.costing.parts)}</p>
              <p>Vendor: {formatCurrency(form.costing.vendor)}</p>
              <p className="mt-2 font-semibold text-slate-900">Total: {formatCurrency(form.costing.total)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <DateTimePair label="Date Now" date={form.completionDate} time={form.completionTime} onDateChange={(value) => setForm((current) => current ? { ...current, completionDate: value } : current)} onTimeChange={(value) => setForm((current) => current ? { ...current, completionTime: value } : current)} />
            <DateTimePair label="Start" date={form.startDate} time={form.startTime} onDateChange={(value) => setForm((current) => current ? { ...current, startDate: value } : current)} onTimeChange={(value) => setForm((current) => current ? { ...current, startTime: value } : current)} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <DateTimePair label="End" date={form.endDate} time={form.endTime} onDateChange={(value) => setForm((current) => current ? { ...current, endDate: value } : current)} onTimeChange={(value) => setForm((current) => current ? { ...current, endTime: value } : current)} />
            {module === "machinery" ? <label className="text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Get Machinery Number</span><input value={form.machineNumber} onChange={(event) => setForm((current) => current ? { ...current, machineNumber: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label> : <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Vehicle / service completion uses the same start/end timestamps and total report controls.</div>}
          </div>

          <label className="mt-4 block text-sm text-slate-600"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Completion summary / total report</span><textarea rows={5} value={form.completionNotes} onChange={(event) => setForm((current) => current ? { ...current, completionNotes: event.target.value } : current)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-400" /></label>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => window.location.assign("/reports/job-costing")} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"><BarChart3 size={16} /> View Total Job Report</button>
            <button type="button" disabled={!canEdit || !form.id} onClick={() => { if (!form.id) return; const completed = completeJob(form.id, form); if (completed) setForm(completed); }} className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-55"><CheckCircle2 size={16} /> Complete</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function JobCostingReportScreen() {
  const { jobs, pendingRequests } = useMaintenanceJobApp();
  const totals = useMemo(() => jobs.reduce((sum, job) => ({ labor: sum.labor + job.costing.labor, parts: sum.parts + job.costing.parts, vendor: sum.vendor + job.costing.vendor, total: sum.total + job.costing.total }), { labor: 0, parts: 0, vendor: 0, total: 0 }), [jobs]);

  return (
    <div className="space-y-5">
      <section className="card rounded-[28px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">FMS Reports</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Job-wise Costing</h2>
        <p className="mt-2 text-sm text-slate-500">Cost breakdown by job with pending-request context and completed versus active workload.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card rounded-[24px]"><p className="text-sm text-slate-500">Labor</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.labor)}</p></div>
        <div className="card rounded-[24px]"><p className="text-sm text-slate-500">Parts</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.parts)}</p></div>
        <div className="card rounded-[24px]"><p className="text-sm text-slate-500">Vendor</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.vendor)}</p></div>
        <div className="card rounded-[24px]"><p className="text-sm text-slate-500">Pending Requests</p><p className="mt-2 text-2xl font-semibold text-slate-900">{pendingRequests.filter((entry) => entry.status === "PENDING").length}</p></div>
      </section>

      <section className="card rounded-[28px] p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="pb-3 pr-4">Job</th>
                <th className="pb-3 pr-4">Module</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Labor</th>
                <th className="pb-3 pr-4">Parts</th>
                <th className="pb-3 pr-4">Vendor</th>
                <th className="pb-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-slate-100 align-top">
                  <td className="py-4 pr-4"><p className="font-medium text-slate-900">{job.jobId}</p><p className="mt-1 text-slate-500">{job.title || job.mainJobCategory || "Untitled job"}</p></td>
                  <td className="py-4 pr-4 uppercase">{job.module}</td>
                  <td className="py-4 pr-4"><StatusBadge status={job.status} /></td>
                  <td className="py-4 pr-4">{formatCurrency(job.costing.labor)}</td>
                  <td className="py-4 pr-4">{formatCurrency(job.costing.parts)}</td>
                  <td className="py-4 pr-4">{formatCurrency(job.costing.vendor)}</td>
                  <td className="py-4 font-semibold text-slate-900">{formatCurrency(job.costing.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
