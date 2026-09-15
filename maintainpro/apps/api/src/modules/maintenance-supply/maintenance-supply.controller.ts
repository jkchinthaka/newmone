import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { VendorContractType, WorkOrderExecutionMode } from "@prisma/client";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { MaintenanceSupplyService } from "./maintenance-supply.service";

type AuthedRequest = { user: JwtPayload };

const MANAGE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER"] as const;
const FIELD_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ASSET_MANAGER",
  "MECHANIC",
  "TECHNICIAN",
  "INVENTORY_KEEPER",
  "STOREKEEPER"
] as const;
const READ_ROLES = [...FIELD_ROLES, "VIEWER", "SUPERVISOR", "OPERATIONS_MANAGER"] as const;

@ApiTags("Maintenance Supply")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("maintenance-supply")
export class MaintenanceSupplyController {
  constructor(private readonly supply: MaintenanceSupplyService) {}

  @Get("parts")
  @Roles(...READ_ROLES)
  @Permissions("parts.view")
  async listParts(@Req() req: AuthedRequest) {
    const data = await this.supply.listPartsMapping(req.user);
    return { data, message: "Spare parts mapping status" };
  }

  @Get("outstanding-tools")
  @Roles(...READ_ROLES)
  @Permissions("parts.view")
  async outstandingTools(@Req() req: AuthedRequest) {
    const data = await this.supply.listOutstandingTools(req.user);
    return { data, message: "Outstanding tool issues" };
  }

  @Get("work-orders/:id/cost")
  @Roles(...READ_ROLES)
  @Permissions("cost.view")
  async getCost(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.supply.getWorkOrderCost(req.user, id);
    return { data, message: "WO cost" };
  }

  @Post("work-orders/:id/cost-snapshot")
  @Roles(...MANAGE_ROLES)
  @Permissions("cost.adjust")
  async snapshot(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    const data = await this.supply.snapshotWorkOrderCosts(
      req.user,
      id,
      {
        partsCost: body.partsCost != null ? Number(body.partsCost) : undefined,
        internalLabourCost:
          body.internalLabourCost != null ? Number(body.internalLabourCost) : undefined,
        externalServiceCost:
          body.externalServiceCost != null ? Number(body.externalServiceCost) : undefined,
        transportCost: body.transportCost != null ? Number(body.transportCost) : undefined,
        otherCost: body.otherCost != null ? Number(body.otherCost) : undefined
      },
      typeof body.notes === "string" ? body.notes : undefined
    );
    return { data, message: "WO cost snapshot saved" };
  }

  @Post("work-orders/:id/cost-snapshot/auto")
  @Roles(...MANAGE_ROLES)
  @Permissions("cost.adjust")
  async autoSnapshot(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { notes?: string }
  ) {
    const data = await this.supply.autoSnapshotWorkOrderCosts(req.user, id, body?.notes);
    return { data, message: "WO cost snapshot auto-built" };
  }

  @Put("work-orders/:id/execution-mode")
  @Roles(...MANAGE_ROLES)
  @Permissions("vendor.manage")
  async executionMode(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { mode?: WorkOrderExecutionMode }
  ) {
    const data = await this.supply.setExecutionMode(req.user, id, body.mode as WorkOrderExecutionMode);
    return { data, message: "Execution mode updated" };
  }

  @Post("part-issues/:id/return")
  @Roles(...FIELD_ROLES)
  @Permissions("parts.return")
  async returnTool(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { quantityReturned?: number; notes?: string }
  ) {
    const data = await this.supply.returnToolIssue(req.user, id, {
      quantityReturned: Number(body.quantityReturned),
      notes: body.notes
    });
    return { data, message: "Tool return recorded" };
  }

  @Post("contracts")
  @Roles(...MANAGE_ROLES)
  @Permissions("contract.manage")
  async createContract(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const data = await this.supply.createVendorContract(req.user, {
      supplierId: String(body.supplierId),
      contractNo: String(body.contractNo),
      contractType: body.contractType as VendorContractType | undefined,
      title: String(body.title),
      coverage: typeof body.coverage === "string" ? body.coverage : undefined,
      slaSummary: typeof body.slaSummary === "string" ? body.slaSummary : undefined,
      visitCount: body.visitCount != null ? Number(body.visitCount) : undefined,
      assetIds: Array.isArray(body.assetIds) ? (body.assetIds as string[]) : undefined,
      siteIds: Array.isArray(body.siteIds) ? (body.siteIds as string[]) : undefined,
      startDate: new Date(String(body.startDate)),
      endDate: new Date(String(body.endDate)),
      valueReference: body.valueReference != null ? Number(body.valueReference) : undefined,
      documentUrls: Array.isArray(body.documentUrls) ? (body.documentUrls as string[]) : undefined,
      reminderDays: body.reminderDays != null ? Number(body.reminderDays) : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined
    });
    return { data, message: "Vendor contract created" };
  }

  @Post("contracts/refresh-expiry")
  @Roles(...MANAGE_ROLES)
  @Permissions("contract.manage")
  async refreshContracts(@Req() req: AuthedRequest) {
    const data = await this.supply.refreshContractStatuses(req.user);
    return { data, message: "Contract expiry statuses refreshed" };
  }

  @Post("work-orders/:id/assign-vendor")
  @Roles(...MANAGE_ROLES)
  @Permissions("vendor.manage")
  async assignVendor(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { supplierId?: string; executionMode?: WorkOrderExecutionMode }
  ) {
    const data = await this.supply.assignVendorToWorkOrder(
      req.user,
      id,
      String(body.supplierId),
      body.executionMode as WorkOrderExecutionMode | undefined
    );
    return { data, message: "Vendor assigned to work order" };
  }

  @Post("map-erp-item")
  @Roles(...MANAGE_ROLES)
  @Permissions("erp.mapping.manage")
  async mapErpItem(
    @Req() req: AuthedRequest,
    @Body() body: { partId?: string; erpCode?: string }
  ) {
    const data = await this.supply.mapErpItem(req.user, String(body.partId), String(body.erpCode));
    return { data, message: "ERP item mapped" };
  }

  @Post("map-warehouse")
  @Roles(...MANAGE_ROLES)
  @Permissions("erp.mapping.manage")
  async mapWarehouse(
    @Req() req: AuthedRequest,
    @Body() body: { warehouseId?: string; erpWarehouseCode?: string }
  ) {
    const data = await this.supply.mapWarehouse(
      req.user,
      String(body.warehouseId),
      String(body.erpWarehouseCode)
    );
    return { data, message: "Warehouse ERP code mapped" };
  }
}
