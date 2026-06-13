"use client";

import { PermissionGroupCard } from "./permission-group-card";
import type { AdminRolesPermissionsMatrix } from "@/lib/admin-roles";

type RolesPermissionsMatrixProps = {
  matrix: AdminRolesPermissionsMatrix;
  showTenantColumns: boolean;
};

export function RolesPermissionsMatrix({ matrix, showTenantColumns }: RolesPermissionsMatrixProps) {
  if (matrix.roles.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        No roles were returned for your admin scope.
      </p>
    );
  }

  if (matrix.permissionGroups.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        No permissions match your current search.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {matrix.permissionGroups.map((group) => (
        <PermissionGroupCard
          key={group.module}
          group={group}
          matrix={matrix}
          roles={matrix.roles}
          showTenantColumns={showTenantColumns}
        />
      ))}
    </div>
  );
}
