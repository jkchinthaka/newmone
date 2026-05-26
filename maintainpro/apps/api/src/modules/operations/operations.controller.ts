import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { OperationsService } from "./operations.service";

type AuthedRequest = {
  user: JwtPayload;
};

@ApiTags("Operations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("operations")
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Post("scan-lookup")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATIONS_MANAGER",
    "FLEET_MANAGER",
    "COMPLIANCE_MANAGER",
    "MANAGER",
    "TECHNICIAN",
    "MECHANIC",
    "ASSET_MANAGER",
    "SUPERVISOR",
    "DRIVER"
  )
  @Permissions("operations.scan_lookup")
  async scanLookup(@Req() req: AuthedRequest, @Body() body: { code: string }) {
    const data = await this.operationsService.scanLookup(body.code, req.user);
    return { data, message: "Operational scan target resolved" };
  }
}