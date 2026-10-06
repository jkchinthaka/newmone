"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Download, Loader2, Plus, Truck } from "lucide-react";
import { toast } from "sonner";

import { BulkImportButton } from "@/components/bulk-import/bulk-import-button";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { downloadBulkImportTemplate, triggerBlobDownload } from "@/lib/bulk-import-api";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

interface Supplier {
  id: string;
  vendorCode: string | null;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  blacklisted: boolean;
}

const CREATE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER", "OPERATIONS_MANAGER"]);

export default function SuppliersPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const canCreate = CREATE_ROLES.has(roleName ?? "");
  const isSuperAdmin = roleName === "SUPER_ADMIN";

  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ vendorCode: "", name: "", contactName: "", email: "", phone: "" });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ data: Supplier[] }>("/suppliers");
      setItems(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch {
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const downloadTemplate = async () => {
    try {
      const blob = await downloadBulkImportTemplate("supplier");
      triggerBlobDownload(blob, "suppliers-import-template.csv");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not download the import template."));
    }
  };

  const submitSupplier = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/suppliers", {
        name: form.name.trim(),
        vendorCode: form.vendorCode.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined
      });
      toast.success("Supplier created");
      setDialogOpen(false);
      setForm({ vendorCode: "", name: "", contactName: "", email: "", phone: "" });
      await refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not create supplier."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <header>
        <Link
          href={"/master-data" as Route}
          className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 hover:underline"
        >
          <ArrowLeft size={12} aria-hidden /> Master Data
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Suppliers</h1>
            <p className="mt-1 text-sm text-slate-500">
              MaintainPro owns supplier master data for inventory, purchase orders, and work orders. Optional ERP sync
              can refresh vendor records — see{" "}
              <Link href={"/erp/mock-sync" as Route} className="font-medium text-brand-700 hover:underline">
                ERP mock sync
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate ? (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Plus size={14} aria-hidden /> Add Supplier
              </button>
            ) : null}
            {isSuperAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => void downloadTemplate()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download size={14} aria-hidden /> Download Template
                </button>
                <BulkImportButton entity="supplier" entityLabel="Suppliers" onImported={refresh} />
              </>
            ) : null}
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-brand-600" aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">All Suppliers</h2>
          </div>
          <p className="text-xs text-slate-400">{items.length} records</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-sm text-slate-400">
            <Loader2 size={16} className="mr-2 animate-spin" aria-hidden /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            {canCreate
              ? isSuperAdmin
                ? "No suppliers yet. Add one manually, or use Bulk Upload with the CSV template."
                : "No suppliers yet. Use Add Supplier to create your first record."
              : "No suppliers are available for your tenant yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2">Vendor Code</th>
                  <th className="px-5 py-2">Name</th>
                  <th className="px-5 py-2">Contact</th>
                  <th className="px-5 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((supplier) => (
                  <tr key={supplier.id}>
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-700">{supplier.vendorCode ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-900">{supplier.name}</td>
                    <td className="px-5 py-3 text-slate-500">{supplier.contactName ?? supplier.email ?? supplier.phone ?? "—"}</td>
                    <td className="px-5 py-3">
                      {supplier.blacklisted ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">Blacklisted</span>
                      ) : supplier.isActive ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialogOpen ? (
        <form
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onSubmit={(event) => void submitSupplier(event)}
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Add Supplier</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                Name *
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
              <label className="block text-sm">
                Vendor code
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={form.vendorCode}
                  onChange={(event) => setForm((current) => ({ ...current, vendorCode: event.target.value }))}
                />
              </label>
              <label className="block text-sm">
                Contact name
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={form.contactName}
                  onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                />
              </label>
              <label className="block text-sm">
                Email
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
              <label className="block text-sm">
                Phone
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Saving…" : "Create Supplier"}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
