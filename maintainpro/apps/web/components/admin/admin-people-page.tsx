"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { DepartmentSelect } from "@/components/departments/department-select";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  deactivatePerson,
  disablePersonLogin,
  fetchPeople,
  reactivatePerson,
  resetUserPassword,
  resendUserInvite,
  revokeUserInvite,
  sendUserInvite,
  type PersonRow
} from "@/lib/people-api";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

function inviteBadge(status?: string | null) {
  switch (status) {
    case "SENT":
      return "Sent";
    case "ACCEPTED":
      return "Accepted";
    case "EXPIRED":
      return "Expired";
    case "REVOKED":
      return "Revoked";
    default:
      return "Not Sent";
  }
}

export function AdminPeoplePage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [technicianOnly, setTechnicianOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "people", page, search, technicianOnly, statusFilter],
    queryFn: () =>
      fetchPeople({
        page,
        pageSize: 20,
        search: search.trim() || undefined,
        technicianOnly: technicianOnly ? "true" : undefined,
        status: statusFilter || undefined
      }),
    enabled: isAdmin
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "people"] });
  }, [queryClient]);

  const actionMutation = useMutation({
    mutationFn: async (action: { type: string; row: PersonRow }) => {
      const { type, row } = action;
      if (type === "deactivate") return deactivatePerson(row.id);
      if (type === "reactivate") return reactivatePerson(row.id);
      if (type === "disable-login") return disablePersonLogin(row.id);
      if (type === "send-invite" && row.linkedUserId) return sendUserInvite(row.linkedUserId);
      if (type === "resend-invite" && row.linkedUserId) return resendUserInvite(row.linkedUserId);
      if (type === "revoke-invite" && row.linkedUserId) {
        await revokeUserInvite(row.linkedUserId);
        return row;
      }
      if (type === "reset-password" && row.linkedUserId) return resetUserPassword(row.linkedUserId);
      throw new Error("Unsupported action");
    },
    onSuccess: (result, variables) => {
      invalidate();
      if (variables.type === "reset-password" && result && "temporaryPassword" in result && result.temporaryPassword) {
        setOneTimeSecret(result.temporaryPassword);
        toast.success("Temporary password generated — shown once below.");
      } else if (variables.type === "send-invite" || variables.type === "resend-invite") {
        const inviteResult = result as { inviteLink?: string; emailSent?: boolean };
        if (inviteResult.inviteLink) {
          setOneTimeSecret(inviteResult.inviteLink);
        }
        toast.success(inviteResult.emailSent ? "Invitation email sent" : "Copy invite link from the panel below.");
      } else {
        toast.success("Updated successfully");
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Action failed"))
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Array<{ id: string; name: string }> }>("/roles");
      return response.data.data ?? [];
    },
    enabled: isAdmin
  });

  const rows = query.data?.items ?? [];
  const meta = query.data?.meta;

  const emptyLabel = useMemo(() => {
    if (technicianOnly) return "No technicians found.";
    if (statusFilter === "inactive") return "No inactive people found.";
    return "No people found.";
  }, [technicianOnly, statusFilter]);

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageBreadcrumbs />
        <PermissionState title="Admin access required" description="People onboarding is limited to ADMIN roles." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      {confirmDialog}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">People</h2>
          <p className="mt-1 text-sm text-slate-500">
            Employee records, technician profiles, login access, and invitations in one onboarding flow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href={"/admin/people/new" as Route}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <UserPlus className="h-4 w-4" />
            Add Person
          </Link>
        </div>
      </header>

      {oneTimeSecret ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">One-time credential / invite link</p>
          <p className="mt-1 break-all font-mono text-xs">{oneTimeSecret}</p>
          <p className="mt-2 text-xs">This value cannot be retrieved again. Copy it now.</p>
          <button type="button" className="mt-2 text-xs underline" onClick={() => setOneTimeSecret(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, employee no, email…"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "" | "active" | "inactive");
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={technicianOnly}
              onChange={(e) => {
                setTechnicianOnly(e.target.checked);
                setPage(1);
              }}
            />
            Technicians only
          </label>
        </div>
      </section>

      {query.isLoading ? (
        <InlineLoadingState label="Loading people…" />
      ) : query.isError ? (
        <ErrorState title="Could not load people" description={getApiErrorMessage(query.error, "Could not load people")} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          {emptyLabel}
          <div className="mt-4">
            <Link href={"/admin/people/new" as Route} className="inline-flex items-center gap-2 text-slate-900 underline">
              <Plus className="h-4 w-4" />
              Add first person
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Employee No</th>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Login</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Invite</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{row.employeeNo ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.fullName}</td>
                  <td className="px-4 py-3">{row.designation}</td>
                  <td className="px-4 py-3">{row.department?.name ?? "—"}</td>
                  <td className="px-4 py-3">{row.branchName ?? "—"}</td>
                  <td className="px-4 py-3">{row.loginStatus}</td>
                  <td className="px-4 py-3">{row.role?.name ?? "—"}</td>
                  <td className="px-4 py-3">{row.canLogin ? inviteBadge(row.inviteStatus) : "—"}</td>
                  <td className="px-4 py-3">{row.active ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.active ? (
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-xs"
                          disabled={actionMutation.isPending}
                          onClick={async () => {
                            if (await confirm({ title: "Deactivate person?", description: "Login will be disabled.", confirmLabel: "Deactivate", variant: "destructive" })) {
                              actionMutation.mutate({ type: "deactivate", row });
                            }
                          }}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-xs"
                          disabled={actionMutation.isPending}
                          onClick={() => actionMutation.mutate({ type: "reactivate", row })}
                        >
                          Reactivate
                        </button>
                      )}
                      {row.linkedUserId ? (
                        <>
                          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => actionMutation.mutate({ type: "reset-password", row })}>
                            Reset Password
                          </button>
                          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => actionMutation.mutate({ type: "send-invite", row })}>
                            Send Invite
                          </button>
                          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => actionMutation.mutate({ type: "resend-invite", row })}>
                            Resend
                          </button>
                          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => actionMutation.mutate({ type: "revoke-invite", row })}>
                            Revoke
                          </button>
                          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => actionMutation.mutate({ type: "disable-login", row })}>
                            Disable Login
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta ? (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} total
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} className="rounded border px-3 py-1 disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button
              type="button"
              disabled={page >= (meta.totalPages || 1)}
              className="rounded border px-3 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {rolesQuery.data ? null : rolesQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
    </div>
  );
}
