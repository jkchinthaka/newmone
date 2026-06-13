"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { fetchAdminRolesPermissionsMatrix } from "@/lib/admin-roles-api";
import { filterRolesPermissionsMatrix, formatRoleLabel } from "@/lib/admin-roles";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { RolesPermissionsMatrix } from "./roles-permissions-matrix";

export function AdminRolesPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);
  const isSuperAdmin = roleName === "SUPER_ADMIN";
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["admin", "roles-permissions"],
    queryFn: fetchAdminRolesPermissionsMatrix,
    enabled: isAdmin,
    refetchInterval: 60_000
  });

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
            Review role and permission coverage before future invitation or assignment workflows. This view is read-only;
            role, permission, and user assignment mutations remain deferred.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} aria-hidden="true" /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {isSuperAdmin ? (
          <p>
            <span className="font-semibold text-slate-900">Cross-tenant scope:</span> permissions are global catalog
            entries; roles are tenant-scoped records shown with tenant labels. No user lists, tokens, or secrets are
            returned.
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

      {query.isLoading ? (
        <InlineLoadingState label="Loading roles and permissions matrix…" />
      ) : query.isError ? (
        <ErrorState title="Could not load roles matrix" error={query.error} onRetry={() => query.refetch()} />
      ) : filteredMatrix ? (
        <RolesPermissionsMatrix matrix={filteredMatrix} showTenantColumns={isSuperAdmin} />
      ) : null}
    </div>
  );
}
