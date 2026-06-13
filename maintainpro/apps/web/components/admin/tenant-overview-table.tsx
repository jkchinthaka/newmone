"use client";

import { useMemo } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { formatAdminTenantStatus, type AdminTenantOverviewRow } from "@/lib/admin-tenants";
import { formatDate, formatDateTime } from "@/lib/localization";

type TenantOverviewTableProps = {
  rows: AdminTenantOverviewRow[];
  showTenantIdColumn: boolean;
};

export function TenantOverviewTable({ rows, showTenantIdColumn }: TenantOverviewTableProps) {
  const columns = useMemo(() => buildColumns(showTenantIdColumn), [showTenantIdColumn]);

  return (
    <DataTable
      ariaLabel="Tenant overview table"
      columns={columns}
      emptyDescription="No tenants were returned for your admin scope."
      emptyTitle="No tenants found"
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      minWidth="880px"
      rows={rows}
    />
  );
}

function buildColumns(showTenantIdColumn: boolean): DataTableColumn<AdminTenantOverviewRow>[] {
  const columns: DataTableColumn<AdminTenantOverviewRow>[] = [
    {
      id: "name",
      header: "Tenant",
      mobileLabel: "Tenant",
      cell: (row) => <span className="font-medium text-slate-900">{row.name}</span>
    },
    {
      id: "slug",
      header: "Slug",
      mobileLabel: "Slug",
      cell: (row) => <span className="font-mono text-xs text-slate-700">{row.slug}</span>
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
          {formatAdminTenantStatus(row.isActive)}
        </span>
      )
    },
    {
      id: "memberCount",
      header: "Members",
      mobileLabel: "Members",
      cell: (row) => row.memberCount.toLocaleString("en-LK")
    },
    {
      id: "createdAt",
      header: "Created",
      mobileLabel: "Created",
      hideOnMobile: true,
      cell: (row) => formatDate(row.createdAt)
    },
    {
      id: "updatedAt",
      header: "Updated",
      mobileLabel: "Updated",
      hideOnMobile: true,
      cell: (row) => formatDateTime(row.updatedAt, { fallback: "—" })
    }
  ];

  if (showTenantIdColumn) {
    columns.splice(1, 0, {
      id: "id",
      header: "Tenant ID",
      mobileLabel: "Tenant ID",
      hideOnMobile: true,
      cell: (row) => <span className="break-all font-mono text-xs text-slate-600">{row.id}</span>
    });
  }

  return columns;
}
