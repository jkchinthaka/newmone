"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { fetchAdminInvitationReviewList } from "@/lib/admin-invitations-api";
import { filterAdminInvitationRows } from "@/lib/admin-invitations";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { InvitationReviewTable } from "./invitation-review-table";

const STATUS_FILTERS = ["ALL", "PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] as const;

export function AdminInvitationsPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);
  const isSuperAdmin = roleName === "SUPER_ADMIN";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");

  const query = useQuery({
    queryKey: ["admin", "invitations"],
    queryFn: fetchAdminInvitationReviewList,
    enabled: isAdmin,
    refetchInterval: 60_000
  });

  const filteredRows = useMemo(
    () => filterAdminInvitationRows(query.data ?? [], { search, status: statusFilter }),
    [query.data, search, statusFilter]
  );

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageBreadcrumbs />
        <PermissionState
          title="Admin access required"
          description="Invitation review is limited to ADMIN and SUPER_ADMIN roles. Backend authorization still controls the underlying invitation list API."
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
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Invitations &amp; Onboarding</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Review tenant and user onboarding status from existing tenant invitation records. Invitation tokens,
            resend/revoke/accept flows, and email dispatch remain deferred from this read-only workspace.
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
            <span className="font-semibold text-slate-900">SUPER_ADMIN scope:</span> reviewing tenant invitations
            across the platform. Invitation tokens and provider secrets are never returned by this endpoint.
          </p>
        ) : (
          <p>
            <span className="font-semibold text-slate-900">Tenant scope:</span> reviewing invitations for your active
            tenant only. Cross-tenant invitation review requires SUPER_ADMIN access.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="block max-w-md flex-1 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search invitations</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search email, invitee, tenant, or inviter"
            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </label>
        <label className="block w-full max-w-xs space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as (typeof STATUS_FILTERS)[number])}
            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === "ALL" ? "All statuses" : status.charAt(0) + status.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>

      {query.isLoading ? (
        <InlineLoadingState label="Loading invitation records…" />
      ) : query.isError ? (
        <ErrorState title="Could not load invitations" error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <InvitationReviewTable rows={filteredRows} showTenantColumns={isSuperAdmin} />
      )}
    </div>
  );
}
