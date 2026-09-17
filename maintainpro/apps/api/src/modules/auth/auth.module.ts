import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { NotificationsModule } from "../notifications/notifications.module";
import { MaintenanceConfigModule } from "../maintenance-config/maintenance-config.module";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { FgSsoService } from "./fg-sso.service";
import { GoogleStrategy } from "./google.strategy";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({}),
    NotificationsModule,
    MaintenanceConfigModule
  ],
  controllers: [AuthController],
  providers: [AuthService, FgSsoService, JwtStrategy, GoogleStrategy],
  exports: [AuthService, FgSsoService]
})
export class AuthModule {}
