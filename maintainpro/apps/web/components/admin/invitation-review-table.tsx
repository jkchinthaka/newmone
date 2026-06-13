"use client";

import { useMemo } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  formatAdminInvitationStatus,
  formatMembershipRoleLabel,
  type AdminInvitationReviewRow
} from "@/lib/admin-invitations";
import { formatDate, formatDateTime } from "@/lib/localization";

type InvitationReviewTableProps = {
  rows: AdminInvitationReviewRow[];
  showTenantColumns: boolean;
};

export function InvitationReviewTable({ rows, showTenantColumns }: InvitationReviewTableProps) {
  const columns = useMemo(() => buildColumns(showTenantColumns), [showTenantColumns]);

  return (
    <DataTable
      ariaLabel="Invitation review table"
      columns={columns}
      emptyDescription="No invitations were returned for your admin scope."
      emptyTitle="No invitations found"
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.inviteeDisplayName || row.email}
      minWidth="1040px"
      rows={rows}
    />
  );
}

function buildColumns(showTenantColumns: boolean): DataTableColumn<AdminInvitationReviewRow>[] {
  const columns: DataTableColumn<AdminInvitationReviewRow>[] = [
    {
      id: "invitee",
      header: "Invitee",
      mobileLabel: "Invitee",
      cell: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.inviteeDisplayName}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      )
    },
    {
      id: "membershipRole",
      header: "Membership role",
      mobileLabel: "Role",
      cell: (row) => formatMembershipRoleLabel(row.membershipRole)
    },
    {
      id: "status",
      header: "Status",
      mobileLabel: "Status",
      cell: (row) => (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${invitationStatusClass(row.status)}`}
        >
          {formatAdminInvitationStatus(row.status)}
        </span>
      )
    },
    {
      id: "invitedBy",
      header: "Invited by",
      mobileLabel: "Invited by",
      hideOnMobile: true,
      cell: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.invitedByDisplayName}</p>
          <p className="text-xs text-slate-500">{row.invitedByEmail}</p>
        </div>
      )
    },
    {
      id: "createdAt",
      header: "Created",
      mobileLabel: "Created",
      hideOnMobile: true,
      cell: (row) => formatDate(row.createdAt)
    },
    {
      id: "expiresAt",
      header: "Expires",
      mobileLabel: "Expires",
      cell: (row) => formatDateTime(row.expiresAt, { fallback: "—" })
    },
    {
      id: "acceptedAt",
      header: "Accepted",
      mobileLabel: "Accepted",
      hideOnMobile: true,
      cell: (row) => formatDateTime(row.acceptedAt, { fallback: "—" })
    }
  ];

  if (showTenantColumns) {
    columns.splice(1, 0, {
      id: "tenantName",
      header: "Tenant",
      mobileLabel: "Tenant",
      cell: (row) => row.tenantName ?? row.tenantId
    });
  }

  return columns;
}

function invitationStatusClass(status: AdminInvitationReviewRow["status"]): string {
  switch (status) {
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "ACCEPTED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "EXPIRED":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "REVOKED":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}
