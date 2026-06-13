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

export type AdminInvitationCreateResponse = {
  id: string;
  tenantId: string;
  tenantName: string;
  email: string;
  inviteeDisplayName: string;
  membershipRole: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  createdAt: string;
  expiresAt: string;
  invitationLink: string;
};

export const ADMIN_INVITATION_CREATABLE_MEMBERSHIP_ROLES = ["MEMBER", "ADMIN", "BILLING"] as const;

export type AdminInvitationCreatableMembershipRole = (typeof ADMIN_INVITATION_CREATABLE_MEMBERSHIP_ROLES)[number];

export const ADMIN_INVITATION_ACTIONS = {
  create: true,
  resend: false,
  revoke: false,
  delete: false,
  accept: false
} as const;

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

export function adminInvitationsAllowCreate(): boolean {
  return ADMIN_INVITATION_ACTIONS.create;
}

export function adminInvitationsAllowMutations(): boolean {
  return (
    ADMIN_INVITATION_ACTIONS.resend ||
    ADMIN_INVITATION_ACTIONS.revoke ||
    ADMIN_INVITATION_ACTIONS.delete ||
    ADMIN_INVITATION_ACTIONS.accept
  );
}

export function validateAdminInvitationCreateInput(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  membershipRole: AdminInvitationCreatableMembershipRole;
  tenantId?: string;
}): string | null {
  const email = input.email.trim();
  if (!email) {
    return "Work email is required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }

  if (!ADMIN_INVITATION_CREATABLE_MEMBERSHIP_ROLES.includes(input.membershipRole)) {
    return "Selected membership role is not allowed for invitations.";
  }

  if (input.tenantId !== undefined && input.tenantId.trim().length === 0) {
    return "Select a tenant before creating an invitation.";
  }

  return null;
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
