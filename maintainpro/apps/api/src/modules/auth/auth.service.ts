import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { RoleName } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import type { AuthTokens, JwtPayload } from "./auth.types";

@Injectable()
export class AuthService {
  private readonly refreshTokenStore = new Map<string, { userId: string; expiresAt: number }>();
  private readonly resetTokenStore = new Map<string, string>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  private toPublicUser<T extends { passwordHash: string }>(user: T): Omit<T, "passwordHash"> {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  private async generateTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: this.configService.get<string>("JWT_ACCESS_EXPIRES", "15m")
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRES", "7d")
    });

    this.refreshTokenStore.set(refreshToken, {
      userId: payload.sub,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existing) {
      throw new BadRequestException("Email already in use");
    }

    const technicianRole = await this.prisma.role.findFirst({ where: { name: RoleName.TECHNICIAN } });

    if (!technicianRole) {
      throw new NotFoundException("Default role not found. Run seed first.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: technicianRole.id
      },
      include: {
        role: true
      }
    });

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role.name,
      tenantId: user.tenantId ?? null
    });

    return {
      data: {
        user: this.toPublicUser(user),
        ...tokens
      },
      message: "Registration successful"
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true }
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role.name,
      tenantId: user.tenantId ?? null
    });

    return {
      data: {
        user: this.toPublicUser(user),
        ...tokens
      },
      message: "Login successful"
    };
  }

  async refresh(dto: { refreshToken: string }) {
    const tokenInStore = this.refreshTokenStore.get(dto.refreshToken);

    if (!tokenInStore || tokenInStore.expiresAt < Date.now()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const decoded = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET")
    });

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { role: true }
    });

    if (!user) {
      this.refreshTokenStore.delete(dto.refreshToken);
      throw new UnauthorizedException("Invalid refresh token");
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role.name,
      tenantId: user.tenantId ?? null
    });

    return {
      data: tokens,
      message: "Token refreshed"
    };
  }

  async logout(dto: { refreshToken: string }) {
    this.refreshTokenStore.delete(dto.refreshToken);

    return {
      data: { loggedOut: true },
      message: "Logout successful"
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      return {
        data: { accepted: true },
        message: "If the email exists, a reset link will be sent"
      };
    }

    const token = randomUUID();
    this.resetTokenStore.set(token, user.id);

    return {
      data: { token },
      message: "Password reset token generated"
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const userId = this.resetTokenStore.get(dto.token);

    if (!userId) {
      throw new BadRequestException("Invalid reset token");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    this.resetTokenStore.delete(dto.token);

    return {
      data: { changed: true },
      message: "Password reset successful"
    };
  }

  async me(userId: string, activeTenantId: string | null = null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
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

    return {
      data: {
        ...this.toPublicUser(user),
        tenantId: resolvedTenantId
      },
      message: "Profile fetched"
    };
  }
}
