"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Building2, ChevronDown, ChevronRight, Loader2, Pencil, Plus, PowerOff } from "lucide-react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api-client";
import { EntityPicker } from "@/components/ui/entity-picker";

interface Department extends Record<string, unknown> {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  parentId?: string | null;
  managerId?: string | null;
  parent?: { id: string; name: string; code: string } | null;
  manager?: { id: string; firstName: string; lastName: string; email: string } | null;
  _count?: { children: number; assets: number; vehicles: number; users: number };
}

interface FormState {
  name: string;
  code: string;
  description: string;
  parentId: string | null;
  parentDisplay: string;
  managerId: string | null;
  managerDisplay: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  description: "",
  parentId: null,
  parentDisplay: "",
  managerId: null,
  managerDisplay: "",
};

export default function DepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ data: Department[] }>("/departments", {
        params: q ? { q } : {},
      });
      setItems(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch {
      toast.error("Failed to load departments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const h = window.setTimeout(() => void refresh(search.trim() || undefined), 250);
    return () => window.clearTimeout(h);
  }, [search, refresh]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) { toast.error("`name` is required"); return; }
    if (!form.code.trim()) { toast.error("`code` is required"); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim() || undefined,
        parentId: form.parentId ?? null,
        managerId: form.managerId ?? null,
      };
      if (editingId) {
        await apiClient.patch(`/departments/${editingId}`, payload);
        toast.success("Department updated");
        setEditingId(null);
      } else {
        await apiClient.post("/departments", payload);
        toast.success(`Department "${form.name.trim()}" created`);
      }
      setForm(EMPTY_FORM);
      await refresh(search.trim() || undefined);
    } catch (error) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingId(dept.id);
    setForm({
      name: dept.name,
      code: dept.code,
      description: dept.description ?? "",
      parentId: dept.parentId ?? null,
      parentDisplay: dept.parent ? `${dept.parent.code} — ${dept.parent.name}` : "",
      managerId: dept.managerId ?? null,
      managerDisplay: dept.manager
        ? `${dept.manager.firstName} ${dept.manager.lastName}`
        : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeactivate = async (dept: Department) => {
    if (
      !window.confirm(`Deactivate department "${dept.name}"? It will no longer appear in dropdowns.`)
    ) return;
    try {
      await apiClient.patch(`/departments/${dept.id}/deactivate`);
      toast.success(`"${dept.name}" deactivated`);
      setItems((cur) => cur.filter((d) => d.id !== dept.id));
    } catch {
      toast.error("Failed to deactivate");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const topLevel = items.filter((d) => !d.parentId);
  const childrenOf = (parentId: string) => items.filter((d) => d.parentId === parentId);

  return (
    <div className="space-y-6 p-6">
      <header>
        <Link
          href={"/master-data" as Route}
          className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 hover:underline"
        >
          <ArrowLeft size={12} aria-hidden /> Master Data
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Departments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage organisational units used across vehicles, assets, drivers and users.
        </p>
      </header>

      {/* ── Form ──────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-brand-600" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            {editingId ? "Edit department" : "New department"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Name */}
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">
              Name <span className="text-rose-500">*</span>
            </span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              placeholder="e.g. Engineering"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
            />
          </label>

          {/* Code */}
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">
              Code <span className="text-rose-500">*</span>
            </span>
            <input
              required
              value={form.code}
              onChange={(e) => setForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. ENG"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
            />
          </label>

          {/* Description */}
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
              placeholder="Optional"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
            />
          </label>

          {/* Parent Department — EntityPicker */}
          <div className="space-y-1 text-sm text-slate-700">
            <span className="block font-medium">Parent Department</span>
            <EntityPicker<Department>
              endpoint="/departments"
              placeholder="Search departments…"
              value={form.parentId}
              initialDisplay={form.parentDisplay || undefined}
              displayField="name"
              secondaryField="code"
              extraParams={editingId ? { exclude: editingId } : undefined}
              onChange={(id, entity) =>
                setForm((c) => ({
                  ...c,
                  parentId: id,
                  parentDisplay: entity ? `${entity.code} — ${entity.name}` : "",
                }))
              }
            />
          </div>

          {/* Manager — EntityPicker over users */}
          <div className="space-y-1 text-sm text-slate-700">
            <span className="block font-medium">Manager</span>
            <EntityPicker<{ id: string; firstName: string; lastName: string; email: string }>
              endpoint="/users"
              placeholder="Search users…"
              value={form.managerId}
              initialDisplay={form.managerDisplay || undefined}
              displayField="firstName"
              secondaryField="email"
              onChange={(id, entity) =>
                setForm((c) => ({
                  ...c,
                  managerId: id,
                  managerDisplay: entity
                    ? `${entity.firstName} ${entity.lastName}`
                    : "",
                }))
              }
            />
          </div>

          {/* Actions */}
          <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-3">
            <button
              type="button"
              onClick={() => { setForm(EMPTY_FORM); setEditingId(null); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {editingId ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </section>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              All Departments
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{items.length} records</p>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-sm text-slate-400">
            <Loader2 size={16} className="mr-2 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            {search
              ? "No departments match your search."
              : "No departments yet. Create one above."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(search ? items : topLevel).map((dept) => {
              const children = childrenOf(dept.id);
              const expanded = expandedIds.has(dept.id);
              return (
                <li key={dept.id}>
                  {/* ── Row ── */}
                  <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {/* Expand toggle (top-level only, not searching) */}
                      {!search && children.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(dept.id)}
                          className="text-slate-400 hover:text-slate-600"
                          aria-label={expanded ? "Collapse" : "Expand"}
                        >
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      ) : (
                        <span className="w-[14px]" />
                      )}
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                        {dept.code}
                      </span>
                      <span className="truncate text-sm font-medium text-slate-900">{dept.name}</span>
                      {dept.manager && (
                        <span className="hidden sm:inline text-xs text-slate-400">
                          · {dept.manager.firstName} {dept.manager.lastName}
                        </span>
                      )}
                      {dept.description && (
                        <span className="hidden md:inline truncate text-xs text-slate-400">
                          · {dept.description}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {dept._count && (
                        <div className="hidden gap-2 sm:flex text-xs text-slate-400">
                          {(dept._count.assets ?? 0) > 0 && (
                            <span>{dept._count.assets} assets</span>
                          )}
                          {(dept._count.vehicles ?? 0) > 0 && (
                            <span>{dept._count.vehicles} vehicles</span>
                          )}
                          {(dept._count.users ?? 0) > 0 && (
                            <span>{dept._count.users} users</span>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEdit(dept)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeactivate(dept)}
                        className="rounded p-1.5 text-rose-300 hover:bg-rose-50 hover:text-rose-600"
                        title="Deactivate"
                      >
                        <PowerOff size={13} />
                      </button>
                    </div>
                  </div>

                  {/* ── Sub-departments ── */}
                  {!search && expanded && children.length > 0 && (
                    <ul className="divide-y divide-slate-50 bg-slate-50/50">
                      {children.map((child) => (
                        <li
                          key={child.id}
                          className="flex items-center justify-between px-5 py-2.5 pl-12 hover:bg-slate-100/50"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">
                              {child.code}
                            </span>
                            <span className="truncate text-sm text-slate-800">{child.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(child)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeactivate(child)}
                              className="rounded p-1.5 text-rose-300 hover:bg-rose-50 hover:text-rose-600"
                              title="Deactivate"
                            >
                              <PowerOff size={12} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
