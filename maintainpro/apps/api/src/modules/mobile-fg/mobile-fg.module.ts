import { Module, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../database/prisma.module";
import { FgDjangoClient } from "./fg-django-client";
import {
  createFgSessionStore,
  FG_MOBILE_SESSION_TTL_DEFAULT,
  FG_SESSION_REDIS_REQUIRED_MSG,
  FG_SESSION_STORE
} from "./fg-session-store";
import { MobileFgController } from "./mobile-fg.controller";
import { MobileFgService } from "./mobile-fg.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MobileFgController],
  providers: [
    FgDjangoClient,
    MobileFgService,
    {
      provide: FG_SESSION_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttlRaw = Number(
          config.get<string | number>("FG_MOBILE_SESSION_TTL_SECONDS") ??
            FG_MOBILE_SESSION_TTL_DEFAULT
        );
        const ttlSeconds =
          Number.isFinite(ttlRaw) && ttlRaw >= 60 && ttlRaw <= 86_400
            ? Math.floor(ttlRaw)
            : FG_MOBILE_SESSION_TTL_DEFAULT;
        const redisUrl = (config.get<string>("REDIS_URL", "") ?? "").trim();
        const isProduction = config.get<string>("NODE_ENV", "development") === "production";

        if (isProduction && !redisUrl) {
          throw new ServiceUnavailableException(FG_SESSION_REDIS_REQUIRED_MSG);
        }

        try {
          return createFgSessionStore({
            redisUrl,
            ttlSeconds,
            isProduction
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : FG_SESSION_REDIS_REQUIRED_MSG;
          if (message.includes("FG session Redis")) {
            throw new ServiceUnavailableException(message);
          }
          throw err;
        }
      }
    }
  ]
})
export class MobileFgModule {}
