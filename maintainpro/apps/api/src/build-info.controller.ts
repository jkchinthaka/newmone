import { Controller, Get } from "@nestjs/common";

import { Public } from "./common/decorators/public.decorator";
import { HealthService } from "./health.service";

@Controller("build-info")
export class BuildInfoController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  getBuildInfo() {
    return {
      data: this.healthService.getSafeBuildInfoPayload(),
      message: "Build info fetched"
    };
  }
}