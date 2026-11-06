"use client";

import { ButtonSpinner, TableLoadingRows } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/page-state";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Pencil, Plus, PowerOff, X } from "lucide-react";
import { toast } from "sonner";

import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { BulkImportButton } from "@/components/bulk-import/bulk-import-button";
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
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const refresh = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ data: Department[] }>("/departments", {
        params: q ? { q } : {},
      });
      setItems(Array.isArray(response.data?.data) ? response.data.data : []);
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
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
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        description: form.description.trim() || undefined,
        parentId: form.parentId ?? null,
        managerId: form.managerId ?? null,
      };
      if (editingId) {
        await apiClient.put(`/departments/${editingId}`, payload);
        toast.success("Department updated");
        setEditingId(null);
      } else {
        await apiClient.post("/departments", payload);
        toast.success(`Department "${form.name.trim()}" created`);
      }
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await refresh(search.trim() || undefined);
    } catch (error) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
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
    setFormOpen(true);
  };

  const handleDeactivate = async (dept: Department) => {
    const confirmed = await confirm({
      title: `Deactivate ${dept.name}?`,
      description: "This department will no longer appear in dropdowns. Existing records are not deleted.",
      confirmLabel: "Deactivate department",
      cancelLabel: "Keep active",
      variant: "destructive"
    });
    if (!confirmed) return;
    try {
      await apiClient.delete(`/departments/${dept.id}`);
      toast.success(`"${dept.name}" deactivated`);
      setItems((cur) => cur.filter((d) => d.id !== dept.id));
    } catch {
      toast.error("Failed to deactivate");
    }
  };

  const sorted = [...items].sort((x, y) => x.name.localeCompare(y.name));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={"/master-data" as Route}
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 hover:underline"
          >
            <ArrowLeft size={12} aria-hidden /> Master Data
          </Link>
          <h1 className="page-title">Departments</h1>
          <p className="mt-1 text-sm text-slate-500">Organisational units used across vehicles, assets, drivers and users.</p>
        </div>
        <button type="button" onClick={openNew} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
          <Plus size={14} aria-hidden /> Add department
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code…"
          aria-label="Search departments"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
        />
        <BulkImportButton entity="department" entityLabel="Departments" onImported={() => refresh(search.trim() || undefined)} />
        <span className="ml-auto text-xs text-slate-500">{loadError ? "" : loading && items.length === 0 ? "…" : `${items.length} departments`}</span>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loadError ? (
          <ErrorState title="Couldn't load departments" error={loadError} onRetry={() => void refresh(search.trim() || undefined)} />
        ) : loading && items.length === 0 ? (
          <TableLoadingRows label="Loading departments" />
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            {search ? "No departments match your search." : "No departments yet. Use “Add department” to create one."}
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Code</th>
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Parent</th>
                <th className="px-4 py-2.5 font-semibold">Manager</th>
                <th className="px-4 py-2.5 font-semibold">Used by</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((dept) => {
                const used = [
                  dept._count?.users ? `${dept._count.users} users` : null,
                  dept._count?.assets ? `${dept._count.assets} assets` : null,
                  dept._count?.vehicles ? `${dept._count.vehicles} vehicles` : null
                ].filter(Boolean);
                return (
                  <tr key={dept.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5"><span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">{dept.code}</span></td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-900">{dept.name}</span>
                      {dept.description ? <span className="block max-w-xs truncate text-xs text-slate-500">{dept.description}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{dept.parent?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{dept.manager ? `${dept.manager.firstName} ${dept.manager.lastName}` : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{used.length ? used.join(" · ") : "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => handleEdit(dept)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Edit" aria-label={`Edit ${dept.name}`}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={() => void handleDeactivate(dept)} className="rounded p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600" title="Deactivate" aria-label={`Deactivate ${dept.name}`}>
                          <PowerOff size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" data-sheet role="presentation">
          <div role="dialog" aria-modal="true" aria-label={editingId ? "Edit department" : "New department"} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{editingId ? "Edit department" : "New department"}</h2>
              <button type="button" onClick={closeForm} aria-label="Close" className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"><X size={14} /></button>
            </div>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
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
            <span className="font-medium">Code</span>
            <input
              value={form.code}
              onChange={(e) => setForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))}
              placeholder="Optional; generated from name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
            />
          </label>

          {/* Description */}
          <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
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
          <div className="flex items-end justify-end gap-2 sm:col-span-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <ButtonSpinner className="h-3.5 w-3.5" /> : <Plus size={14} />}
              {editingId ? "Update" : "Save"}
            </button>
          </div>
        </form>
          </div>
        </div>
      ) : null}
      {confirmDialog}
    </div>
  );
}
