import { Module } from "@nestjs/common";

import { QrCodeService } from "../../common/services/qr-code.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { CleaningController } from "./cleaning.controller";
import { CleaningService } from "./cleaning.service";

@Module({
  imports: [NotificationsModule],
  controllers: [CleaningController],
  providers: [CleaningService, QrCodeService],
  exports: [CleaningService]
})
export class CleaningModule {}
