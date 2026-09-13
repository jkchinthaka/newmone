"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { useFocusTrap } from "@/lib/use-focus-trap";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { updateRolePermissions } from "@/lib/admin-roles-api";
import {
  formatPermissionModuleLabel,
  formatRoleLabel,
  type AdminRoleReviewRow,
  type AdminRolesPermissionsMatrix
} from "@/lib/admin-roles";

export interface RolePermissionEditorProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  role: AdminRoleReviewRow | null;
  matrix: AdminRolesPermissionsMatrix | null;
}

/**
 * Editable permission matrix for a single role — checkboxes grouped by
 * module, select-all/clear per module, search, changed count, reset unsaved,
 * and a confirmed Save. SUPER_ADMIN only (enforced server-side).
 */
export function RolePermissionEditor({ open, onClose, onSaved, role, matrix }: RolePermissionEditorProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { confirm: confirmDiscard, dialog: discardDialog } = useConfirmDialog();

  const initialKeys = useMemo(() => new Set(role?.permissionKeys ?? []), [role]);

  const changedCount = Array.from(new Set([...initialKeys, ...selected])).filter(
    (key) => initialKeys.has(key) !== selected.has(key)
  ).length;

  /**
   * Every way to leave this dialog (backdrop click, X, Cancel, Escape) must go
   * through here. Unsaved checkbox changes must never be discarded silently —
   * that produced a real production incident: an admin toggled TECHNICIAN's
   * fg.* checkboxes, closed the dialog believing it saved, and no request (and
   * therefore no audit entry) was ever sent.
   */
  async function requestClose() {
    if (submitting) return;
    if (changedCount > 0) {
      const discard = await confirmDiscard({
        title: "Discard unsaved changes?",
        description: `${changedCount} permission change${changedCount === 1 ? "" : "s"} to ${formatRoleLabel(role?.name ?? "")} ${changedCount === 1 ? "has" : "have"} not been saved. Closing now will discard ${changedCount === 1 ? "it" : "them"}.`,
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        variant: "destructive"
      });
      if (!discard) return;
    }
    onClose();
  }

  useFocusTrap(open, panelRef, { onEscape: submitting ? undefined : requestClose });

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialKeys));
      setSearch("");
      setConfirmOpen(false);
    }
  }, [open, initialKeys]);

  if (!open || !role || !matrix) {
    return null;
  }

  const needle = search.trim().toLowerCase();
  const groups = matrix.permissionGroups
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter(
        (p) => !needle || p.key.toLowerCase().includes(needle) || (p.description ?? "").toLowerCase().includes(needle)
      )
    }))
    .filter((group) => group.permissions.length > 0);

  function togglePermission(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleModule(moduleKeys: string[], selectAll: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const key of moduleKeys) {
        if (selectAll) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function resetUnsaved() {
    setSelected(new Set(initialKeys));
  }

  async function handleSave() {
    if (!role) return;
    setSubmitting(true);
    try {
      const permissionIds = matrix!.permissions.filter((p) => selected.has(p.key)).map((p) => p.id);
      await updateRolePermissions(role.id, permissionIds);
      toast.success(`${formatRoleLabel(role.name)} permissions updated (${permissionIds.length} granted)`);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save permissions");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
      <button type="button" aria-label="Close dialog backdrop" className="absolute inset-0" onClick={submitting ? undefined : requestClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Roles &amp; Permissions</p>
            <h2 id={titleId} className="mt-0.5 text-lg font-semibold text-slate-900">
              {formatRoleLabel(role.name)}
              {role.tenantName ? <span className="ml-2 text-sm font-normal text-slate-500">{role.tenantName}</span> : null}
            </h2>
          </div>
          <button type="button" onClick={submitting ? undefined : requestClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permission key or description…"
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
          />
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className={`rounded-full px-2.5 py-1 font-semibold ${changedCount > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
              {changedCount} unsaved change{changedCount === 1 ? "" : "s"}
            </span>
            <button type="button" onClick={resetUnsaved} disabled={changedCount === 0} className="font-semibold text-slate-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40">
              Reset
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="max-h-full overflow-x-auto">
            <div className="space-y-4">
              {groups.map((group) => {
                const moduleKeys = group.permissions.map((p) => p.key);
                const allSelected = moduleKeys.every((k) => selected.has(k));
                return (
                  <section key={group.module} className="rounded-xl border border-slate-200">
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                      <h3 className="text-sm font-semibold text-slate-900">{formatPermissionModuleLabel(group.module)}</h3>
                      <div className="flex gap-2 text-xs font-semibold">
                        <button type="button" onClick={() => toggleModule(moduleKeys, true)} className="text-brand-700 hover:underline" disabled={allSelected}>
                          Select all
                        </button>
                        <span className="text-slate-300">|</span>
                        <button type="button" onClick={() => toggleModule(moduleKeys, false)} className="text-slate-600 hover:underline">
                          Clear
                        </button>
                      </div>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {group.permissions.map((permission) => (
                        <li key={permission.id} className="flex items-start gap-3 px-4 py-2.5">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0"
                            checked={selected.has(permission.key)}
                            onChange={() => togglePermission(permission.key)}
                            id={`perm-${permission.id}`}
                          />
                          <label htmlFor={`perm-${permission.id}`} className="min-w-0 flex-1 cursor-pointer">
                            <p className="font-mono text-xs text-slate-900">{permission.key}</p>
                            {permission.description ? <p className="text-xs text-slate-500">{permission.description}</p> : null}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              {groups.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No permissions match your search.</p> : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={requestClose} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={submitting || changedCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Changes
          </button>
        </div>

        {confirmOpen ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <h3 className="text-base font-semibold text-slate-900">Save permission changes?</h3>
              <p className="mt-2 text-sm text-slate-600">
                {formatRoleLabel(role.name)} will have {changedCount} permission{changedCount === 1 ? "" : "s"} changed. This takes
                effect immediately for every user assigned this role.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  Confirm &amp; Save
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {discardDialog}
    </div>
  );
}
