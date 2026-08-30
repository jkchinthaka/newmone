import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../database/prisma.module";
import { FgDjangoClient } from "./fg-django-client";
import {
  createFgSessionStore,
  FG_MOBILE_SESSION_TTL_DEFAULT,
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
        return createFgSessionStore({
          redisUrl: config.get<string>("REDIS_URL", ""),
          ttlSeconds,
          isProduction: config.get<string>("NODE_ENV", "development") === "production"
        });
      }
    }
  ]
})
export class MobileFgModule {}
