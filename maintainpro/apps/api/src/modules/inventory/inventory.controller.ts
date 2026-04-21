import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
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
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async parts() {
    const data = await this.inventoryService.parts();
    return { data, message: "Parts fetched" };
  }

  @Post("parts")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async createPart(@Body() body: { partNumber: string; name: string; category: string; unitCost: number; unit?: string; minimumStock?: number; reorderPoint?: number; quantityInStock?: number; location?: string; supplierId?: string }) {
    const data = await this.inventoryService.createPart(body);
    return { data, message: "Part created" };
  }

  @Get("parts/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async part(@Param("id") id: string) {
    const data = await this.inventoryService.part(id);
    return { data, message: "Part fetched" };
  }

  @Patch("parts/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async updatePart(@Param("id") id: string, @Body() body: Partial<{ name: string; category: string; unitCost: number; minimumStock: number; reorderPoint: number; location: string }>) {
    const data = await this.inventoryService.updatePart(id, body);
    return { data, message: "Part updated" };
  }

  @Post("parts/:id/stock-in")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async stockIn(@Param("id") id: string, @Body() body: { quantity: number; notes?: string }) {
    const data = await this.inventoryService.stockIn(id, body.quantity, body.notes);
    return { data, message: "Stock added" };
  }

  @Post("parts/:id/stock-out")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async stockOut(@Param("id") id: string, @Body() body: { quantity: number; notes?: string }) {
    const data = await this.inventoryService.stockOut(id, body.quantity, body.notes);
    return { data, message: "Stock deducted" };
  }

  @Get("parts/:id/movements")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async movements(@Param("id") id: string) {
    const data = await this.inventoryService.movements(id);
    return { data, message: "Stock movements fetched" };
  }

  @Get("low-stock")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN")
  async lowStock() {
    const data = await this.inventoryService.lowStock();
    return { data, message: "Low stock fetched" };
  }

  @Get("purchase-orders")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async purchaseOrders() {
    const data = await this.inventoryService.purchaseOrders();
    return { data, message: "Purchase orders fetched" };
  }

  @Post("purchase-orders")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async createPurchaseOrder(@Body() body: { poNumber: string; supplierId: string; orderDate: string; expectedDate?: string; totalAmount: number; notes?: string }) {
    const data = await this.inventoryService.createPurchaseOrder(body);
    return { data, message: "Purchase order created" };
  }

  @Patch("purchase-orders/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async updatePurchaseOrder(@Param("id") id: string, @Body() body: Partial<{ status: "PENDING" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED"; receivedDate: string; notes: string }>) {
    const data = await this.inventoryService.updatePurchaseOrder(id, body);
    return { data, message: "Purchase order updated" };
  }
}
