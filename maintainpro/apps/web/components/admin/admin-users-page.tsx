"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { fetchAdminUserAccessList, updateAdminUserStatus, type AdminUserDetail } from "@/lib/admin-users-api";
import { fetchAdminRolesPermissionsMatrix } from "@/lib/admin-roles-api";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { getApiErrorMessage } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";
import type { AdminUserAccessRow } from "@/lib/admin-users";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { AdminUserFormDialog } from "./admin-user-form-dialog";
import { AdminUserPasswordDialog } from "./admin-user-password-dialog";
import { AdminUserPermissionsView } from "./admin-user-permissions-view";
import { UserAccessTable } from "./user-access-table";

export function AdminUsersPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);
  const isSuperAdmin = roleName === "SUPER_ADMIN";
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserDetail | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AdminUserAccessRow | null>(null);
  const [permissionsTarget, setPermissionsTarget] = useState<AdminUserAccessRow | null>(null);

  const query = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUserAccessList,
    enabled: isAdmin,
    refetchInterval: 60_000
  });

  const matrixQuery = useQuery({
    queryKey: ["admin", "roles-permissions"],
    queryFn: fetchAdminRolesPermissionsMatrix,
    enabled: isSuperAdmin
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateAdminUserStatus(userId, isActive),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<AdminUserAccessRow[]>(["admin", "users"], (current = []) =>
        current.map((row) => (row.id === updatedUser.id ? updatedUser : row))
      );
      toast.success(updatedUser.isActive ? "User reactivated" : "User deactivated");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not update user status."));
    }
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

  const handleStatusAction = async (row: AdminUserAccessRow) => {
    const nextActive = !row.isActive;
    const confirmed = await confirm(
      nextActive
        ? {
            title: "Reactivate user?",
            description:
              "This will allow the user to access MaintainPro again if their account and tenant are valid.",
            confirmLabel: "Reactivate user",
            cancelLabel: "Keep inactive",
            variant: "default"
          }
        : {
            title: "Deactivate user?",
            description: "This will prevent the user from accessing MaintainPro until they are reactivated.",
            confirmLabel: "Deactivate user",
            cancelLabel: "Keep active",
            variant: "destructive"
          }
    );

    if (!confirmed) {
      return;
    }

    statusMutation.mutate({ userId: row.id, isActive: nextActive });
  };

  const handleEdit = async (row: AdminUserAccessRow) => {
    try {
      const response = await apiClient.get<{ data: AdminUserDetail }>(`/admin/users/${row.id}`);
      setEditingUser(response.data.data);
      setFormOpen(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load user details."));
    }
  };

  const refreshUsers = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };

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
      {confirmDialog}

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
            {isSuperAdmin
              ? "Add, edit, and manage every user's role, tenant, department, status, and password."
              : "Review users, roles, tenant association, and access status. Deactivate or reactivate users with confirmation."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin ? (
            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setFormOpen(true);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              <Plus size={15} aria-hidden="true" /> Add User
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
            <span className="font-semibold text-slate-900">SUPER_ADMIN scope:</span> showing users across all tenants
            where the backend returns them. Every mutation here is independently re-verified against your current
            database role — a stale session cannot bypass this.
          </p>
        ) : (
          <p>
            <span className="font-semibold text-slate-900">Tenant scope:</span> showing and updating users associated
            with your active tenant only. Super admin accounts cannot be modified by tenant admins. Adding users,
            editing profiles, and resetting passwords are SUPER_ADMIN-only actions.
          </p>
        )}
      </div>

      <label className="block max-w-md space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search users</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, role, or tenant"
          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </label>

      {query.isLoading ? (
        <InlineLoadingState label="Loading users and access data…" />
      ) : query.isError ? (
        <ErrorState title="Could not load users" error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <UserAccessTable
          actionContext={{
            viewerUserId: user.id,
            viewerRoleName: roleName
          }}
          onStatusAction={handleStatusAction}
          onEdit={isSuperAdmin ? handleEdit : undefined}
          onSetPassword={isSuperAdmin ? (row) => setPasswordTarget(row) : undefined}
          onViewPermissions={isSuperAdmin ? (row) => setPermissionsTarget(row) : undefined}
          pendingUserId={statusMutation.isPending ? statusMutation.variables?.userId ?? null : null}
          rows={filteredRows}
          showTenantColumns={isSuperAdmin}
        />
      )}

      {isSuperAdmin ? (
        <>
          <AdminUserFormDialog
            open={formOpen}
            onClose={() => setFormOpen(false)}
            onSaved={refreshUsers}
            roles={matrixQuery.data?.roles ?? []}
            user={editingUser}
          />
          <AdminUserPasswordDialog
            open={Boolean(passwordTarget)}
            onClose={() => setPasswordTarget(null)}
            onSaved={refreshUsers}
            userId={passwordTarget?.id ?? null}
            userLabel={passwordTarget?.displayName || passwordTarget?.email || ""}
          />
          <AdminUserPermissionsView
            open={Boolean(permissionsTarget)}
            onClose={() => setPermissionsTarget(null)}
            userLabel={permissionsTarget?.displayName || permissionsTarget?.email || ""}
            roleName={permissionsTarget?.roleName ?? null}
            matrix={matrixQuery.data ?? null}
          />
        </>
      ) : null}
    </div>
  );
}
