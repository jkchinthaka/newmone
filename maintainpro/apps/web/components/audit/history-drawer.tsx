"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  fetchEntityAudit,
  type AuditEntry,
  type AuditFieldChange
} from "@/lib/audit-api";
import { canViewAuditHistory, useCurrentUser } from "@/lib/use-current-user";

interface HistoryDrawerProps {
  entity: string;
  entityId: string | null;
  open: boolean;
  onClose: () => void;
  /** Optional friendly title for the entity, e.g. "Work Order WO-12345". */
  title?: string;
}

function actorLabel(entry: AuditEntry): string {
  const actor = entry.actor;
  if (!actor) return "System";
  const name = `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim();
  return name || actor.email || actor.id;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function pairChanges(entry: AuditEntry): AuditFieldChange[][] {
  // For UPDATE: server stores [{field,value}] in BOTH before & after, indexed identically.
  if (entry.action !== "UPDATE") return [];
  const before = Array.isArray(entry.beforeData)
    ? (entry.beforeData as AuditFieldChange[])
    : [];
  const after = Array.isArray(entry.afterData)
    ? (entry.afterData as AuditFieldChange[])
    : [];
  const byField = new Map<string, { before?: unknown; after?: unknown }>();
  for (const c of before) byField.set(c.field, { ...byField.get(c.field), before: c.value });
  for (const c of after) byField.set(c.field, { ...byField.get(c.field), after: c.value });
  return Array.from(byField.entries()).map(([field, v]) => [
    { field, value: v.before } as AuditFieldChange,
    { field, value: v.after } as AuditFieldChange
  ]);
}

function ActionBadge({ action }: { action: AuditEntry["action"] }) {
  const styles: Record<AuditEntry["action"], string> = {
    CREATE: "bg-emerald-100 text-emerald-700",
    UPDATE: "bg-amber-100 text-amber-800",
    DELETE: "bg-rose-100 text-rose-700"
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles[action]}`}>
      {action}
    </span>
  );
}

function EntryCard({ entry }: { entry: AuditEntry }) {
  const changes = pairChanges(entry);
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ActionBadge action={entry.action} />
          <span className="text-sm font-medium text-slate-800">{actorLabel(entry)}</span>
        </div>
        <time className="text-xs text-slate-500">{formatDate(entry.createdAt)}</time>
      </div>

      {entry.action === "UPDATE" && changes.length > 0 && (
        <table className="mt-3 w-full table-auto text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Field</th>
              <th className="py-1 pr-3 font-medium">Before</th>
              <th className="py-1 font-medium">After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {changes.map(([before, after]) => (
              <tr key={before.field}>
                <td className="py-1 pr-3 align-top font-mono text-slate-600">{before.field}</td>
                <td className="py-1 pr-3 align-top text-rose-700">
                  <span className="line-through">{asString(before.value)}</span>
                </td>
                <td className="py-1 align-top text-emerald-700">{asString(after.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {entry.action === "CREATE" && entry.afterData && (
        <pre className="mt-3 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700">
{JSON.stringify(entry.afterData, null, 2)}
        </pre>
      )}

      {entry.action === "DELETE" && entry.beforeData && (
        <pre className="mt-3 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700">
{JSON.stringify(entry.beforeData, null, 2)}
        </pre>
      )}
    </li>
  );
}

export function HistoryDrawer({ entity, entityId, open, onClose, title }: HistoryDrawerProps) {
  const user = useCurrentUser();
  const allowed = canViewAuditHistory(user.role);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const query = useQuery({
    queryKey: ["audit", entity, entityId],
    queryFn: () => fetchEntityAudit(entity, entityId as string),
    enabled: open && allowed && Boolean(entityId)
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true" role="dialog">
      <button
        type="button"
        className="flex-1 bg-slate-900/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close history"
      />
      <aside className="flex w-full max-w-md flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Change history</p>
            <h2 className="text-sm font-semibold text-slate-900">{title ?? `${entity} ${entityId ?? ""}`}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!allowed && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              You don&rsquo;t have permission to view change history. Contact an administrator.
            </p>
          )}

          {allowed && query.isLoading && (
            <p className="text-sm text-slate-500">Loading history…</p>
          )}

          {allowed && query.isError && (
            <p className="text-sm text-rose-600">Failed to load history.</p>
          )}

          {allowed && query.data && query.data.data.length === 0 && (
            <p className="text-sm text-slate-500">No recorded changes yet.</p>
          )}

          {allowed && query.data && query.data.data.length > 0 && (
            <ul className="space-y-3">
              {query.data.data.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

export default HistoryDrawer;
