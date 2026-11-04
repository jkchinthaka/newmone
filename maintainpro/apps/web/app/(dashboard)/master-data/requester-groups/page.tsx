"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";

interface Person {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}
interface Group {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  members: Person[];
}

const personName = (p: Person) => [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || p.id;

export default function RequesterGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: Group[] }>("/master-data/requester-groups", { params: { includeInactive: true } });
      setGroups(res.data.data ?? []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load requester groups."));
    }
  }, []);

  useEffect(() => {
    void load();
    apiClient
      .get<{ data: Person[] | { items?: Person[] } }>("/users", { params: { pageSize: 200 } })
      .then((res) => {
        const body = res.data.data;
        setPeople(Array.isArray(body) ? body : body?.items ?? []);
      })
      .catch(() => setPeople([]));
  }, [load]);

  function open(group: Group | null) {
    setEditing(group ? group.id : "new");
    setName(group?.name ?? "");
    setDescription(group?.description ?? "");
    setMemberIds(group?.members.map((m) => m.id) ?? []);
    setFilter("");
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (editing === "new") await apiClient.post("/master-data/requester-groups", { name, description, memberIds });
      else await apiClient.patch(`/master-data/requester-groups/${editing}`, { name, description, memberIds });
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not save the group."));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(group: Group) {
    try {
      await apiClient.patch(`/master-data/requester-groups/${group.id}`, { isActive: !group.isActive });
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not update the group."));
    }
  }

  const shown = people.filter((p) => personName(p).toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4 p-6">
      <Link href={"/master-data" as Route} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={14} /> Master data
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="page-title">Requester groups</h1>
          <p className="text-sm text-slate-600">Group the people who raise requests together. Approval rules can use these groups.</p>
        </div>
        <button type="button" onClick={() => open(null)} className="inline-flex min-h-11 items-center gap-1 rounded-md bg-brand-600 px-4 text-sm font-medium text-white">
          <Plus size={14} /> New group
        </button>
      </header>

      {editing ? (
        <section className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <input className="min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Group name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          <input className="min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Description (optional)" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Members ({memberIds.length})</p>
            <input className="mb-2 min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Search people" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {shown.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={memberIds.includes(p.id)} onChange={(e) => setMemberIds(e.target.checked ? [...memberIds, p.id] : memberIds.filter((id) => id !== p.id))} />
                  {personName(p)}
                </label>
              ))}
              {shown.length === 0 ? <p className="text-xs text-slate-500">No people found.</p> : null}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(null)} className="min-h-11 flex-1 rounded-md border border-slate-300 text-sm">Cancel</button>
            <button type="button" disabled={busy || !name.trim()} onClick={() => void save()} className="min-h-11 flex-1 rounded-md bg-brand-600 text-sm font-medium text-white disabled:opacity-50">Save</button>
          </div>
        </section>
      ) : null}

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {groups.length === 0 ? <li className="p-4 text-sm text-slate-500">No groups yet. Create the first one.</li> : null}
        {groups.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className={`font-medium ${g.isActive ? "" : "text-slate-400 line-through"}`}>{g.name}</p>
              <p className="text-xs text-slate-500">{g.members.length} member(s){g.description ? ` · ${g.description}` : ""}</p>
            </div>
            <div className="flex gap-3 text-xs">
              <button type="button" className="text-brand-700 hover:underline" onClick={() => open(g)}>Edit</button>
              <button type="button" className="text-slate-600 hover:underline" onClick={() => void toggle(g)}>{g.isActive ? "Turn off" : "Turn on"}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
