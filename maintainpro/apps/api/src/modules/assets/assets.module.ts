import { Module } from "@nestjs/common";

import { QrCodeService } from "../../common/services/qr-code.service";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, QrCodeService],
  exports: [AssetsService]
})
export class AssetsModule {}
