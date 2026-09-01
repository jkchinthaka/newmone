"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";

import { BulkImportButton } from "@/components/bulk-import/bulk-import-button";
import { apiClient } from "@/lib/api-client";

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

export default function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

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
              Parts and service providers referenced by inventory, purchase orders and work orders.
            </p>
          </div>
          <BulkImportButton entity="supplier" entityLabel="Suppliers" onImported={refresh} />
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
          <div className="py-12 text-center text-sm text-slate-400">
            No suppliers yet. Use Bulk Upload to import your supplier master list.
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
    </div>
  );
}
