"use client";

import { TableLoadingRows } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/page-state";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Download, Loader2, Plus, Truck } from "lucide-react";
import { toast } from "sonner";

import { VendorFormDialog, type VendorRecord } from "@/components/procurement/vendor-form-dialog";
import { BulkImportButton } from "@/components/bulk-import/bulk-import-button";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { downloadBulkImportTemplate, triggerBlobDownload } from "@/lib/bulk-import-api";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

interface Supplier extends VendorRecord {
  id: string;
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
  const [loadError, setLoadError] = useState<unknown>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VendorRecord | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ data: Supplier[] }>("/suppliers");
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

  const downloadTemplate = async () => {
    try {
      const blob = await downloadBulkImportTemplate("supplier");
      triggerBlobDownload(blob, "suppliers-import-template.csv");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not download the import template."));
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
            <h1 className="page-title">Vendors</h1>
            <p className="mt-1 text-sm text-slate-500">
              Companies you buy parts from or send work to. Used by inventory, purchase orders and jobs. Optional ERP sync can refresh vendor records — see{" "}
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
                onClick={() => { setEditing(null); setDialogOpen(true); }}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Plus size={14} aria-hidden /> Add vendor
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
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">All vendors</h2>
          </div>
          <p className="text-xs text-slate-400">{loadError ? "" : loading && items.length === 0 ? "…" : `${items.length} records`}</p>
        </div>

        {loadError ? (
          <ErrorState title="Couldn't load vendors" error={loadError} onRetry={() => void refresh()} />
        ) : loading && items.length === 0 ? (
          <TableLoadingRows label="Loading vendors" />
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            {canCreate
              ? isSuperAdmin
                ? "No vendors yet. Add one manually, or use Bulk Upload with the CSV template."
                : "No vendors yet. Use “Add vendor” to create your first record."
              : "No vendors are available for your company yet."}
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
                  <th className="px-5 py-2" />
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
                    <td className="px-5 py-3 text-right">
                      {canCreate ? (
                        <button type="button" className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50" onClick={() => { setEditing(supplier); setDialogOpen(true); }}>
                          Edit
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <VendorFormDialog
        open={dialogOpen}
        vendor={editing}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
