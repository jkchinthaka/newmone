"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";

import { createRole, updateRolePermissions } from "@/lib/admin-roles-api";
import {
  formatPermissionModuleLabel,
  formatRoleLabel,
  groupRolesForList,
  humanizePermissionKey,
  type AdminRoleReviewRow,
  type AdminRolesPermissionsMatrix
} from "@/lib/admin-roles";

type Props = {
  matrix: AdminRolesPermissionsMatrix;
  canEdit: boolean;
  onChanged: () => void;
};

/** Left: roles. Right: the chosen role's permissions as switches, grouped by module. */
export function RolesWorkspace({ matrix, canEdit, onChanged }: Props) {
  const [roleSearch, setRoleSearch] = useState("");
  const [permSearch, setPermSearch] = useState("");
  const [grantedOnly, setGrantedOnly] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const visibleRoles = useMemo(() => {
    const needle = roleSearch.trim().toLowerCase();
    return matrix.roles.filter((role) => !needle || formatRoleLabel(role.name).toLowerCase().includes(needle));
  }, [matrix.roles, roleSearch]);
  const groups = useMemo(() => groupRolesForList(visibleRoles), [visibleRoles]);
  const role: AdminRoleReviewRow | null = matrix.roles.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && matrix.roles.length > 0) setSelectedId(matrix.roles[0]!.id);
  }, [matrix.roles, selectedId]);

  const saved = useMemo(() => new Set(role?.permissionKeys ?? []), [role]);
  useEffect(() => {
    setDraft(new Set(saved));
    setOpen(new Set());
    setPermSearch("");
  }, [saved, selectedId]);

  const changed = useMemo(
    () => [...new Set([...saved, ...draft])].filter((key) => saved.has(key) !== draft.has(key)).length,
    [saved, draft]
  );

  const save = useMutation({
    mutationFn: async () => {
      const ids = matrix.permissions.filter((p) => draft.has(p.key)).map((p) => p.id);
      return updateRolePermissions(role!.id, ids);
    },
    onSuccess: () => {
      toast.success(`${formatRoleLabel(role!.name)} saved`);
      onChanged();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save")
  });

  const needle = permSearch.trim().toLowerCase();
  const modules = useMemo(
    () =>
      matrix.permissionGroups
        .map((group) => ({
          module: group.module,
          total: group.permissions.length,
          on: group.permissions.filter((p) => draft.has(p.key)).length,
          rows: group.permissions.filter((p) => {
            if (grantedOnly && !draft.has(p.key)) return false;
            if (!needle) return true;
            return `${p.key} ${humanizePermissionKey(p.key)} ${p.description ?? ""}`.toLowerCase().includes(needle);
          })
        }))
        .filter((group) => group.rows.length > 0 || (!grantedOnly && !needle)),
    [matrix.permissionGroups, draft, grantedOnly, needle]
  );

  function toggle(key: string) {
    if (!canEdit) return;
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleOpen(module: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  const switchClass = (on: boolean) =>
    `relative h-[22px] w-[38px] shrink-0 rounded-full transition ${on ? "bg-blue-600" : "bg-slate-300"} ${canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`;

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-xl border border-slate-200 bg-white">
        <div className="p-3">
          <label className="relative block">
            <span className="sr-only">Search roles</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              placeholder="Search roles"
              className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm"
            />
          </label>
        </div>
        <div className="max-h-[70vh] overflow-y-auto pb-2">
          {groups.length === 0 ? <p className="px-4 py-3 text-sm text-slate-500">No roles match.</p> : null}
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</p>
              {group.roles.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  aria-current={item.id === selectedId}
                  className={`flex w-full items-center justify-between border-l-[3px] px-4 py-2 text-left text-sm ${
                    item.id === selectedId ? "border-blue-600 bg-blue-50 font-semibold text-slate-900" : "border-transparent text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{formatRoleLabel(item.name)}</span>
                  <span className="text-xs font-normal text-slate-500">{item.permissionCount}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <section className="rounded-xl border border-slate-200 bg-white">
        {role ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {formatRoleLabel(role.name)}
                  {role.tenantName ? <span className="ml-2 text-sm font-normal text-slate-500">{role.tenantName}</span> : null}
                </h3>
                <p className="text-sm text-slate-500">
                  {draft.size} of {matrix.permissions.length} permissions on
                  {!canEdit ? " · view only (SUPER_ADMIN can change roles)" : ""}
                </p>
              </div>
              {canEdit ? (
                <button type="button" onClick={() => setCreating(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  + New role
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
              <label className="relative min-w-[200px] flex-1">
                <span className="sr-only">Search permissions</span>
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Search permissions"
                  className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm"
                />
              </label>
              {[
                { label: "Granted only", value: true },
                { label: "All", value: false }
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setGrantedOnly(chip.value)}
                  aria-pressed={grantedOnly === chip.value}
                  className={`rounded-full border px-3 py-1 text-sm ${grantedOnly === chip.value ? "border-blue-300 bg-blue-100 text-blue-700" : "border-slate-300 text-slate-700"}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {modules.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">{grantedOnly ? "Nothing is switched on here. Choose All to see every permission." : "No permissions match."}</p>
            ) : (
              modules.map((group) => {
                const expanded = open.has(group.module) || Boolean(needle) || (grantedOnly && group.on > 0);
                return (
                  <div key={group.module} className="border-b border-slate-100 px-5 py-3 last:border-b-0">
                    <button type="button" onClick={() => toggleOpen(group.module)} className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900" aria-expanded={expanded}>
                      <span className="inline-flex items-center gap-1">
                        {expanded ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                        {formatPermissionModuleLabel(group.module)}
                      </span>
                      <span className="text-xs font-normal text-slate-500">{group.on} on · {group.total}</span>
                    </button>
                    {expanded
                      ? group.rows.map((permission) => {
                          const on = draft.has(permission.key);
                          return (
                            <div key={permission.key} className="flex items-center justify-between gap-3 py-2 pl-5">
                              <div className="min-w-0">
                                <p className="text-sm text-slate-900">{humanizePermissionKey(permission.key)}</p>
                                <p className="truncate text-[11px] text-slate-400">{permission.description ? `${permission.description} · ` : ""}{permission.key}</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={on}
                                aria-label={`${humanizePermissionKey(permission.key)} (${permission.key})`}
                                disabled={!canEdit}
                                onClick={() => toggle(permission.key)}
                                className={switchClass(on)}
                              >
                                <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[19px]" : "left-[3px]"}`} />
                              </button>
                            </div>
                          );
                        })
                      : null}
                  </div>
                );
              })
            )}

            {canEdit && changed > 0 ? (
              <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-b-xl border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
                <span className="text-sm text-amber-700">{changed} unsaved change{changed === 1 ? "" : "s"}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDraft(new Set(saved))} disabled={save.isPending} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
                    Discard
                  </button>
                  <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    {save.isPending ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-500">Pick a role on the left.</p>
        )}
      </section>

      {creating ? (
        <NewRoleDialog
          matrix={matrix}
          defaultCopyId={selectedId}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function NewRoleDialog({
  matrix,
  defaultCopyId,
  onClose,
  onCreated
}: {
  matrix: AdminRolesPermissionsMatrix;
  defaultCopyId: string | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [copyId, setCopyId] = useState<string>(defaultCopyId ?? "");
  const clean = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const source = matrix.roles.find((r) => r.id === copyId) ?? null;

  const create = useMutation({
    mutationFn: async () => {
      const keys = new Set(source?.permissionKeys ?? []);
      const permissionIds = matrix.permissions.filter((p) => keys.has(p.key)).map((p) => p.id);
      return createRole({ name: clean, tenantId: source?.tenantId ?? undefined, permissionIds });
    },
    onSuccess: (created) => {
      toast.success(`${formatRoleLabel(clean)} created`);
      onCreated(created.id);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create the role")
  });

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/50 p-4" data-sheet role="dialog" aria-modal="true" aria-label="New role">
      <form
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (clean) create.mutate();
        }}
      >
        <h3 className="text-lg font-semibold text-slate-900">New role</h3>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Role name *</span>
          <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3" placeholder="e.g. Store helper" />
          {clean ? <span className="mt-1 block text-xs text-slate-500">Saved as {clean}</span> : null}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Start from</span>
          <select value={copyId} onChange={(e) => setCopyId(e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3">
            <option value="">Nothing (switch permissions on afterwards)</option>
            {matrix.roles.map((r) => (
              <option key={r.id} value={r.id}>Copy of {formatRoleLabel(r.name)}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="submit" disabled={!clean || create.isPending} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {create.isPending ? "Creating…" : "Create role"}
          </button>
        </div>
      </form>
    </div>
  );
}
