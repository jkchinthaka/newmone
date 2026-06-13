"use client";

import { useMemo } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  canShowAdminUserStatusAction,
  formatAdminUserStatus,
  getAdminUserStatusActionLabel,
  type AdminUserAccessRow,
  type AdminUserStatusActionContext
} from "@/lib/admin-users";
import { formatDate, formatDateTime } from "@/lib/localization";

type UserAccessTableProps = {
  rows: AdminUserAccessRow[];
  showTenantColumns: boolean;
  actionContext: AdminUserStatusActionContext;
  pendingUserId?: string | null;
  onStatusAction?: (row: AdminUserAccessRow) => void;
};

export function UserAccessTable({
  rows,
  showTenantColumns,
  actionContext,
  pendingUserId = null,
  onStatusAction
}: UserAccessTableProps) {
  const columns = useMemo(() => buildColumns(showTenantColumns), [showTenantColumns]);
  const showActions = Boolean(onStatusAction);

  return (
    <DataTable
      actionsHeader="Actions"
      ariaLabel="Users and access review table"
      columns={columns}
      emptyDescription="No users were returned for your admin scope."
      emptyTitle="No users found"
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.displayName || row.email}
      minWidth="960px"
      renderActions={
        showActions
          ? (row) => {
              if (!canShowAdminUserStatusAction(row, actionContext)) {
                return null;
              }

              const isPending = pendingUserId === row.id;
              const label = getAdminUserStatusActionLabel(row.isActive);

              return (
                <button
                  type="button"
                  aria-label={`${label} ${row.displayName || row.email}`}
                  disabled={isPending}
                  onClick={() => onStatusAction?.(row)}
                  className={`inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ${
                    row.isActive
                      ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  {isPending ? "Saving…" : label}
                </button>
              );
            }
          : undefined
      }
      rows={rows}
    />
  );
}

function buildColumns(showTenantColumns: boolean): DataTableColumn<AdminUserAccessRow>[] {
  const columns: DataTableColumn<AdminUserAccessRow>[] = [
    {
      id: "displayName",
      header: "Name",
      mobileLabel: "Name",
      cell: (row) => <span className="font-medium text-slate-900">{row.displayName || "—"}</span>
    },
    {
      id: "email",
      header: "Email",
      mobileLabel: "Email",
      cell: (row) => row.email
    },
    {
      id: "roleName",
      header: "Role",
      mobileLabel: "Role",
      cell: (row) => row.roleName.replace(/_/g, " ")
    },
    {
      id: "isActive",
      header: "Status",
      mobileLabel: "Status",
      cell: (row) => (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            row.isActive
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {formatAdminUserStatus(row.isActive)}
        </span>
      )
    },
    {
      id: "lastLogin",
      header: "Last login",
      mobileLabel: "Last login",
      hideOnMobile: true,
      cell: (row) => formatDateTime(row.lastLogin, { fallback: "Never" })
    },
    {
      id: "createdAt",
      header: "Created",
      mobileLabel: "Created",
      hideOnMobile: true,
      cell: (row) => formatDate(row.createdAt)
    }
  ];

  if (showTenantColumns) {
    columns.splice(3, 0, {
      id: "tenantName",
      header: "Tenant",
      mobileLabel: "Tenant",
      cell: (row) => row.tenantName ?? row.tenantId ?? "—"
    });
  }

  return columns;
}
