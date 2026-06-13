"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { fetchAdminUserAccessList } from "@/lib/admin-users-api";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { UserAccessTable } from "./user-access-table";

export function AdminUsersPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);
  const isSuperAdmin = roleName === "SUPER_ADMIN";
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUserAccessList,
    enabled: isAdmin,
    refetchInterval: 60_000
  });

  const filteredRows = useMemo(() => {
    const rows = query.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return rows;
    }

    return rows.filter((row) =>
      [row.displayName, row.email, row.roleName, row.tenantName ?? "", row.tenantId ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [query.data, search]);

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageBreadcrumbs />
        <PermissionState
          title="Admin access required"
          description="Users & Access review is limited to ADMIN and SUPER_ADMIN roles. Backend authorization still controls the underlying user list API."
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
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Users & Access</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Review users, roles, tenant association, and access status. This view is read-only; user invitations and
            status changes remain in Settings until dedicated admin mutation flows ship.
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
            <span className="font-semibold text-slate-900">SUPER_ADMIN scope:</span> showing users across all tenants
            where the backend returns them. Tenant columns are visible for cross-tenant review.
          </p>
        ) : (
          <p>
            <span className="font-semibold text-slate-900">Tenant scope:</span> showing users associated with your
            active tenant only.
          </p>
        )}
      </div>

      <label className="block max-w-md space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search users</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, role, or tenant"
          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </label>

      {query.isLoading ? (
        <InlineLoadingState label="Loading users and access data…" />
      ) : query.isError ? (
        <ErrorState title="Could not load users" error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <UserAccessTable rows={filteredRows} showTenantColumns={isSuperAdmin} />
      )}
    </div>
  );
}
