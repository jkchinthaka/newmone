"use client";
import { useMemo, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { startAccessPreview } from "@/lib/access-preview";
import type { AdminUserAccessRow } from "@/lib/admin-users";

export function AccessBulkPanel({ users, permissions, currentUserId, tenantId }: {
  users: AdminUserAccessRow[]; permissions: Array<{ key: string }>; currentUserId: string | null; tenantId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [key, setKey] = useState("");
  const [effect, setEffect] = useState("GRANT");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Array<{ userId: string; saved: boolean; message: string }>>([]);
  const eligible = useMemo(() => users.filter((u) => u.id !== currentUserId && u.roleName !== "SUPER_ADMIN" && u.tenantId === tenantId), [users, currentUserId, tenantId]);
  const visible = eligible.filter((u) => `${u.displayName} ${u.email}`.toLowerCase().includes(search.toLowerCase()));
  const apply = async () => {
    setBusy(true); setMessage(""); setResults([]);
    try {
      const response = await apiClient.post<{ data: Array<{ userId: string; saved: boolean; message: string }> }>("/admin/users/permission-overrides/bulk", {
        userIds: selected, permissionKey: key, effect, expiresAt: expiresAt || null, reason
      });
      setResults(response.data.data);
      setMessage("Bulk apply finished. Review each user's result below.");
    } catch (error) { setMessage(getApiErrorMessage(error, "Could not apply permissions.")); }
    finally { setBusy(false); }
  };
  return <details className="rounded-xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer font-semibold">Access Studio: bulk permissions and preview</summary>
    <p className="my-2 text-sm text-slate-600">Choose users in the active tenant. Each save is audited. Existing overrides are reported without replacement.</p>
    <label className="block text-sm">Search users<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="my-2 block min-h-11 w-full rounded border p-2" /></label>
    <ul className="max-h-64 overflow-y-auto">{visible.map((u) => <li key={u.id} className="flex flex-wrap items-center gap-3 border-b py-2">
      <label className="flex min-h-11 flex-1 items-center gap-2"><input type="checkbox" checked={selected.includes(u.id)} disabled={busy} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, u.id] : ids.filter((id) => id !== u.id))} />{u.displayName || u.email}</label>
      <button type="button" disabled={!u.isActive || busy} onClick={() => startAccessPreview(u.id, u.displayName || u.email)} className="min-h-11 rounded border px-3 disabled:opacity-50">Preview read-only</button>
    </li>)}</ul>
    {!visible.length && <p className="text-sm">No eligible users found.</p>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label>Permission<select aria-label="Permission" value={key} onChange={(e) => setKey(e.target.value)} className="block min-h-11 w-full rounded border p-2"><option value="">Choose permission</option>{permissions.map((p) => <option key={p.key}>{p.key}</option>)}</select></label>
      <label>Effect<select aria-label="Effect" value={effect} onChange={(e) => setEffect(e.target.value)} className="block min-h-11 w-full rounded border p-2"><option value="GRANT">Grant</option><option value="DENY">Deny</option></select></label>
      <label>Expiry (optional)<input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="block min-h-11 w-full rounded border p-2" /></label>
      <label>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} className="block min-h-11 w-full rounded border p-2" /></label>
    </div>
    <button type="button" disabled={busy || !key || !reason.trim() || !selected.length || selected.length > 50} onClick={() => void apply()} className="mt-3 min-h-11 rounded bg-slate-900 px-4 text-white disabled:opacity-50">{busy ? "Applying…" : `Apply to ${selected.length} users`}</button>
    <p role="status" className="mt-2 text-sm">{message}</p>
    <ul className="text-sm">{results.map((r) => <li key={r.userId}>{eligible.find((u) => u.id === r.userId)?.displayName || r.userId}: {r.saved ? "Saved" : r.message}</li>)}</ul>
  </details>;
}
