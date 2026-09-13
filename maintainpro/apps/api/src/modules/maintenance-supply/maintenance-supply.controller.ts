import { Body, Controller, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { VendorContractType, WorkOrderExecutionMode } from "@prisma/client";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { MaintenanceSupplyService } from "./maintenance-supply.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Maintenance Supply")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("maintenance-supply")
export class MaintenanceSupplyController {
  constructor(private readonly supply: MaintenanceSupplyService) {}

  @Post("work-orders/:id/cost-snapshot")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER")
  async snapshot(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.supply.snapshotWorkOrderCosts(
      req.user,
      id,
      {
        partsCost: Number(body.partsCost ?? 0),
        internalLabourCost: Number(body.internalLabourCost ?? 0),
        externalServiceCost: Number(body.externalServiceCost ?? 0),
        transportCost: Number(body.transportCost ?? 0),
        otherCost: Number(body.otherCost ?? 0)
      },
      body.notes
    );
    return { data, message: "WO cost snapshot saved" };
  }

  @Put("work-orders/:id/execution-mode")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER")
  async executionMode(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.supply.setExecutionMode(
      req.user,
      id,
      body.mode as WorkOrderExecutionMode
    );
    return { data, message: "Execution mode updated" };
  }

  @Post("part-issues/:id/return")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
  async returnTool(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.supply.returnToolIssue(req.user, id, {
      quantityReturned: Number(body.quantityReturned),
      notes: body.notes
    });
    return { data, message: "Tool return recorded" };
  }

  @Post("contracts")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async createContract(@Req() req: AuthedRequest, @Body() body: any) {
    const data = await this.supply.createVendorContract(req.user, {
      ...body,
      contractType: body.contractType as VendorContractType | undefined,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate)
    });
    return { data, message: "Vendor contract created" };
  }

  @Post("contracts/refresh-expiry")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async refreshContracts(@Req() req: AuthedRequest) {
    const data = await this.supply.refreshContractStatuses(req.user);
    return { data, message: "Contract expiry statuses refreshed" };
  }

  @Post("work-orders/:id/assign-vendor")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER")
  async assignVendor(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.supply.assignVendorToWorkOrder(
      req.user,
      id,
      body.supplierId,
      body.executionMode as WorkOrderExecutionMode | undefined
    );
    return { data, message: "Vendor assigned to work order" };
  }
}
