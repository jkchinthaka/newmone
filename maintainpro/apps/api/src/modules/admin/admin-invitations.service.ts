import { BadRequestException, Injectable } from "@nestjs/common";
import { RoleName, TenantInvitationStatus } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { PrismaService } from "../../database/prisma.service";

export type AdminInvitationReviewRow = {
  id: string;
  tenantId: string;
  tenantName: string | null;
  email: string;
  inviteeDisplayName: string;
  membershipRole: string;
  status: TenantInvitationStatus;
  invitedByDisplayName: string;
  invitedByEmail: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

export const ADMIN_INVITATION_REVIEW_FIELDS = [
  "id",
  "tenantId",
  "tenantName",
  "email",
  "inviteeDisplayName",
  "membershipRole",
  "status",
  "invitedByDisplayName",
  "invitedByEmail",
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

@Injectable()
export class AdminInvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  private currentTenantScope(): { tenantId: string | null; isSuperAdmin: boolean } {
    const ctx = requestContext.get();
    const tenantId = ctx?.tenantId ?? null;
    const isSuperAdmin = ctx?.actorRole === RoleName.SUPER_ADMIN;
    return { tenantId, isSuperAdmin };
  }

  async findAllForAdminInvitationReview(): Promise<AdminInvitationReviewRow[]> {
    const { tenantId, isSuperAdmin } = this.currentTenantScope();

    if (!isSuperAdmin && !tenantId) {
      throw new BadRequestException("Tenant context is required");
    }

    const invitations = await this.prisma.tenantInvitation.findMany({
      where: !isSuperAdmin && tenantId ? { tenantId } : {},
      select: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        membershipRole: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true
          }
        },
        invitedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: isSuperAdmin ? 100 : 50
    });

    return invitations.map((invitation) => this.toAdminInvitationReviewRow(invitation, isSuperAdmin));
  }

  private toAdminInvitationReviewRow(
    invitation: {
      id: string;
      tenantId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      membershipRole: string;
      status: TenantInvitationStatus;
      expiresAt: Date;
      acceptedAt: Date | null;
      createdAt: Date;
      tenant: { id: string; name: string };
      invitedBy: { firstName: string; lastName: string; email: string };
    },
    isSuperAdmin: boolean
  ): AdminInvitationReviewRow {
    const inviteeDisplayName = `${invitation.firstName ?? ""} ${invitation.lastName ?? ""}`.trim();

    return {
      id: invitation.id,
      tenantId: invitation.tenantId,
      tenantName: isSuperAdmin ? invitation.tenant.name : invitation.tenant.name,
      email: invitation.email,
      inviteeDisplayName: inviteeDisplayName || invitation.email,
      membershipRole: invitation.membershipRole,
      status: invitation.status,
      invitedByDisplayName: `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`.trim(),
      invitedByEmail: invitation.invitedBy.email,
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.toISOString() : null
    };
  }
}
