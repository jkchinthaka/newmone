"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { createAdminInvitation, fetchAdminInvitationReviewList } from "@/lib/admin-invitations-api";
import { fetchAdminTenantOverviewList } from "@/lib/admin-tenants-api";
import {
  adminInvitationsAllowCreate,
  filterAdminInvitationRows,
  type AdminInvitationCreateResponse
} from "@/lib/admin-invitations";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/localization";
import { getActiveTenantId } from "@/lib/tenant-context";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { AdminInvitationCreateDialog } from "./admin-invitation-create-dialog";
import { InvitationReviewTable } from "./invitation-review-table";

const STATUS_FILTERS = ["ALL", "PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] as const;

export function AdminInvitationsPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);
  const isSuperAdmin = roleName === "SUPER_ADMIN";
  const canCreate = isAdmin && adminInvitationsAllowCreate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<AdminInvitationCreateResponse | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin", "invitations"],
    queryFn: fetchAdminInvitationReviewList,
    enabled: isAdmin,
    refetchInterval: 60_000
  });

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: fetchAdminTenantOverviewList,
    enabled: isAdmin
  });

  const activeTenantId = getActiveTenantId();
  const scopedTenant = !isSuperAdmin ? tenantsQuery.data?.[0] ?? null : null;
  const adminTenantName = scopedTenant?.name ?? null;
  const adminTenantId = scopedTenant?.id ?? activeTenantId;

  const createMutation = useMutation({
    mutationFn: createAdminInvitation,
    onSuccess: async (invitation) => {
      setCreateOpen(false);
      setCreatedInvitation(invitation);
      await queryClient.invalidateQueries({ queryKey: ["admin", "invitations"] });
      toast.success("Invitation created");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not create invitation."));
    }
  });

  const filteredRows = useMemo(
    () => filterAdminInvitationRows(query.data ?? [], { search, status: statusFilter }),
    [query.data, search, statusFilter]
  );

  const tenantOptions = useMemo(
    () => (tenantsQuery.data ?? []).map((tenant) => ({ id: tenant.id, name: tenant.name })),
    [tenantsQuery.data]
  );

  async function handleCopyInvitationLink() {
    if (!createdInvitation?.invitationLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdInvitation.invitationLink);
      toast.success("Invitation link copied");
    } catch {
      toast.error("Could not copy invitation link.");
    }
  }

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
            Review tenant onboarding records and create controlled invitations from the admin workspace. Resend,
            revoke, accept, and email dispatch remain deferred.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <Plus size={15} aria-hidden="true" /> Create invitation
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

      {createdInvitation ? (
        <section
          aria-labelledby="invitation-link-panel-title"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-amber-950" id="invitation-link-panel-title">
                One-time invitation link
              </h3>
              <p className="mt-1 text-amber-900/90">
                This link gives onboarding access. Share only with the intended recipient. It is not stored in the
                invitation table and will disappear when you dismiss this panel.
              </p>
              <p className="mt-2 text-xs text-amber-900/80">
                Created for {createdInvitation.inviteeDisplayName} ({createdInvitation.email}) · expires{" "}
                {formatDateTime(createdInvitation.expiresAt)}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss invitation link panel"
              onClick={() => setCreatedInvitation(null)}
              className="rounded-md p-1 text-amber-900 transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              readOnly
              value={createdInvitation.invitationLink}
              aria-label="Invitation onboarding link"
              className="block w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800"
            />
            <button
              type="button"
              onClick={handleCopyInvitationLink}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
            >
              <Copy size={15} aria-hidden="true" /> Copy link
            </button>
          </div>
        </section>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {isSuperAdmin ? (
          <p>
            <span className="font-semibold text-slate-900">SUPER_ADMIN scope:</span> reviewing and creating tenant
            invitations across the platform. Raw tokens are never returned; only one-time links appear after creation.
          </p>
        ) : (
          <p>
            <span className="font-semibold text-slate-900">Tenant scope:</span> reviewing and creating invitations for
            your active tenant only. Cross-tenant invitation management requires SUPER_ADMIN access.
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

      <AdminInvitationCreateDialog
        open={createOpen}
        isSubmitting={createMutation.isPending}
        isSuperAdmin={isSuperAdmin}
        tenantOptions={tenantOptions}
        defaultTenantId={activeTenantId}
        fixedTenantName={adminTenantName}
        onCancel={() => {
          if (!createMutation.isPending) {
            setCreateOpen(false);
          }
        }}
        onSubmit={(payload) => {
          createMutation.mutate({
            ...payload,
            tenantId: isSuperAdmin ? payload.tenantId : adminTenantId ?? undefined
          });
        }}
      />
    </div>
  );
}
