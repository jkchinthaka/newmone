import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { CostAllocationService } from "./cost-allocation.service";
import { DataQualityService } from "./data-quality.service";
import { EnterpriseOpsService } from "./enterprise-ops.service";
import { PmForecastService } from "./pm-forecast.service";
import { ProcurementRecommendationService } from "./procurement-recommendation.service";
import { WarrantyHealthService } from "./warranty-health.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Enterprise Operations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("enterprise-ops")
export class EnterpriseOpsController {
  constructor(
    private readonly ops: EnterpriseOpsService,
    private readonly exceptions: DataQualityService,
    private readonly forecasts: PmForecastService,
    private readonly costs: CostAllocationService,
    private readonly warrantyHealth: WarrantyHealthService,
    private readonly procurement: ProcurementRecommendationService
  ) {}

  @Get("dashboard")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "VIEWER")
  @Permissions("operations.view")
  async dashboard(@Req() req: AuthedRequest) {
    const data = await this.ops.dashboard(req.user);
    return { data, message: "Enterprise operations dashboard" };
  }

  @Get("exceptions")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "VIEWER")
  @Permissions("operations.view")
  async listExceptions(
    @Req() req: AuthedRequest,
    @Query("status") status?: string,
    @Query("severity") severity?: string,
    @Query("module") module?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    const data = await this.exceptions.list(req.user, {
      status,
      severity,
      module,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
    return { data, message: "Business exceptions" };
  }

  @Get("exceptions/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "VIEWER")
  @Permissions("operations.view")
  async getException(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.exceptions.get(id, req.user);
    return { data, message: "Business exception" };
  }

  @Post("exceptions/:id/resolve")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("operations.manage")
  async resolveException(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { status: "RESOLVED" | "IGNORED_WITH_REASON" | "INVESTIGATING"; resolution: string }
  ) {
    const data = await this.exceptions.resolve(id, req.user, body);
    return { data, message: "Exception updated" };
  }

  @Post("exceptions/scan")
  @Roles("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER")
  @Permissions("operations.manage")
  async scan(@Req() req: AuthedRequest) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return { data: { scanned: 0, upserted: 0 }, message: "Tenant required" };
    }
    const data = await this.exceptions.scanTenant(tenantId);
    return { data, message: "Data quality scan completed" };
  }

  @Get("forecasts")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "TECHNICIAN", "MECHANIC")
  @Permissions("operations.view")
  async forecastsList(@Req() req: AuthedRequest) {
    const data = await this.forecasts.listForecasts(req.user);
    return { data, message: "Maintenance forecasts" };
  }

  @Post("forecasts/refresh")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("operations.manage")
  async refreshForecasts(@Req() req: AuthedRequest) {
    const data = await this.forecasts.refreshForecasts(req.user);
    return { data, message: "Maintenance forecasts refreshed" };
  }

  @Get("costs")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FINANCE")
  @Permissions("reports.vehicle_cost.view")
  async costsList(@Req() req: AuthedRequest) {
    const data = await this.costs.summarizeFleet(req.user);
    return { data, message: "Vehicle cost allocation" };
  }

  @Get("health")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FLEET_MANAGER")
  @Permissions("vehicles.view")
  async health(@Req() req: AuthedRequest) {
    const data = await this.warrantyHealth.listHealth(req.user);
    return { data, message: "Vehicle health scores" };
  }

  @Get("health/:vehicleId")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FLEET_MANAGER")
  @Permissions("vehicles.view")
  async healthOne(@Req() req: AuthedRequest, @Param("vehicleId") vehicleId: string) {
    const data = await this.warrantyHealth.scoreVehicle(req.user.tenantId as string, vehicleId);
    return { data, message: "Vehicle health score" };
  }

  @Get("warranty")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER")
  @Permissions("operations.view")
  async warranty(@Req() req: AuthedRequest) {
    const data = await this.warrantyHealth.listWarrantyOpportunities(req.user);
    return { data, message: "Warranty opportunities" };
  }

  @Get("installed-parts")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER")
  @Permissions("operations.view")
  async installed(@Req() req: AuthedRequest, @Query("vehicleId") vehicleId?: string) {
    const data = await this.warrantyHealth.listInstalled(req.user, vehicleId);
    return { data, message: "Installed parts" };
  }

  @Get("compatibilities")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER")
  @Permissions("inventory.manage")
  async compat(@Req() req: AuthedRequest, @Query("partId") partId?: string) {
    const data = await this.warrantyHealth.listCompatibilities(req.user, partId);
    return { data, message: "Part compatibility rules" };
  }

  @Post("compatibilities")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER")
  @Permissions("inventory.manage")
  async createCompat(
    @Req() req: AuthedRequest,
    @Body() body: { partId: string; vehicleType?: string; make?: string; vehicleModel?: string; engineCode?: string; notes?: string }
  ) {
    const data = await this.warrantyHealth.upsertCompatibility(req.user, body);
    return { data, message: "Compatibility rule saved" };
  }

  @Get("procurement")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER", "PROCUREMENT_OFFICER")
  @Permissions("purchase_orders.view")
  async procurementList(@Req() req: AuthedRequest) {
    const data = await this.procurement.list(req.user);
    return { data, message: "Procurement recommendations" };
  }

  @Post("procurement/evaluate")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER")
  @Permissions("purchase_orders.create")
  async evaluate(@Req() req: AuthedRequest) {
    const data = await this.procurement.evaluate(req.user);
    return { data, message: "Procurement recommendations evaluated" };
  }

  @Post("procurement/:id/review")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER")
  @Permissions("purchase_orders.view")
  async review(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.procurement.review(id, req.user);
    return { data, message: "Recommendation reviewed" };
  }

  @Post("procurement/:id/create-po")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER")
  @Permissions("purchase_orders.create")
  async createPo(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.procurement.convertToPurchaseOrder(id, req.user);
    return { data, message: "Purchase order created from recommendation" };
  }
}
