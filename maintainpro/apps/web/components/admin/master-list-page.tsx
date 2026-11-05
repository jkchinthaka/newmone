"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Plus, Power } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";

interface Item {
  id: string;
  name: string;
  code?: string | null;
  isActive: boolean;
}

interface Props {
  kind: "unit" | "skill" | "make";
  title: string;
  help: string;
  placeholder: string;
  showCode?: boolean;
  codePlaceholder?: string;
}

/** One simple page for every master pick-list: add a name, turn it off, done. */
export function MasterListPage({ kind, title, help, placeholder, showCode, codePlaceholder }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: Item[] }>(`/master-data/lists/${kind}`, { params: { includeInactive: true } });
      setItems(res.data.data ?? []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load the list."));
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await apiClient.post(`/master-data/lists/${kind}`, { name, code: showCode ? code : undefined });
      setName("");
      setCode("");
      toast.success("Added.");
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not add it."));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: Item) {
    try {
      await apiClient.patch(`/master-data/lists/${kind}/${item.id}`, { isActive: !item.isActive });
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not update it."));
    }
  }

  return (
    <div className="space-y-4 p-6">
      <Link href={"/master-data" as Route} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={14} /> Master data
      </Link>
      <header>
        <h1 className="page-title">{title}</h1>
        <p className="text-sm text-slate-600">{help}</p>
      </header>
      <form
        className="flex max-w-xl flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input className="min-h-11 min-w-[200px] flex-1 rounded-md border border-slate-300 px-3 text-sm" placeholder={placeholder} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        {showCode ? (
          <input className="min-h-11 w-32 rounded-md border border-slate-300 px-3 text-sm" placeholder={codePlaceholder ?? "Short form"} value={code} maxLength={40} onChange={(e) => setCode(e.target.value)} />
        ) : null}
        <button type="submit" disabled={busy || !name.trim()} className="inline-flex min-h-11 items-center gap-1 rounded-md bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50">
          <Plus size={14} /> Add
        </button>
      </form>
      <ul className="max-w-xl divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {loading ? <li className="p-4 text-sm text-slate-500">Loading...</li> : null}
        {!loading && items.length === 0 ? <li className="p-4 text-sm text-slate-500">Nothing here yet. Add the first one above.</li> : null}
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className={item.isActive ? "" : "text-slate-400 line-through"}>
              {item.name}
              {item.code ? <span className="ml-2 font-mono text-xs text-slate-500">{item.code}</span> : null}
            </span>
            <button type="button" onClick={() => void toggle(item)} className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900">
              <Power size={12} /> {item.isActive ? "Turn off" : "Turn on"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
