export type AdminInvitationReviewRow = {
  id: string;
  tenantId: string;
  tenantName: string | null;
  email: string;
  inviteeDisplayName: string;
  membershipRole: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  invitedByDisplayName: string;
  invitedByEmail: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

export const ADMIN_INVITATION_TABLE_FIELDS = [
  "email",
  "inviteeDisplayName",
  "tenantName",
  "membershipRole",
  "status",
  "invitedByDisplayName",
  "createdAt",
  "expiresAt",
  "acceptedAt"
] as const;

export const ADMIN_INVITATION_SENSITIVE_FIELDS = [
  "token",
  "invitationToken",
  "tokenHash",
  "invitationLink",
  "passwordHash",
  "password",
  "refreshToken",
  "resetToken",
  "sessionToken",
  "smtpPassword",
  "smtpUser",
  "secret",
  "apiKey",
  "invitedById"
] as const;

export function adminInvitationsAllowMutations(): boolean {
  return false;
}

export function adminInvitationOverviewUsesSensitiveFields(): boolean {
  return ADMIN_INVITATION_TABLE_FIELDS.some((field) =>
    (ADMIN_INVITATION_SENSITIVE_FIELDS as readonly string[]).includes(field)
  );
}

export function formatAdminInvitationStatus(status: AdminInvitationReviewRow["status"]): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "ACCEPTED":
      return "Accepted";
    case "EXPIRED":
      return "Expired";
    case "REVOKED":
      return "Revoked";
    default:
      return status;
  }
}

export function formatMembershipRoleLabel(role: string): string {
  return role.replace(/_/g, " ");
}

export function filterAdminInvitationRows(
  rows: AdminInvitationReviewRow[],
  options: { search?: string; status?: string }
): AdminInvitationReviewRow[] {
  const needle = options.search?.trim().toLowerCase() ?? "";
  const status = options.status?.trim().toUpperCase() ?? "";

  return rows.filter((row) => {
    const matchesStatus = !status || status === "ALL" || row.status === status;
    if (!matchesStatus) {
      return false;
    }

    if (!needle) {
      return true;
    }

    return [
      row.email,
      row.inviteeDisplayName,
      row.tenantName ?? "",
      row.tenantId,
      row.membershipRole,
      row.status,
      row.invitedByDisplayName,
      row.invitedByEmail
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}
