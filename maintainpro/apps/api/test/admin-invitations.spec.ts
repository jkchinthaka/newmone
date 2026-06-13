import {
  adminInvitationOverviewUsesSensitiveFields,
  adminInvitationsAllowMutations,
  filterAdminInvitationRows,
  formatAdminInvitationStatus,
  formatMembershipRoleLabel,
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
  it("does not expose mutation actions in invitation review config", () => {
    expect(adminInvitationsAllowMutations()).toBe(false);
    expect(adminInvitationOverviewUsesSensitiveFields()).toBe(false);
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
