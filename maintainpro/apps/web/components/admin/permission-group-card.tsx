"use client";

import {
  formatPermissionModuleLabel,
  formatRoleLabel,
  roleHasPermission,
  type AdminPermissionGroup,
  type AdminRoleReviewRow,
  type AdminRolesPermissionsMatrix
} from "@/lib/admin-roles";

type PermissionGroupCardProps = {
  group: AdminPermissionGroup;
  roles: AdminRoleReviewRow[];
  matrix: AdminRolesPermissionsMatrix;
  showTenantColumns: boolean;
};

export function PermissionGroupCard({ group, roles, matrix, showTenantColumns }: PermissionGroupCardProps) {
  return (
    <section
      aria-labelledby={`permission-group-${group.module}`}
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 id={`permission-group-${group.module}`} className="text-sm font-semibold text-slate-900">
          {formatPermissionModuleLabel(group.module)}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {group.permissions.length} permission{group.permissions.length === 1 ? "" : "s"} in this module
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm" aria-label={`${formatPermissionModuleLabel(group.module)} permission coverage`}>
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="min-w-[220px] px-4 py-3">
                Permission
              </th>
              {roles.map((role) => (
                <th key={role.id} scope="col" className="min-w-[120px] px-3 py-3 text-center">
                  <span className="block font-semibold text-slate-700">{formatRoleLabel(role.name)}</span>
                  {showTenantColumns && role.tenantName ? (
                    <span className="mt-1 block text-[10px] font-normal normal-case text-slate-500">{role.tenantName}</span>
                  ) : null}
                  <span className="mt-1 block text-[10px] font-normal normal-case text-slate-500">
                    {role.permissionCount} granted
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.permissions.map((permission) => (
              <tr key={permission.id} className="border-t border-slate-100">
                <th scope="row" className="px-4 py-3 align-top text-left font-normal">
                  <p className="font-mono text-xs text-slate-900">{permission.key}</p>
                  {permission.description ? (
                    <p className="mt-1 text-xs text-slate-500">{permission.description}</p>
                  ) : null}
                </th>
                {roles.map((role) => {
                  const granted = roleHasPermission(matrix, permission.key, role.id);

                  return (
                    <td key={role.id} className="px-3 py-3 text-center align-top">
                      <span
                        aria-label={`${formatRoleLabel(role.name)} ${granted ? "has" : "does not have"} ${permission.key}`}
                        className={`inline-flex min-h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold ${
                          granted
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-slate-50 text-slate-400"
                        }`}
                      >
                        {granted ? "Yes" : "—"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
