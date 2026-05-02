import { Controller, Get } from "@nestjs/common";

import { Public } from "./common/decorators/public.decorator";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  health() {
    return {
      data: this.healthService.getLiveness(),
      message: "Health check passed"
    };
  }

  @Public()
  @Get("readiness")
  async readiness() {
    return {
      data: await this.healthService.getReadiness(),
      message: "Readiness check completed"
    };
  }
}
