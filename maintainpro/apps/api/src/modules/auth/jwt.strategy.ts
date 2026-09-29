import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { JwtPayload } from "./auth.types";
import { getAccessJwtSecret } from "../../config/jwt-secrets";
import { PrismaService } from "../../database/prisma.service";

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
      secretOrKey: getAccessJwtSecret(configService)
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account is inactive or no longer exists");
    }

    return payload;
  }
}
