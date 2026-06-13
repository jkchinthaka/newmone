"use client";

import { useMemo } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  formatAdminUserStatus,
  type AdminUserAccessRow
} from "@/lib/admin-users";
import { formatDate, formatDateTime } from "@/lib/localization";

type UserAccessTableProps = {
  rows: AdminUserAccessRow[];
  showTenantColumns: boolean;
};

export function UserAccessTable({ rows, showTenantColumns }: UserAccessTableProps) {
  const columns = useMemo(() => buildColumns(showTenantColumns), [showTenantColumns]);

  return (
    <DataTable
      ariaLabel="Users and access review table"
      columns={columns}
      emptyDescription="No users were returned for your admin scope."
      emptyTitle="No users found"
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.displayName || row.email}
      minWidth="960px"
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
