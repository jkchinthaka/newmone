import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { JwtPayload } from "./auth.types";
import { getAccessJwtSecret } from "../../config/jwt-secrets";
import { PrismaService } from "../../database/prisma.service";
import { resolvePreviewIdentity } from "../../common/auth/access-preview";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => {
          const header = request.headers.cookie;
          if (!header) return null;

          const match = header
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith("maintainpro_access="));

          return match ? decodeURIComponent(match.slice("maintainpro_access=".length)) : null;
        }
      ]),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: getAccessJwtSecret(configService)
    });
  }

  async validate(request: Request, payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        isActive: true,
        lockedUntil: true,
        tenantId: true,
        role: { select: { name: true } }
      }
    });

    if (!user?.isActive || !user.role?.name) {
      throw new UnauthorizedException("Account is inactive or no longer exists");
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException("User account is temporarily locked");
    }

    return resolvePreviewIdentity(this.prisma, request.headers, {
      ...payload,
      role: user.role.name,
      tenantId: user.tenantId
    });
  }
}
