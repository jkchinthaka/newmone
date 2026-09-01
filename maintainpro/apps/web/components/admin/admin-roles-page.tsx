"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { fetchAdminRolesPermissionsMatrix, syncPermissionCatalog } from "@/lib/admin-roles-api";
import { filterRolesPermissionsMatrix, formatRoleLabel, type AdminRoleReviewRow } from "@/lib/admin-roles";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { RolePermissionEditor } from "./role-permission-editor";
import { RolesPermissionsMatrix } from "./roles-permissions-matrix";

export function AdminRolesPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);
  const isSuperAdmin = roleName === "SUPER_ADMIN";
  const [search, setSearch] = useState("");
  const [editingRole, setEditingRole] = useState<AdminRoleReviewRow | null>(null);
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const query = useQuery({
    queryKey: ["admin", "roles-permissions"],
    queryFn: fetchAdminRolesPermissionsMatrix,
    enabled: isAdmin,
    refetchInterval: 60_000
  });

  const syncMutation = useMutation({
    mutationFn: syncPermissionCatalog,
    onSuccess: (result) => {
      toast.success(
        result.createdCount > 0
          ? `Permission catalog synced — ${result.createdCount} new permission(s) added.`
          : "Permission catalog already up to date — nothing to add."
      );
      void queryClient.invalidateQueries({ queryKey: ["admin", "roles-permissions"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Permission catalog sync failed");
    }
  });

  const handleSyncCatalog = async () => {
    const confirmed = await confirm({
      title: "Sync permission catalog?",
      description:
        "Adds any permission keys defined in the source code but missing from this database. Never removes or renames a permission, and never changes what any role is granted — you'll still need to explicitly grant new permissions to a role afterward.",
      confirmLabel: "Sync catalog",
      cancelLabel: "Cancel",
      variant: "default"
    });
    if (!confirmed) return;
    syncMutation.mutate();
  };

  const filteredMatrix = useMemo(
    () => (query.data ? filterRolesPermissionsMatrix(query.data, search) : null),
    [query.data, search]
  );

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageBreadcrumbs />
        <PermissionState
          title="Admin access required"
          description="Roles & Permissions review is limited to ADMIN and SUPER_ADMIN roles. Backend authorization still controls the underlying matrix API."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      {confirmDialog}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href={"/admin" as Route}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Admin Console
          </Link>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Roles & Permissions</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            {isSuperAdmin
              ? "Review permission coverage and edit any role's permissions directly. Changes take effect immediately for every user assigned that role."
              : "Review role and permission coverage. Editing role permissions is a SUPER_ADMIN-only action."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin ? (
            <button
              type="button"
              onClick={handleSyncCatalog}
              disabled={syncMutation.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Add any permission keys defined in source code but missing from this database"
            >
              <Database size={15} className={syncMutation.isPending ? "animate-pulse" : ""} aria-hidden="true" />
              {syncMutation.isPending ? "Syncing…" : "Sync Permission Catalog"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {isSuperAdmin ? (
          <p>
            <span className="font-semibold text-slate-900">Cross-tenant scope:</span> permissions are global catalog
            entries; roles are tenant-scoped records shown with tenant labels. Editing is independently re-verified
            against your current database role on every save.
          </p>
        ) : (
          <p>
            <span className="font-semibold text-slate-900">Tenant scope:</span> reviewing roles for your active tenant
            against the global permission catalog. Permissions are shared platform keys; role records are tenant-specific.
          </p>
        )}
      </div>

      {filteredMatrix ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roles in scope</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{filteredMatrix.roles.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Permissions shown</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{filteredMatrix.permissions.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Built-in roles</p>
            <p className="mt-1 text-sm text-slate-700">
              {filteredMatrix.roles
                .filter((role) => role.isBuiltIn)
                .map((role) => formatRoleLabel(role.name))
                .join(", ") || "None in current filter"}
            </p>
          </div>
        </div>
      ) : null}

      <label className="block max-w-md space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search roles or permissions</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search role, tenant, permission key, or module"
          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </label>

      {isSuperAdmin && filteredMatrix ? (
        <div className="flex flex-wrap gap-2">
          {filteredMatrix.roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setEditingRole(role)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Edit {formatRoleLabel(role.name)}
              {role.tenantName ? <span className="text-slate-400">({role.tenantName})</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {query.isLoading ? (
        <InlineLoadingState label="Loading roles and permissions matrix…" />
      ) : query.isError ? (
        <ErrorState title="Could not load roles matrix" error={query.error} onRetry={() => query.refetch()} />
      ) : filteredMatrix ? (
        <RolesPermissionsMatrix matrix={filteredMatrix} showTenantColumns={isSuperAdmin} />
      ) : null}

      {isSuperAdmin ? (
        <RolePermissionEditor
          open={Boolean(editingRole)}
          onClose={() => setEditingRole(null)}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["admin", "roles-permissions"] })}
          role={editingRole}
          matrix={query.data ?? null}
        />
      ) : null}
    </div>
  );
}
