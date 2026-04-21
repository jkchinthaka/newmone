import { Controller, Get } from "@nestjs/common";

import { Public } from "./common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  health() {
    return {
      data: {
        status: "ok",
        service: "maintainpro-api",
        timestamp: new Date().toISOString()
      },
      message: "Health check passed"
    };
  }
}
