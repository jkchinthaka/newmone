import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { TenantContextGuard } from "./tenant-context.guard";
import { TenancyController } from "./tenancy.controller";
import { TenancyService } from "./tenancy.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [TenancyController],
  providers: [TenancyService, TenantContextGuard],
  exports: [TenancyService, TenantContextGuard]
})
export class TenancyModule {}
