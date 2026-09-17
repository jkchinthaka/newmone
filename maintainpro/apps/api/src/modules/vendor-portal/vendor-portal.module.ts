import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { VendorPortalController } from "./vendor-portal.controller";
import { VendorPortalService } from "./vendor-portal.service";

@Module({
  imports: [PrismaModule],
  controllers: [VendorPortalController],
  providers: [VendorPortalService],
  exports: [VendorPortalService]
})
export class VendorPortalModule {}
