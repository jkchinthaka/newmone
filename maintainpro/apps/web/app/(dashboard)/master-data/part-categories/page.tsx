"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Plus, Power } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";

interface Category {
  id: string;
  code?: string | null;
  name: string;
  isActive: boolean;
}

export default function PartCategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: Category[] }>("/master-data/part-categories", { params: { includeInactive: true } });
      setItems(res.data.data ?? []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load categories."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await apiClient.post("/master-data/part-categories", { name });
      setName("");
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not add the category."));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: Category) {
    try {
      await apiClient.patch(`/master-data/part-categories/${item.id}`, { isActive: !item.isActive });
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not update the category."));
    }
  }

  return (
    <div className="space-y-4 p-6">
      <Link href={"/master-data" as Route} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={14} /> Master data
      </Link>
      <header>
        <h1 className="page-title">Spare part categories</h1>
        <p className="text-sm text-slate-600">Every new spare part must pick one of these. Add a category once and reuse it.</p>
      </header>
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm" placeholder="New category, e.g. Bearings" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        <button type="submit" disabled={busy || !name.trim()} className="inline-flex min-h-11 items-center gap-1 rounded-md bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50">
          <Plus size={14} /> Add
        </button>
      </form>
      <ul className="max-w-md divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {items.length === 0 ? <li className="p-4 text-sm text-slate-500">No categories yet.</li> : null}
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className={item.isActive ? "" : "text-slate-400 line-through"}>{item.name}{item.code ? <span className="ml-2 font-mono text-xs text-slate-500">{item.code}</span> : null}</span>
            <button type="button" onClick={() => void toggle(item)} className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900">
              <Power size={12} /> {item.isActive ? "Turn off" : "Turn on"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
