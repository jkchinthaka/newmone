import {
  Controller,
  Get,
  Res
} from "@nestjs/common";
import type { Response } from "express";

import { Public } from "./common/decorators/public.decorator";
import { Roles } from "./common/decorators/roles.decorator";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Legacy public health (includes DB ping in body). Prefer /live and /ready.
   * Remains HTTP 200 for backward compatibility with older clients.
   */
  @Public()
  @Get()
  async health() {
    return {
      data: await this.healthService.getPublicHealth(),
      message: "Health check passed"
    };
  }

  /** Liveness: process alive; no dependency checks. Always HTTP 200 while process responds. */
  @Public()
  @Get("live")
  live() {
    return {
      data: this.healthService.getLiveness(),
      message: "Liveness check passed"
    };
  }

  /** Minimal readiness for LB/CI: HTTP 200 when required deps up, else 503. */
  @Public()
  @Get("ready")
  async ready(@Res({ passthrough: true }) res: Response) {
    const payload = await this.healthService.getMinimalReadiness();
    res.status(payload.httpStatus);
    return {
      data: payload.body,
      message:
        payload.body.status === "ready" ? "Readiness check passed" : "Readiness check failed"
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
