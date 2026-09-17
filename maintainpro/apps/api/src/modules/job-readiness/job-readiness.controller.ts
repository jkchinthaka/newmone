import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import type { JwtPayload } from "../auth/auth.types";
import { JobReadinessService } from "./job-readiness.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Job Readiness")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("work-orders")
export class JobReadinessController {
  constructor(private readonly readiness: JobReadinessService) {}

  @Get(":id/readiness")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC", "PLANNER")
  @Permissions("work_orders.manage")
  async getReadiness(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.readiness.evaluate(req.user, id);
    return { data, message: "Job readiness" };
  }
}
