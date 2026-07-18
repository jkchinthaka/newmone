import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuditAction, RoleName, TenantInvitationStatus, TenantMembershipRole, UserInviteStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { requestContext } from "../../common/context/request-context";
import { getAccessJwtSecret, getRefreshJwtSecret } from "../../config/jwt-secrets";
import { EmailDispatchService } from "../notifications/email-dispatch.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import type { AuthTokens, JwtPayload } from "./auth.types";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(EmailDispatchService) private readonly emailDispatchService: EmailDispatchService
  ) {}

  private toPublicUser<T extends { passwordHash: string }>(user: T): Omit<T, "passwordHash"> {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  private permissionKeysFromRole(
    role: { permissions?: Array<{ key: string }> } | null | undefined
  ): string[] {
    if (!role || !Array.isArray(role.permissions)) {
      return [];
    }

    return role.permissions
      .map((permission) => permission.key)
      .filter((key) => typeof key === "string" && key.trim().length > 0);
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private decodeTokenExpiry(refreshToken: string): Date {
    const decoded = this.jwtService.decode(refreshToken) as { exp?: number } | null;
    if (!decoded?.exp) {
      throw new UnauthorizedException("Refresh token expiry metadata is invalid");
    }
    return new Date(decoded.exp * 1000);
  }

  private getSessionMeta(): { deviceInfo?: string; ipAddress?: string; userAgent?: string } {
    const ctx = requestContext.get();
    return {
      deviceInfo: ctx?.userAgent ?? undefined,
      ipAddress: ctx?.ipAddress ?? undefined,
      userAgent: ctx?.userAgent ?? undefined
    };
  }

  private async persistRefreshToken(refreshToken: string, payload: JwtPayload): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = this.decodeTokenExpiry(refreshToken);
    const sessionMeta = this.getSessionMeta();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: payload.sub,
        tenantId: payload.tenantId ?? null,
        expiresAt,
        deviceInfo: sessionMeta.deviceInfo,
        ipAddress: sessionMeta.ipAddress,
        userAgent: sessionMeta.userAgent
      }
    });
  }

  private async generateTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: getAccessJwtSecret(this.configService),
      expiresIn: this.configService.get<string>("JWT_ACCESS_EXPIRES", "15m")
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: getRefreshJwtSecret(this.configService),
      expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRES", "7d")
    });

    await this.persistRefreshToken(refreshToken, payload);

    return { accessToken, refreshToken };
  }

  private roleNameForMembership(membershipRole: TenantMembershipRole): RoleName {
    switch (membershipRole) {
      case TenantMembershipRole.OWNER:
      case TenantMembershipRole.ADMIN:
        return RoleName.ADMIN;
      case TenantMembershipRole.BILLING:
        return RoleName.MANAGER;
      case TenantMembershipRole.MEMBER:
      default:
        return RoleName.TECHNICIAN;
    }
  }

  private isPublicRegistrationEnabled(): boolean {
    const allowPublic = this.configService.get<boolean>("ALLOW_PUBLIC_REGISTRATION", false);
    if (!allowPublic) {
      return false;
    }

    const nodeEnv = this.configService.get<string>("NODE_ENV", "development");
    if (nodeEnv !== "production") {
      return true;
    }

    return this.configService.get<boolean>("ALLOW_PUBLIC_REGISTRATION_IN_PRODUCTION", false);
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existing) {
      throw new BadRequestException("Email already in use");
    }

    let invitation: Awaited<ReturnType<typeof this.prisma.tenantInvitation.findUnique>> = null;

    if (dto.invitationToken) {
      invitation = await this.prisma.tenantInvitation.findUnique({
        where: { token: dto.invitationToken }
      });

      const isUsable =
        invitation &&
        invitation.status === TenantInvitationStatus.PENDING &&
        invitation.expiresAt.getTime() > Date.now() &&
        invitation.email.toLowerCase() === dto.email.trim().toLowerCase();

      if (!isUsable) {
        throw new BadRequestException("Invitation is invalid, expired, or does not match this email");
      }
    } else if (!this.isPublicRegistrationEnabled()) {
      throw new ForbiddenException("Registration is by invitation only. Please contact your administrator.");
    }

    const roleName = invitation ? this.roleNameForMembership(invitation.membershipRole) : RoleName.TECHNICIAN;
    const role = await this.prisma.role.findFirst({ where: { name: roleName } });

    if (!role) {
      throw new NotFoundException("Default role not found. Run seed first.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: role.id,
        tenantId: invitation ? invitation.tenantId : undefined
      },
      include: {
        role: {
          include: {
            permissions: {
              select: {
                key: true
              }
            }
          }
        }
      }
    });

    if (invitation) {
      await this.prisma.tenantMembership.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          membershipRole: invitation.membershipRole
        }
      });

      await this.prisma.tenantInvitation.update({
        where: { id: invitation.id },
        data: { status: TenantInvitationStatus.ACCEPTED, acceptedAt: new Date() }
      });
    }

    const ctx = requestContext.get();

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId ?? null,
        actorId: user.id,
        module: "auth",
        entity: "USER",
        entityId: user.id,
        action: AuditAction.CREATE,
        reason: invitation ? "Registration via tenant invitation" : "Public self-registration",
        ipAddress: ctx?.ipAddress ?? undefined,
        userAgent: ctx?.userAgent ?? undefined,
        requestPath: ctx?.requestPath ?? undefined,
        afterData: { email: user.email, role: user.role.name, tenantId: user.tenantId ?? null }
      }
    });

    const permissionKeys = this.permissionKeysFromRole(user.role);

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role.name,
      permissions: permissionKeys,
      tenantId: user.tenantId ?? null
    });

    return {
      data: {
        user: {
          ...this.toPublicUser(user),
          permissions: permissionKeys
        },
        ...tokens
      },
      message: "Registration successful"
    };
  }

  async login(dto: LoginDto) {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        role: {
          include: {
            permissions: {
              select: {
                key: true
              }
            }
          }
        },
        linkedWorkforceEmployees: { select: { id: true, active: true } }
      }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const linkedEmployee = user.linkedWorkforceEmployees?.[0];
    if (linkedEmployee && !linkedEmployee.active) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt <= now && user.mustChangePassword) {
      throw new UnauthorizedException("Temporary password expired. Contact your administrator.");
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!valid) {
      const nextFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = nextFailedAttempts >= 5;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: nextFailedAttempts,
          lockedUntil: shouldLock ? new Date(now.getTime() + 15 * 60 * 1000) : null
        }
      });
      throw new UnauthorizedException("Invalid email or password");
    }

    const mustChangePassword = user.mustChangePassword === true;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: now, failedLoginAttempts: 0, lockedUntil: null }
    });

    const permissionKeys = this.permissionKeysFromRole(user.role);

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role.name,
      permissions: permissionKeys,
      tenantId: user.tenantId ?? null
    });

    return {
      data: {
        user: {
          ...this.toPublicUser(user),
          permissions: permissionKeys,
          mustChangePassword
        },
        ...tokens,
        mustChangePassword
      },
      message: mustChangePassword ? "Login successful — password change required" : "Login successful"
    };
  }

  async refresh(dto: { refreshToken: string }) {
    const tokenHash = this.hashToken(dto.refreshToken);
    const now = new Date();
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash }
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= now) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const decoded = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
      secret: getRefreshJwtSecret(this.configService)
    });

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        role: {
          include: {
            permissions: {
              select: {
                key: true
              }
            }
          }
        }
      }
    });

    if (!user || !user.isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now }
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (decoded.sub !== storedToken.userId) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now }
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now, lastUsedAt: now }
    });

    const permissionKeys = this.permissionKeysFromRole(user.role);

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role.name,
      permissions: permissionKeys,
      tenantId: user.tenantId ?? null
    });

    return {
      data: tokens,
      message: "Token refreshed"
    };
  }

  async logout(dto: { refreshToken: string }) {
    const token = dto.refreshToken?.trim();
    if (token.length > 0) {
      const tokenHash = this.hashToken(token);
      const now = new Date();
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now }
      });
    }

    return {
      data: { loggedOut: true },
      message: "Logout successful"
    };
  }

  async logoutAll(userId: string) {
    const now = new Date();
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: now
        }
      },
      data: {
        revokedAt: now,
        lastUsedAt: now
      }
    });

    return {
      data: { loggedOutAll: true, revokedSessions: result.count },
      message: "All sessions revoked"
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      return {
        data: { accepted: true },
        message: "If this email exists, a reset link has been sent"
      };
    }

    const ctx = requestContext.get();
    const now = new Date();
    const token = randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: {
          gt: now
        }
      },
      data: {
        usedAt: now
      }
    });

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
        ipAddress: ctx?.ipAddress ?? undefined
      }
    });

    const frontendBase =
      this.configService.get<string>("FRONTEND_URL") ??
      this.configService.get<string>("CORS_ORIGIN", "http://localhost:3001").split(",")[0].trim();
    const resetLink = `${frontendBase.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await this.emailDispatchService.dispatch({
        userId: user.id,
        title: "MaintainPro password reset",
        message:
          `We received a password reset request for your MaintainPro account.\n\n` +
          `Reset link: ${resetLink}\n\n` +
          `This link expires in 15 minutes. If you did not request this, you can ignore this email.`
      });
    } catch (error) {
      this.logger.warn(
        `Password reset email dispatch failed for user ${user.id}: ${(error as Error).message}`
      );
    }

    return {
      data: { accepted: true },
      message: "If this email exists, a reset link has been sent"
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const now = new Date();
    const passwordResetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash }
    });

    if (!passwordResetToken || passwordResetToken.usedAt || passwordResetToken.expiresAt <= now) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const ctx = requestContext.get();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: passwordResetToken.userId },
        data: { passwordHash }
      });

      await tx.passwordResetToken.update({
        where: { id: passwordResetToken.id },
        data: { usedAt: now }
      });

      await tx.refreshToken.updateMany({
        where: {
          userId: passwordResetToken.userId,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          lastUsedAt: now
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: null,
          actorId: passwordResetToken.userId,
          module: "auth",
          entity: "USER",
          entityId: passwordResetToken.userId,
          action: AuditAction.UPDATE,
          reason: "Password reset completed",
          ipAddress: ctx?.ipAddress ?? undefined,
          userAgent: ctx?.userAgent ?? undefined,
          requestPath: ctx?.requestPath ?? undefined,
          afterData: { passwordResetAt: now.toISOString(), refreshSessionsRevoked: true }
        }
      });
    });

    return {
      data: { changed: true },
      message: "Password reset successful"
    };
  }

  async verifyInvite(token: string) {
    const tokenHash = this.hashToken(token);
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } }
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

    return {
      data: {
        email: invitation.user.email,
        fullName: `${invitation.user.firstName} ${invitation.user.lastName}`.trim(),
        expiresAt: invitation.expiresAt.toISOString()
      },
      message: "Invitation valid"
    };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const tokenHash = this.hashToken(dto.token);
    const now = new Date();
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        status: true,
        acceptedAt: true,
        expiresAt: true
      }
    });

    if (!invitation) throw new BadRequestException("Invitation not found or invalid");
    if (invitation.status === UserInviteStatus.REVOKED) throw new BadRequestException("Invitation revoked");
    if (invitation.status === UserInviteStatus.ACCEPTED || invitation.acceptedAt) {
      throw new BadRequestException("Invitation already accepted");
    }
    if (invitation.expiresAt <= now) {
      throw new BadRequestException("Invitation expired");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const ctx = requestContext.get();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
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
      });
      await tx.userInvitation.update({
        where: { id: invitation.id },
        data: { status: UserInviteStatus.ACCEPTED, acceptedAt: now }
      });
      await tx.auditLog.create({
        data: {
          tenantId: invitation.tenantId,
          actorId: invitation.userId,
          module: "people",
          entity: "UserInvitation",
          entityId: invitation.id,
          action: AuditAction.UPDATE,
          reason: "Invitation accepted",
          ipAddress: ctx?.ipAddress ?? undefined,
          userAgent: ctx?.userAgent ?? undefined,
          requestPath: ctx?.requestPath ?? undefined,
          metadata: { event: "invitation_accepted" }
        }
      });
    });

    return {
      data: { accepted: true },
      message: "Account activated — you can now sign in"
    };
  }

  async me(userId: string, activeTenantId: string | null = null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              select: {
                key: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    let resolvedTenantId = activeTenantId ?? user.tenantId ?? null;

    if (!resolvedTenantId) {
      const firstMembership = await this.prisma.tenantMembership.findFirst({
        where: {
          userId,
          tenant: {
            isActive: true
          }
        },
        select: {
          tenantId: true
        },
        orderBy: {
          joinedAt: "asc"
        }
      });

      resolvedTenantId = firstMembership?.tenantId ?? null;
    }

    const permissionKeys = this.permissionKeysFromRole(user.role);

    return {
      data: {
        ...this.toPublicUser(user),
        permissions: permissionKeys,
        tenantId: resolvedTenantId
      },
      message: "Profile fetched"
    };
  }
}
