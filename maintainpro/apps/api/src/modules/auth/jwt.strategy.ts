import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { JwtPayload } from "./auth.types";
import { getAccessJwtSecret } from "../../config/jwt-secrets";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ConfigService) configService: ConfigService) {
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

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
