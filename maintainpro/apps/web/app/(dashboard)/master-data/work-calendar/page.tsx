"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";

interface Entry {
  id: string;
  kind: "HOLIDAY" | "SHIFT";
  name: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

const inputCls = "min-h-11 rounded-md border border-slate-300 px-3 text-sm";
const btnCls = "inline-flex min-h-11 items-center gap-1 rounded-md bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50";

export default function WorkCalendarPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hName, setHName] = useState("");
  const [hDate, setHDate] = useState("");
  const [sName, setSName] = useState("");
  const [sStart, setSStart] = useState("08:00");
  const [sEnd, setSEnd] = useState("17:00");

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: Entry[] }>("/master-data/work-calendar");
      setEntries(res.data.data ?? []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load the work calendar."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(body: Record<string, string>, reset: () => void) {
    setBusy(true);
    try {
      await apiClient.post("/master-data/work-calendar", body);
      reset();
      toast.success("Added.");
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not add it."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiClient.delete(`/master-data/work-calendar/${id}`);
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not remove it."));
    }
  }

  const shifts = entries.filter((e) => e.kind === "SHIFT");
  const holidays = entries.filter((e) => e.kind === "HOLIDAY");

  return (
    <div className="space-y-6 p-6">
      <Link href={"/master-data" as Route} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={14} /> Master data
      </Link>
      <header>
        <h1 className="page-title">Work calendar</h1>
        <p className="text-sm text-slate-600">Shifts and holidays, so due dates and schedules skip days nobody works.</p>
      </header>

      <section className="max-w-xl space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Shifts</h2>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void add({ kind: "SHIFT", name: sName, startTime: sStart, endTime: sEnd }, () => setSName("")); }}>
          <input className={`${inputCls} min-w-[160px] flex-1`} placeholder="Shift name, e.g. Day shift" value={sName} maxLength={200} onChange={(e) => setSName(e.target.value)} />
          <input type="time" className={inputCls} value={sStart} onChange={(e) => setSStart(e.target.value)} aria-label="Start time" />
          <input type="time" className={inputCls} value={sEnd} onChange={(e) => setSEnd(e.target.value)} aria-label="End time" />
          <button type="submit" disabled={busy || !sName.trim() || !sStart || !sEnd} className={btnCls}><Plus size={14} /> Add</button>
        </form>
        <List rows={shifts} loading={loading} empty="No shifts yet." label={(e) => `${e.startTime} – ${e.endTime}`} onRemove={remove} />
      </section>

      <section className="max-w-xl space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Holidays & closures</h2>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void add({ kind: "HOLIDAY", name: hName, date: hDate }, () => { setHName(""); setHDate(""); }); }}>
          <input className={`${inputCls} min-w-[160px] flex-1`} placeholder="Holiday, e.g. Poya day" value={hName} maxLength={200} onChange={(e) => setHName(e.target.value)} />
          <input type="date" className={inputCls} value={hDate} onChange={(e) => setHDate(e.target.value)} aria-label="Date" />
          <button type="submit" disabled={busy || !hName.trim() || !hDate} className={btnCls}><Plus size={14} /> Add</button>
        </form>
        <List rows={holidays} loading={loading} empty="No holidays yet." label={(e) => (e.date ? new Date(e.date).toLocaleDateString(undefined, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }) : "")} onRemove={remove} />
      </section>
    </div>
  );
}

function List({ rows, loading, empty, label, onRemove }: { rows: Entry[]; loading: boolean; empty: string; label: (e: Entry) => string; onRemove: (id: string) => void }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {loading ? <li className="p-4 text-sm text-slate-500">Loading...</li> : null}
      {!loading && rows.length === 0 ? <li className="p-4 text-sm text-slate-500">{empty}</li> : null}
      {rows.map((e) => (
        <li key={e.id} className="flex items-center justify-between px-4 py-2 text-sm">
          <span>{e.name} <span className="ml-2 text-xs text-slate-500">{label(e)}</span></span>
          <button type="button" onClick={() => onRemove(e.id)} className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-red-600">
            <Trash2 size={12} /> Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
