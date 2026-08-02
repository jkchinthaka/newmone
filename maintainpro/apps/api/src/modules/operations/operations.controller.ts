import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { OperationalAlertEvaluatorService } from "./alerts/operational-alert-evaluator.service";
import { OperationalAlertService } from "./alerts/operational-alert.service";
import { OperationalMetricsService } from "./alerts/operational-metrics.service";
import { OperationsService } from "./operations.service";
import { QueueStartupReconciliationService } from "../queues/reconciliation/queue-startup-reconciliation.service";

type AuthedRequest = {
  user: JwtPayload;
};

@ApiTags("Operations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("operations")
export class OperationsController {
  constructor(
    private readonly operationsService: OperationsService,
    private readonly alertService: OperationalAlertService,
    private readonly alertEvaluator: OperationalAlertEvaluatorService,
    private readonly metricsService: OperationalMetricsService,
    private readonly reconciliation: QueueStartupReconciliationService
  ) {}

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
    "SECURITY_OFFICER",
    "DRIVER"
  )
  @Permissions("operations.scan_lookup")
  async scanLookup(@Req() req: AuthedRequest, @Body() body: { code: string }) {
    const data = await this.operationsService.scanLookup(body.code, req.user);
    return { data, message: "Operational scan target resolved" };
  }

  @Get("metrics")
  @Roles("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER")
  async metrics() {
    const data = await this.metricsService.getSnapshot();
    return { data, message: "Operational metrics snapshot" };
  }

  @Get("alerts")
  @Roles("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER")
  async listAlerts() {
    const data = await this.alertService.listActive();
    return { data, message: "Active operational alerts" };
  }

  @Post("alerts/:id/acknowledge")
  @Roles("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER")
  async acknowledge(@Param("id") id: string, @Req() req: AuthedRequest) {
    const data = await this.alertService.acknowledge(id, req.user.sub);
    return { data, message: "Operational alert acknowledged" };
  }

  @Post("alerts/evaluate")
  @Roles("SUPER_ADMIN", "ADMIN")
  async evaluate() {
    const data = await this.alertEvaluator.evaluateOnce();
    return { data, message: "Operational alert evaluation completed" };
  }

  @Get("alerts/mock-notifications")
  @Roles("SUPER_ADMIN", "ADMIN")
  async mockNotifications() {
    return {
      data: this.alertService.getMockNotificationEvidence(),
      message: "Mock operational notification evidence"
    };
  }

  @Get("queue-reconciliation")
  @Roles("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER")
  async queueReconciliationStatus() {
    return {
      data: this.reconciliation.getStatus(),
      message: "Queue reconciliation status"
    };
  }

  @Post("queue-reconciliation/run")
  @Roles("SUPER_ADMIN", "ADMIN")
  async runQueueReconciliation() {
    const data = await this.reconciliation.reconcileNotifications({ force: true });
    return { data, message: "Queue reconciliation invoked" };
  }
}
