"use client";

import { useId, useRef } from "react";
import { X } from "lucide-react";

import { useFocusTrap } from "@/lib/use-focus-trap";
import { formatPermissionModuleLabel, formatRoleLabel, type AdminRolesPermissionsMatrix } from "@/lib/admin-roles";

export interface AdminUserPermissionsViewProps {
  open: boolean;
  onClose: () => void;
  userLabel: string;
  roleName: string | null;
  matrix: AdminRolesPermissionsMatrix | null;
}

/** Read-only "effective permissions" view: the user's role plus every catalog permission, granted or not. */
export function AdminUserPermissionsView({ open, onClose, userLabel, roleName, matrix }: AdminUserPermissionsViewProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, panelRef, { onEscape: onClose });

  if (!open) {
    return null;
  }

  const role = matrix?.roles.find((r) => r.name === roleName) ?? null;
  const grantedKeys = new Set(role?.permissionKeys ?? []);

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
      <button type="button" aria-label="Close dialog backdrop" className="absolute inset-0" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Effective Permissions</p>
            <h2 id={titleId} className="mt-0.5 text-lg font-semibold text-slate-900">
              {userLabel}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Role: <span className="font-semibold text-slate-700">{roleName ? formatRoleLabel(roleName) : "—"}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!matrix || !role ? (
            <p className="py-8 text-center text-sm text-slate-400">Permission data is unavailable for this role.</p>
          ) : (
            <div className="space-y-4">
              {matrix.permissionGroups.map((group) => (
                <section key={group.module} className="rounded-xl border border-slate-200">
                  <div className="rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-2">
                    <h3 className="text-sm font-semibold text-slate-900">{formatPermissionModuleLabel(group.module)}</h3>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {group.permissions.map((permission) => {
                      const granted = grantedKeys.has(permission.key);
                      return (
                        <li key={permission.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                          <span className="font-mono text-xs text-slate-700">{permission.key}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              granted ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {granted ? "Granted" : "Not granted"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
