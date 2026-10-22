import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { EvidenceService } from "./evidence.service";

@ApiTags("Evidence")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("evidence")
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get("readiness")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "ASSET_MANAGER",
    "MECHANIC",
    "TECHNICIAN",
    "FACILITY_MANAGER",
    "MANAGER"
  )
  getReadiness() {
    const data = this.evidenceService.getReadiness();
    return { data, message: "Evidence storage readiness" };
  }
}
