"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { fetchAdminTenantOverviewList } from "@/lib/admin-tenants-api";
import { formatAdminTenantStatus } from "@/lib/admin-tenants";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { formatDate, formatDateTime } from "@/lib/localization";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { TenantOverviewTable } from "./tenant-overview-table";

export function AdminTenantsPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);
  const isSuperAdmin = roleName === "SUPER_ADMIN";
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: fetchAdminTenantOverviewList,
    enabled: isAdmin,
    refetchInterval: 60_000
  });

  const filteredRows = useMemo(() => {
    const rows = query.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return rows;
    }

    return rows.filter((row) => tenantMatchesSearch(row, needle));
  }, [query.data, search]);

  const scopedTenant = !isSuperAdmin ? query.data?.[0] ?? null : null;
  const ownTenant =
    scopedTenant && tenantMatchesSearch(scopedTenant, search.trim().toLowerCase()) ? scopedTenant : null;

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageBreadcrumbs />
        <PermissionState
          title="Admin access required"
          description="Tenant review is limited to ADMIN and SUPER_ADMIN roles. Backend authorization still controls the underlying tenant list API."
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
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Tenants</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Review tenant context and tenant readiness in a read-only workspace. Tenant create, edit, delete,
            invitation, switching, and billing controls remain deferred.
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
            <span className="font-semibold text-slate-900">SUPER_ADMIN scope:</span> reviewing tenants across the
            platform. No secrets, connection strings, or billing credentials are returned by this endpoint.
          </p>
        ) : (
          <p>
            <span className="font-semibold text-slate-900">Tenant scope:</span> showing your active tenant context only.
            Cross-tenant administration requires SUPER_ADMIN access.
          </p>
        )}
      </div>

      {!isSuperAdmin && ownTenant ? (
        <section
          aria-labelledby="own-tenant-profile-heading"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h3 id="own-tenant-profile-heading" className="text-sm font-semibold text-slate-900">
            Active tenant profile
          </h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</dt>
              <dd className="mt-1 font-medium text-slate-900">{ownTenant.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</dt>
              <dd className="mt-1 font-mono text-sm text-slate-800">{ownTenant.slug}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</dt>
              <dd className="mt-1 font-medium text-slate-900">{formatAdminTenantStatus(ownTenant.isActive)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Members</dt>
              <dd className="mt-1 font-medium text-slate-900">{ownTenant.memberCount.toLocaleString("en-LK")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</dt>
              <dd className="mt-1 font-medium text-slate-900">{formatDate(ownTenant.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {formatDateTime(ownTenant.updatedAt, { fallback: "—" })}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <label className="block max-w-md space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search tenants</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, slug, or tenant ID"
          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </label>

      {query.isLoading ? (
        <InlineLoadingState label="Loading tenant overview…" />
      ) : query.isError ? (
        <ErrorState title="Could not load tenants" error={query.error} onRetry={() => query.refetch()} />
      ) : isSuperAdmin ? (
        <TenantOverviewTable rows={filteredRows} showTenantIdColumn />
      ) : ownTenant ? null : (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          {scopedTenant ? "No tenant details match your search." : "No tenant context is available for your session."}
        </p>
      )}
    </div>
  );
}

function tenantMatchesSearch(row: { name: string; slug: string; id: string; isActive: boolean }, needle: string): boolean {
  if (!needle) {
    return true;
  }

  return [row.name, row.slug, row.id, row.isActive ? "active" : "inactive"]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}
