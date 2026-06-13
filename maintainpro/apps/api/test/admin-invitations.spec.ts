import {
  ADMIN_INVITATION_ACTIONS,
  adminInvitationOverviewUsesSensitiveFields,
  adminInvitationsAllowCreate,
  adminInvitationsAllowMutations,
  filterAdminInvitationRows,
  formatAdminInvitationStatus,
  formatMembershipRoleLabel,
  validateAdminInvitationCreateInput,
  type AdminInvitationReviewRow
} from "../../web/lib/admin-invitations";

const sampleRow: AdminInvitationReviewRow = {
  id: "invite-1",
  tenantId: "tenant-a",
  tenantName: "Tenant A",
  email: "invitee@example.com",
  inviteeDisplayName: "Invite User",
  membershipRole: "MEMBER",
  status: "PENDING",
  invitedByDisplayName: "Admin User",
  invitedByEmail: "admin@example.com",
  createdAt: "2026-06-01T00:00:00.000Z",
  expiresAt: "2026-07-01T00:00:00.000Z",
  acceptedAt: null
};

describe("admin invitations frontend helpers", () => {
  it("exposes create-only admin invitation actions without resend/revoke/delete", () => {
    expect(adminInvitationsAllowCreate()).toBe(true);
    expect(adminInvitationsAllowMutations()).toBe(false);
    expect(ADMIN_INVITATION_ACTIONS).toEqual({
      create: true,
      resend: false,
      revoke: false,
      delete: false,
      accept: false
    });
    expect(adminInvitationOverviewUsesSensitiveFields()).toBe(false);
  });

  it("validates admin invitation create input", () => {
    expect(
      validateAdminInvitationCreateInput({
        email: "invitee@example.com",
        membershipRole: "MEMBER"
      })
    ).toBeNull();
    expect(
      validateAdminInvitationCreateInput({
        email: "bad-email",
        membershipRole: "MEMBER"
      })
    ).toMatch(/valid email/i);
    expect(
      validateAdminInvitationCreateInput({
        email: "invitee@example.com",
        membershipRole: "OWNER" as never
      })
    ).toMatch(/not allowed/i);
  });

  it("formats invitation status and membership role labels", () => {
    expect(formatAdminInvitationStatus("PENDING")).toBe("Pending");
    expect(formatMembershipRoleLabel("TENANT_ADMIN")).toBe("TENANT ADMIN");
  });

  it("filters invitation rows by search and status client-side", () => {
    const acceptedRow: AdminInvitationReviewRow = { ...sampleRow, id: "invite-2", status: "ACCEPTED" };
    const filtered = filterAdminInvitationRows([sampleRow, acceptedRow], {
      search: "invitee@example.com",
      status: "PENDING"
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.status).toBe("PENDING");
  });
});
