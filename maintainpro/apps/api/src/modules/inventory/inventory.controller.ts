import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { InventoryService } from "./inventory.service";

@ApiTags("Inventory")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("parts")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async parts() {
    const data = await this.inventoryService.parts();
    return { data, message: "Parts fetched" };
  }

  @Post("parts")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async createPart(@Body() body: { partNumber: string; name: string; category: string; unitCost: number; unit?: string; minimumStock?: number; reorderPoint?: number; quantityInStock?: number; location?: string; supplierId?: string }) {
    const data = await this.inventoryService.createPart(body);
    return { data, message: "Part created" };
  }

  @Post("parts/bulk-delete")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async bulkDelete(@Body() body: { ids: string[] }) {
    const data = await this.inventoryService.bulkDeleteParts(body.ids);
    return { data, message: "Parts deleted" };
  }

  @Patch("parts/bulk-category")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async bulkCategory(@Body() body: { ids: string[]; category: string }) {
    const data = await this.inventoryService.bulkUpdateCategory(body.ids, body.category);
    return { data, message: "Part categories updated" };
  }

  @Get("parts/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async part(@Param("id") id: string) {
    const data = await this.inventoryService.part(id);
    return { data, message: "Part fetched" };
  }

  @Patch("parts/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async updatePart(@Param("id") id: string, @Body() body: Partial<{ name: string; category: string; unitCost: number; minimumStock: number; reorderPoint: number; location: string }>) {
    const data = await this.inventoryService.updatePart(id, body);
    return { data, message: "Part updated" };
  }

  @Delete("parts/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async removePart(@Param("id") id: string) {
    const data = await this.inventoryService.removePart(id);
    return { data, message: "Part deleted" };
  }

  @Post("parts/:id/stock-in")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async stockIn(@Param("id") id: string, @Body() body: { quantity: number; notes?: string }) {
    const data = await this.inventoryService.stockIn(id, body.quantity, body.notes);
    return { data, message: "Stock added" };
  }

  @Post("parts/:id/stock-out")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async stockOut(@Param("id") id: string, @Body() body: { quantity: number; notes?: string }) {
    const data = await this.inventoryService.stockOut(id, body.quantity, body.notes);
    return { data, message: "Stock deducted" };
  }

  @Get("parts/:id/movements")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async movements(@Param("id") id: string) {
    const data = await this.inventoryService.movements(id);
    return { data, message: "Stock movements fetched" };
  }

  @Get("parts/:id/work-orders")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async linkedWorkOrders(@Param("id") id: string) {
    const data = await this.inventoryService.linkedWorkOrders(id);
    return { data, message: "Linked work orders fetched" };
  }

  @Get("parts/:id/purchase-history")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async purchaseHistory(@Param("id") id: string) {
    const data = await this.inventoryService.purchaseHistoryForPart(id);
    return { data, message: "Part purchase history fetched" };
  }

  @Get("analytics/usage")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async usageTrend(@Query("days") days?: string) {
    const safeDays = Number.isFinite(Number(days)) ? Number(days) : 30;
    const data = await this.inventoryService.usageTrend(safeDays);
    return { data, message: "Inventory usage trend fetched" };
  }

  @Get("analytics/top-used")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async topUsed(@Query("days") days?: string, @Query("limit") limit?: string) {
    const safeDays = Number.isFinite(Number(days)) ? Number(days) : 30;
    const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 5;
    const data = await this.inventoryService.topUsedParts(safeLimit, safeDays);
    return { data, message: "Top used parts fetched" };
  }

  @Get("low-stock")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async lowStock() {
    const data = await this.inventoryService.lowStock();
    return { data, message: "Low stock fetched" };
  }

  @Get("purchase-orders")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async purchaseOrders() {
    const data = await this.inventoryService.purchaseOrders();
    return { data, message: "Purchase orders fetched" };
  }

  @Post("purchase-orders")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async createPurchaseOrder(@Body() body: { poNumber: string; supplierId: string; orderDate: string; expectedDate?: string; totalAmount: number; notes?: string }) {
    const data = await this.inventoryService.createPurchaseOrder(body);
    return { data, message: "Purchase order created" };
  }

  @Patch("purchase-orders/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async updatePurchaseOrder(@Param("id") id: string, @Body() body: Partial<{ status: "PENDING" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED"; receivedDate: string; notes: string }>) {
    const data = await this.inventoryService.updatePurchaseOrder(id, body);
    return { data, message: "Purchase order updated" };
  }
}
