import { Module } from "@nestjs/common";

import { InsuranceClaimsController } from "./insurance-claims.controller";
import { InsuranceClaimsService } from "./insurance-claims.service";

@Module({
  controllers: [InsuranceClaimsController],
  providers: [InsuranceClaimsService],
  exports: [InsuranceClaimsService]
})
export class InsuranceClaimsModule {}
