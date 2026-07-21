import { Controller, Get } from "@nestjs/common";

import { Public } from "./common/decorators/public.decorator";
import { Roles } from "./common/decorators/roles.decorator";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async health() {
    return {
      data: await this.healthService.getPublicHealth(),
      message: "Health check passed"
    };
  }

  @Public()
  @Get("build-info")
  buildInfo() {
    return {
      data: this.healthService.getSafeBuildInfoPayload(),
      message: "Build info fetched"
    };
  }

  @Roles("SUPER_ADMIN", "ADMIN")
  @Get("readiness")
  async readiness() {
    return {
      data: await this.healthService.getReadiness(),
      message: "Readiness check completed"
    };
  }

  @Roles("SUPER_ADMIN", "ADMIN")
  @Get("deployment-readiness")
  async deploymentReadiness() {
    return {
      data: this.healthService.getDeploymentReadinessSummary(),
      message: "Deployment readiness summary fetched"
    };
  }
}
