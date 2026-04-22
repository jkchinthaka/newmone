import { Module } from "@nestjs/common";

import { QrCodeService } from "../../common/services/qr-code.service";
import { CleaningController } from "./cleaning.controller";
import { CleaningService } from "./cleaning.service";

@Module({
  controllers: [CleaningController],
  providers: [CleaningService, QrCodeService],
  exports: [CleaningService]
})
export class CleaningModule {}
