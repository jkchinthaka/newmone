import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { InventoryService } from "./inventory.service";
import { ErpStockSyncService } from "./erp-stock-sync.service";

type AuthedRequest = {
  user: JwtPayload;
};

@ApiTags("Inventory")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("inventory")
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly erpStockSyncService: ErpStockSyncService
  ) {}

  @Get("parts")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.manage")
  async parts(@Req() req: AuthedRequest) {
    const data = await this.inventoryService.parts(req.user);
    return { data, message: "Parts fetched" };
  }

  @Post("parts")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.manage")
  async createPart(
    @Req() req: AuthedRequest,
    @Body() body: { partNumber: string; name: string; category: string; unitCost: number; unit?: string; minimumStock?: number; reorderPoint?: number; quantityInStock?: number; location?: string; supplierId?: string }
  ) {
    const data = await this.inventoryService.createPart(body, req.user);
    return { data, message: "Part created" };
  }

  @Post("parts/bulk-delete")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("inventory.manage")
  async bulkDelete(@Req() req: AuthedRequest, @Body() body: { ids: string[] }) {
    const data = await this.inventoryService.bulkDeleteParts(body.ids, req.user);
    return { data, message: "Parts deleted" };
  }

  @Patch("parts/bulk-category")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("inventory.manage")
  async bulkCategory(@Req() req: AuthedRequest, @Body() body: { ids: string[]; category: string }) {
    const data = await this.inventoryService.bulkUpdateCategory(body.ids, body.category, req.user);
    return { data, message: "Part categories updated" };
  }

  @Get("parts/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.manage")
  async part(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.inventoryService.part(id, req.user);
    return { data, message: "Part fetched" };
  }

  @Patch("parts/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.manage")
  async updatePart(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Partial<{ name: string; category: string; unitCost: number; minimumStock: number; reorderPoint: number; location: string }>
  ) {
    const data = await this.inventoryService.updatePart(id, body, req.user);
    return { data, message: "Part updated" };
  }

  @Delete("parts/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("inventory.manage")
  async removePart(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.inventoryService.removePart(id, req.user);
    return { data, message: "Part deleted" };
  }

  @Post("parts/:id/stock-in")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.manage")
  async stockIn(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { quantity: number; notes?: string }) {
    const data = await this.inventoryService.stockIn(id, body.quantity, body.notes, req.user);
    return { data, message: "Stock added" };
  }

  @Post("parts/:id/stock-out")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("inventory.stock_issue")
  async stockOut(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { quantity: number; notes?: string }) {
    const data = await this.inventoryService.stockOut(id, body.quantity, body.notes, req.user);
    return { data, message: "Stock deducted" };
  }

  @Get("parts/:id/movements")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.manage")
  async movements(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.inventoryService.movements(id, req.user);
    return { data, message: "Stock movements fetched" };
  }

  @Get("parts/:id/work-orders")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.manage")
  async linkedWorkOrders(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.inventoryService.linkedWorkOrders(id, req.user);
    return { data, message: "Linked work orders fetched" };
  }

  @Get("parts/:id/purchase-history")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.manage")
  async purchaseHistory(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.inventoryService.purchaseHistoryForPart(id, req.user);
    return { data, message: "Part purchase history fetched" };
  }

  @Get("analytics/usage")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.manage")
  async usageTrend(@Req() req: AuthedRequest, @Query("days") days?: string) {
    const safeDays = Number.isFinite(Number(days)) ? Number(days) : 30;
    const data = await this.inventoryService.usageTrend(safeDays, req.user);
    return { data, message: "Inventory usage trend fetched" };
  }

  @Get("analytics/top-used")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.manage")
  async topUsed(@Req() req: AuthedRequest, @Query("days") days?: string, @Query("limit") limit?: string) {
    const safeDays = Number.isFinite(Number(days)) ? Number(days) : 30;
    const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 5;
    const data = await this.inventoryService.topUsedParts(safeLimit, safeDays, req.user);
    return { data, message: "Top used parts fetched" };
  }

  @Get("low-stock")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  @Permissions("inventory.manage")
  async lowStock(@Req() req: AuthedRequest) {
    const data = await this.inventoryService.lowStock(req.user);
    return { data, message: "Low stock fetched" };
  }

  @Get("purchase-orders")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("part_requests.view")
  async purchaseOrders(@Req() req: AuthedRequest) {
    const data = await this.inventoryService.purchaseOrders(req.user);
    return { data, message: "Purchase orders fetched" };
  }

  @Get("purchase-orders/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("part_requests.view")
  async purchaseOrder(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.inventoryService.getPurchaseOrder(id, req.user);
    return { data, message: "Purchase order fetched" };
  }

  @Post("purchase-orders")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("inventory.manage")
  async createPurchaseOrder(
    @Req() req: AuthedRequest,
    @Body() body: {
      poNumber: string;
      supplierId: string;
      orderDate: string;
      expectedDate?: string;
      totalAmount: number;
      notes?: string;
      pettyCash?: boolean;
      lines?: Array<{ partId?: string; description: string; quantity: number; unitCost: number }>;
    }
  ) {
    const data = await this.inventoryService.createPurchaseOrder(body, req.user);
    return { data, message: "Purchase order created" };
  }

  @Patch("purchase-orders/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("inventory.manage")
  async updatePurchaseOrder(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Partial<{ status: "PENDING" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED"; receivedDate: string; notes: string }>
  ) {
    const data = await this.inventoryService.updatePurchaseOrder(id, body, req.user);
    return { data, message: "Purchase order updated" };
  }

  @Patch("purchase-orders/:id/approve-operational")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER")
  @Permissions("purchase_orders.approve_operational")
  async approvePurchaseOrderOperational(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { reason?: string }
  ) {
    const data = await this.inventoryService.approvePurchaseOrderOperational(id, body, req.user);
    return { data, message: "Purchase order operationally approved" };
  }

  @Patch("purchase-orders/:id/approve-finance")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("purchase_orders.approve_finance")
  async approvePurchaseOrderFinance(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { reason?: string }
  ) {
    const data = await this.inventoryService.approvePurchaseOrderFinance(id, body, req.user);
    return { data, message: "Purchase order finance approved" };
  }

  @Patch("purchase-orders/:id/reject")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER")
  @Permissions("purchase_orders.reject")
  async rejectPurchaseOrder(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { reason: string }
  ) {
    const data = await this.inventoryService.rejectPurchaseOrder(id, body, req.user);
    return { data, message: "Purchase order rejected" };
  }

  @Post("purchase-orders/:id/erp-sync")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER")
  @Permissions("purchase_orders.erp_sync")
  async syncPurchaseOrderToErp(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { forceFailure?: boolean; note?: string }
  ) {
    const data = await this.inventoryService.syncPurchaseOrderToErp(id, body, req.user);
    return { data, message: "Manual ERP sync executed" };
  }

  @Post("purchase-orders/:id/erp-sync/retry")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER")
  @Permissions("purchase_orders.erp_sync_retry")
  async retryPurchaseOrderErpSync(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { forceFailure?: boolean; note?: string }
  ) {
    const data = await this.inventoryService.retryPurchaseOrderErpSync(id, body, req.user);
    return { data, message: "ERP sync retry executed" };
  }

  @Get("erp/readiness")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "INVENTORY_KEEPER",
    "ASSET_MANAGER",
    "OPERATIONS_MANAGER",
    "PROCUREMENT_OFFICER"
  )
  @Permissions("inventory.manage")
  async getErpStockSyncReadiness() {
    const data = this.erpStockSyncService.getReadiness();
    return { data, message: "ERP stock sync readiness" };
  }

  @Post("erp/stock-sync/dry-run")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "INVENTORY_KEEPER",
    "ASSET_MANAGER",
    "OPERATIONS_MANAGER",
    "PROCUREMENT_OFFICER"
  )
  @Permissions("inventory.manage")
  async dryRunErpStockSync(@Req() req: AuthedRequest) {
    const data = await this.erpStockSyncService.dryRunStockSync(req.user);
    return { data, message: "ERP stock sync dry-run completed" };
  }

  @Post("erp/stock-sync/apply")
  @Roles("SUPER_ADMIN", "ADMIN", "INVENTORY_KEEPER", "ASSET_MANAGER")
  @Permissions("inventory.manage")
  async applyErpStockSync(@Req() req: AuthedRequest) {
    const data = await this.erpStockSyncService.applyStockSnapshot(req.user);
    return { data, message: "ERP stock sync apply completed" };
  }
}
