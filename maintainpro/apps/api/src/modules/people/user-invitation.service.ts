import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserInviteStatus } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { EmailDispatchService } from "../notifications/email-dispatch.service";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class UserInvitationService {
  private readonly logger = new Logger(UserInvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailDispatch: EmailDispatchService
  ) {}

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  frontendBaseUrl(): string {
    return (
      this.configService.get<string>("APP_FRONTEND_URL") ??
      this.configService.get<string>("FRONTEND_URL") ??
      this.configService.get<string>("CORS_ORIGIN", "http://localhost:3001").split(",")[0].trim()
    ).replace(/\/$/, "");
  }

  buildInviteLink(token: string): string {
    return `${this.frontendBaseUrl()}/accept-invite?token=${encodeURIComponent(token)}`;
  }

  isEmailConfigured(): boolean {
    const summary = this.emailDispatch.describeProvider();
    return summary.configured;
  }

  async getActiveInvitation(userId: string) {
    return this.prisma.userInvitation.findFirst({
      where: {
        userId,
        status: { in: [UserInviteStatus.NOT_SENT, UserInviteStatus.SENT] }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async createOrRefreshInvitation(input: {
    tenantId: string | null;
    userId: string;
    invitedById: string;
    fullName: string;
    roleName: string;
    branchName?: string | null;
    departmentName?: string | null;
    sendEmail?: boolean;
  }): Promise<{ inviteLink: string; token: string; emailSent: boolean; status: UserInviteStatus }> {
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const now = new Date();

    await this.prisma.userInvitation.updateMany({
      where: {
        userId: input.userId,
        status: { in: [UserInviteStatus.NOT_SENT, UserInviteStatus.SENT] }
      },
      data: { status: UserInviteStatus.REVOKED, updatedAt: now }
    });

    const invitation = await this.prisma.userInvitation.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        tokenHash,
        expiresAt,
        invitedById: input.invitedById,
        status: UserInviteStatus.NOT_SENT,
        lastInvitationSentAt: null
      }
    });

    const inviteLink = this.buildInviteLink(token);
    let emailSent = false;
    let status: UserInviteStatus = UserInviteStatus.NOT_SENT;

    if (input.sendEmail !== false && this.isEmailConfigured()) {
      try {
        const body =
          `Hello ${input.fullName},\n\n` +
          `Your MaintainPro account has been created.\n\n` +
          `Role: ${input.roleName}\n` +
          `Branch: ${input.branchName ?? "—"}\n` +
          `Department: ${input.departmentName ?? "—"}\n\n` +
          `Click below to set your password:\n${inviteLink}\n\n` +
          `This link will expire in 24 hours.\n\n` +
          `If you did not expect this invitation, please contact IT.`;

        await this.emailDispatch.dispatch({
          userId: input.userId,
          title: "MaintainPro Account Invitation",
          message: body
        });

        emailSent = true;
        status = UserInviteStatus.SENT;
        await this.prisma.userInvitation.update({
          where: { id: invitation.id },
          data: { status: UserInviteStatus.SENT, lastInvitationSentAt: now }
        });
      } catch (error) {
        this.logger.warn(`Invite email failed for user ${input.userId}: ${(error as Error).message}`);
      }
    }

    return { inviteLink, token, emailSent, status };
  }

  async verifyToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true
          }
        }
      }
    });

    if (!invitation) {
      throw new BadRequestException("Invitation not found or invalid");
    }

    if (invitation.status === UserInviteStatus.REVOKED) {
      throw new BadRequestException("Invitation revoked");
    }

    if (invitation.status === UserInviteStatus.ACCEPTED || invitation.acceptedAt) {
      throw new BadRequestException("Invitation already accepted");
    }

    if (invitation.expiresAt <= new Date()) {
      if (invitation.status !== UserInviteStatus.EXPIRED) {
        await this.prisma.userInvitation.update({
          where: { id: invitation.id },
          data: { status: UserInviteStatus.EXPIRED }
        });
      }
      throw new BadRequestException("Invitation expired");
    }

    return invitation;
  }

  async acceptToken(rawToken: string, passwordHash: string) {
    const invitation = await this.verifyToken(rawToken);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: invitation.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          lastPasswordChangedAt: now,
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      }),
      this.prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { status: UserInviteStatus.ACCEPTED, acceptedAt: now }
      })
    ]);

    return invitation;
  }

  async revokeInvitation(userId: string) {
    const result = await this.prisma.userInvitation.updateMany({
      where: {
        userId,
        status: { in: [UserInviteStatus.NOT_SENT, UserInviteStatus.SENT] }
      },
      data: { status: UserInviteStatus.REVOKED }
    });

    if (result.count === 0) {
      throw new NotFoundException("No active invitation found");
    }

    return { revoked: result.count };
  }
}
