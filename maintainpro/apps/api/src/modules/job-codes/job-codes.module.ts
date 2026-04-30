import { Module } from "@nestjs/common";

import { JobCodesController } from "./job-codes.controller";
import { JobCodesService } from "./job-codes.service";

@Module({
  controllers: [JobCodesController],
  providers: [JobCodesService],
  exports: [JobCodesService]
})
export class JobCodesModule {}
