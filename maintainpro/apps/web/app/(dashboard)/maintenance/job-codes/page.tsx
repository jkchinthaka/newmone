"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api-client";

interface JobCode {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface FormState {
  code: string;
  name: string;
  category: string;
  description: string;
}

const EMPTY_FORM: FormState = { code: "", name: "", category: "", description: "" };

export default function JobCodesPage() {
  const [items, setItems] = useState<JobCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");

  const refresh = useCallback(
    async (q?: string) => {
      setLoading(true);
      try {
        const response = await apiClient.get("/job-codes", { params: q ? { q } : {} });
        const list = Array.isArray(response.data?.data) ? (response.data.data as JobCode[]) : [];
        setItems(list);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load job codes";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Debounce search
  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refresh(search.trim() || undefined);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [search, refresh]);

  const grouped = useMemo(() => {
    const map = new Map<string, JobCode[]>();
    for (const item of items) {
      const key = item.category?.trim() || "Uncategorized";
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Code and Name are required");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post("/job-codes", {
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        description: form.description.trim() || undefined
      });
      toast.success(`Job code "${form.code.trim()}" created`);
      setForm(EMPTY_FORM);
      await refresh(search.trim() || undefined);
    } catch (error) {
      const detail =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (error instanceof Error ? error.message : "Failed to create job code");
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: JobCode) => {
    if (!window.confirm(`Delete job code "${item.code}"? This cannot be undone.`)) return;
    setDeletingId(item.id);
    try {
      await apiClient.delete(`/job-codes/${item.id}`);
      toast.success(`Job code "${item.code}" deleted`);
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete job code";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/maintenance"
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 hover:underline"
          >
            <ArrowLeft size={12} aria-hidden /> Maintenance
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">Job Codes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage the standard job codes used across maintenance, work orders, and time-tracking forms.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Create new job code</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">
              Code <span className="text-rose-500">*</span>
            </span>
            <input
              required
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="e.g. M-OIL-01"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">
              Name <span className="text-rose-500">*</span>
            </span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Engine oil change"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Category</span>
            <input
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="e.g. Mechanical"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Description</span>
            <input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional notes"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
            />
          </label>
          <div className="sm:col-span-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setForm(EMPTY_FORM)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add Job Code
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">All job codes</h2>
            <p className="mt-1 text-xs text-slate-500">{items.length} total</p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by code, name or category..."
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            <Loader2 size={16} className="mr-2 animate-spin" /> Loading job codes...
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            {search.trim()
              ? "No job codes match your search."
              : "No job codes yet. Add your first one above."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {grouped.map(([category, rows]) => (
              <div key={category}>
                <div className="bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {category}
                </div>
                <ul className="divide-y divide-slate-100">
                  {rows.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                            {item.code}
                          </span>
                          <span className="truncate text-sm font-medium text-slate-900">{item.name}</span>
                        </div>
                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === item.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
