"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Layers, Loader2, Pencil, Plus, PowerOff } from "lucide-react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api-client";

interface JobCode {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  parentId?: string | null;
  estimatedHours?: number | null;
  requiredSkills?: string[];
  isActive: boolean;
  _count?: { subJobs: number };
}

interface FormState {
  code: string;
  name: string;
  category: string;
  description: string;
  estimatedHours: string;
  parentId: string;
  requiredSkills: string;
}

const EMPTY_FORM: FormState = { code: "", name: "", category: "", description: "", estimatedHours: "", parentId: "", requiredSkills: "" };

/** Fetch job codes. parentId="null" = main jobs; parentId=<id> = subs; undefined = all */
async function fetchJobs(parentId?: string | "null", q?: string): Promise<JobCode[]> {
  const params: Record<string, string> = {};
  if (parentId !== undefined) params.parentId = parentId;
  if (q) params.q = q;
  const response = await apiClient.get("/job-codes", { params });
  return Array.isArray(response.data?.data) ? (response.data.data as JobCode[]) : [];
}

export default function JobCodesPage() {
  const [mainJobs, setMainJobs] = useState<JobCode[]>([]);
  const [subJobs, setSubJobs] = useState<JobCode[]>([]);
  const [selectedMain, setSelectedMain] = useState<JobCode | null>(null);
  const [loadingMain, setLoadingMain] = useState(true);
  const [loadingSub, setLoadingSub] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchMain, setSearchMain] = useState("");
  const [searchSub, setSearchSub] = useState("");
  const [tab, setTab] = useState<"main" | "sub">("main");

  // Load main jobs
  const refreshMain = useCallback(async (q?: string) => {
    setLoadingMain(true);
    try {
      setMainJobs(await fetchJobs("null", q));
    } catch {
      toast.error("Failed to load main jobs");
    } finally {
      setLoadingMain(false);
    }
  }, []);

  // Load sub-jobs for selected main job
  const refreshSubs = useCallback(async (parentId: string, q?: string) => {
    setLoadingSub(true);
    try {
      setSubJobs(await fetchJobs(parentId, q));
    } catch {
      toast.error("Failed to load sub-jobs");
    } finally {
      setLoadingSub(false);
    }
  }, []);

  useEffect(() => {
    void refreshMain();
  }, [refreshMain]);

  // Debounce main search
  useEffect(() => {
    const h = window.setTimeout(() => void refreshMain(searchMain.trim() || undefined), 250);
    return () => window.clearTimeout(h);
  }, [searchMain, refreshMain]);

  // Debounce sub search
  useEffect(() => {
    if (!selectedMain) return;
    const h = window.setTimeout(() => void refreshSubs(selectedMain.id, searchSub.trim() || undefined), 250);
    return () => window.clearTimeout(h);
  }, [searchSub, selectedMain, refreshSubs]);

  const handleSelectMain = (job: JobCode) => {
    setSelectedMain(job);
    setTab("sub");
    setSearchSub("");
    void refreshSubs(job.id);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const isSubTab = tab === "sub" && selectedMain;
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Code and Name are required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        description: form.description.trim() || undefined,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
        requiredSkills: form.requiredSkills ? form.requiredSkills.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        parentId: isSubTab ? selectedMain!.id : undefined
      };

      if (editingId) {
        await apiClient.patch(`/job-codes/${editingId}`, payload);
        toast.success("Job code updated");
        setEditingId(null);
      } else {
        await apiClient.post("/job-codes", payload);
        toast.success(`${isSubTab ? "Sub-job" : "Main job"} "${form.code.trim()}" created`);
      }

      setForm(EMPTY_FORM);
      if (isSubTab) {
        await refreshSubs(selectedMain!.id, searchSub.trim() || undefined);
      } else {
        await refreshMain(searchMain.trim() || undefined);
      }
    } catch (error) {
      const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save";
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (job: JobCode) => {
    setEditingId(job.id);
    setForm({
      code: job.code,
      name: job.name,
      category: job.category ?? "",
      description: job.description ?? "",
      estimatedHours: job.estimatedHours?.toString() ?? "",
      parentId: job.parentId ?? "",
      requiredSkills: job.requiredSkills?.join(", ") ?? ""
    });
  };

  const handleDeactivate = async (job: JobCode) => {
    if (!window.confirm(`Deactivate "${job.code} — ${job.name}"?`)) return;
    try {
      await apiClient.patch(`/job-codes/${job.id}`, { isActive: false });
      toast.success("Job code deactivated");
      if (job.parentId) {
        setSubJobs((cur) => cur.filter((j) => j.id !== job.id));
      } else {
        setMainJobs((cur) => cur.filter((j) => j.id !== job.id));
        if (selectedMain?.id === job.id) {
          setSelectedMain(null);
          setSubJobs([]);
        }
      }
    } catch {
      toast.error("Failed to deactivate");
    }
  };

  const formTitle = editingId ? "Edit job code" : tab === "sub" && selectedMain ? `New sub-job under "${selectedMain.name}"` : "Create main job";

  return (
    <div className="space-y-6 p-6">
      <header>
        <Link href="/maintenance" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 hover:underline">
          <ArrowLeft size={12} aria-hidden /> Maintenance
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Job Codes</h1>
        <p className="mt-1 text-sm text-slate-500">Main jobs and cascading sub-jobs used across maintenance and work orders.</p>
      </header>

      {/* Form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Layers size={16} className="text-brand-600" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{formTitle}</h2>
        </div>

        {/* Tab switcher (only visible when not editing) */}
        {!editingId && (
          <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
            <button
              type="button"
              onClick={() => setTab("main")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === "main" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Main Job
            </button>
            <button
              type="button"
              onClick={() => { setTab("sub"); }}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === "sub" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Sub-Job
              {selectedMain && <span className="ml-1.5 rounded bg-brand-100 px-1.5 py-0.5 text-xs text-brand-700">{selectedMain.code}</span>}
            </button>
          </div>
        )}

        {tab === "sub" && !selectedMain && !editingId && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            ← Select a main job from the list below to add sub-jobs.
          </p>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Code <span className="text-rose-500">*</span></span>
            <input required value={form.code} onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))}
              placeholder="e.g. M-OIL-01"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Name <span className="text-rose-500">*</span></span>
            <input required value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              placeholder="e.g. Engine oil change"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Category</span>
            <input value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
              placeholder="e.g. Mechanical"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Est. Hours</span>
            <input type="number" min="0" step="0.5" value={form.estimatedHours} onChange={(e) => setForm((c) => ({ ...c, estimatedHours: e.target.value }))}
              placeholder="e.g. 2"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Required Skills</span>
            <input value={form.requiredSkills} onChange={(e) => setForm((c) => ({ ...c, requiredSkills: e.target.value }))}
              placeholder="Comma-separated, e.g. Electrical, Welding"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4" />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Description</span>
            <input value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
              placeholder="Optional notes"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4" />
          </label>
          <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setForm(EMPTY_FORM); setEditingId(null); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting || (tab === "sub" && !selectedMain && !editingId)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {editingId ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </section>

      {/* Two-pane Main → Sub */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Main Jobs */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Main Jobs</h2>
              <p className="mt-0.5 text-xs text-slate-400">{mainJobs.length} records</p>
            </div>
            <input value={searchMain} onChange={(e) => setSearchMain(e.target.value)}
              placeholder="Search..."
              className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-4 ring-brand-100" />
          </div>
          {loadingMain ? (
            <div className="flex justify-center py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin mr-2" /> Loading...</div>
          ) : mainJobs.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">No main jobs yet. Create one above.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {mainJobs.map((job) => (
                <li key={job.id}
                  onClick={() => handleSelectMain(job)}
                  className={`flex cursor-pointer items-center justify-between px-5 py-3 transition hover:bg-slate-50 ${selectedMain?.id === job.id ? "bg-brand-50 border-l-2 border-brand-500" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">{job.code}</span>
                      <span className="truncate text-sm font-medium text-slate-900">{job.name}</span>
                    </div>
                    {job.category && <p className="mt-0.5 text-xs text-slate-500">{job.category}</p>}
                    {(job._count?.subJobs ?? 0) > 0 && (
                      <p className="mt-0.5 text-xs text-brand-600 font-medium">{job._count!.subJobs} sub-job{job._count!.subJobs !== 1 ? "s" : ""}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(job); }}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); void handleDeactivate(job); }}
                      className="rounded p-1.5 text-rose-300 hover:bg-rose-50 hover:text-rose-600" title="Deactivate">
                      <PowerOff size={13} />
                    </button>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Sub Jobs */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Sub-Jobs {selectedMain && <span className="font-normal text-slate-400">/ {selectedMain.name}</span>}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">{selectedMain ? `${subJobs.length} records` : "Select a main job"}</p>
            </div>
            {selectedMain && (
              <input value={searchSub} onChange={(e) => setSearchSub(e.target.value)}
                placeholder="Search..."
                className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-4 ring-brand-100" />
            )}
          </div>
          {!selectedMain ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-slate-400">
              <Layers size={28} className="mb-2 text-slate-200" />
              Click a main job to view its sub-jobs
            </div>
          ) : loadingSub ? (
            <div className="flex justify-center py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin mr-2" /> Loading...</div>
          ) : subJobs.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No sub-jobs yet for <strong>{selectedMain.name}</strong>.<br />
              <button type="button" onClick={() => setTab("sub")} className="mt-2 text-brand-600 underline text-xs">Add one above</button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {subJobs.map((job) => (
                <li key={job.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-semibold text-brand-700">{job.code}</span>
                      <span className="truncate text-sm font-medium text-slate-900">{job.name}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-500">
                      {job.category && <span>{job.category}</span>}
                      {job.estimatedHours && <span className="text-slate-400">· {job.estimatedHours}h</span>}
                      {(job.requiredSkills ?? []).length > 0 && (
                        <span className="text-slate-400">· {job.requiredSkills!.join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleEdit(job)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => void handleDeactivate(job)}
                      className="rounded p-1.5 text-rose-300 hover:bg-rose-50 hover:text-rose-600" title="Deactivate">
                      <PowerOff size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
