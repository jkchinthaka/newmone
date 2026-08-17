import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomUUID } from "crypto";

import { PrismaService } from "../../database/prisma.service";
import {
  FG_PERMISSION_KEYS,
  FG_SSO_AUDIENCE_DEFAULT,
  FG_SSO_ISSUER_DEFAULT,
  FG_SSO_TTL_SECONDS_DEFAULT
} from "./fg-sso.constants";

export type FgSsoAssertionClaims = {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tenantId?: string | null;
  role?: string;
  permissions: string[];
  jti: string;
  iat: number;
  exp: number;
};

@Injectable()
export class FgSsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  private signingSecret(): string {
    const secret = (
      this.configService.get<string>("FG_SSO_SIGNING_SECRET") ||
      this.configService.get<string>("FG_SSO_SHARED_SECRET") ||
      ""
    ).trim();
    if (secret.length < 32) {
      throw new ServiceUnavailableException(
        "FG SSO is not configured (FG_SSO_SIGNING_SECRET required, min 32 chars)"
      );
    }
    return secret;
  }

  private issuer(): string {
    return (
      this.configService.get<string>("FG_SSO_ISSUER")?.trim() || FG_SSO_ISSUER_DEFAULT
    );
  }

  private audience(): string {
    return (
      this.configService.get<string>("FG_SSO_AUDIENCE")?.trim() || FG_SSO_AUDIENCE_DEFAULT
    );
  }

  private ttlSeconds(): number {
    const raw = Number(
      this.configService.get<string | number>("FG_SSO_TTL_SECONDS") ??
        FG_SSO_TTL_SECONDS_DEFAULT
    );
    if (!Number.isFinite(raw) || raw < 15 || raw > 300) {
      return FG_SSO_TTL_SECONDS_DEFAULT;
    }
    return Math.floor(raw);
  }

  /**
   * Mint a short-lived FG SSO assertion for an authenticated MaintainPro user.
   * Never embeds password material. Requires live DB identity + fg.access.
   */
  async exchangeForUser(userId: string): Promise<{
    assertion: string;
    expiresIn: number;
    jti: string;
  }> {
    // Fail closed on misconfiguration before any identity work.
    const secret = this.signingSecret();
    const issuer = this.issuer();
    const audience = this.audience();
    const ttl = this.ttlSeconds();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: { include: { permissions: true } } }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("User is inactive or not found");
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException("User account is locked");
    }

    const permissionKeys = new Set(
      (user.role?.permissions ?? []).map((p) => p.key).filter(Boolean)
    );
    const isSuperAdmin = user.role?.name === "SUPER_ADMIN";
    if (!isSuperAdmin && !permissionKeys.has("fg.access")) {
      throw new ForbiddenException("Missing required permission: fg.access");
    }

    const fgPermissions = isSuperAdmin
      ? [...FG_PERMISSION_KEYS]
      : FG_PERMISSION_KEYS.filter((key) => permissionKeys.has(key));

    if (!fgPermissions.includes("fg.access") && !isSuperAdmin) {
      throw new ForbiddenException("Missing required permission: fg.access");
    }

    const jti = randomUUID();
    const nowSec = Math.floor(Date.now() / 1000);
    const payload: FgSsoAssertionClaims = {
      iss: issuer,
      aud: audience,
      sub: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      tenantId: user.tenantId ?? null,
      role: user.role?.name,
      permissions: isSuperAdmin ? [...FG_PERMISSION_KEYS] : fgPermissions,
      jti,
      iat: nowSec,
      exp: nowSec + ttl
    };

    const assertion = await this.jwtService.signAsync(payload, {
      secret,
      // exp already in payload; avoid double-setting via expiresIn mismatch
      algorithm: "HS256"
    });

    return { assertion, expiresIn: ttl, jti };
  }

  /** Verify assertion for unit tests / optional Nest-side validation. */
  async verifyAssertion(assertion: string): Promise<FgSsoAssertionClaims> {
    let verified: FgSsoAssertionClaims;
    try {
      verified = await this.jwtService.verifyAsync<FgSsoAssertionClaims>(assertion, {
        secret: this.signingSecret(),
        algorithms: ["HS256"],
        issuer: this.issuer(),
        audience: this.audience()
      });
    } catch {
      throw new UnauthorizedException("Invalid FG SSO assertion");
    }

    if (!verified?.sub || !verified.jti) {
      throw new UnauthorizedException("Invalid FG SSO assertion claims");
    }

    // Live re-check — fail closed if revoked/disabled since mint.
    const user = await this.prisma.user.findUnique({
      where: { id: verified.sub },
      include: { role: { include: { permissions: true } } }
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User is inactive or not found");
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException("User account is locked");
    }
    const keys = new Set((user.role?.permissions ?? []).map((p) => p.key));
    if (user.role?.name !== "SUPER_ADMIN" && !keys.has("fg.access")) {
      throw new ForbiddenException("Missing required permission: fg.access");
    }

    return verified;
  }

  /** Stable opaque fingerprint for audit (never log raw assertion). */
  assertionFingerprint(assertion: string): string {
    return createHash("sha256").update(assertion).digest("hex").slice(0, 16);
  }
}
