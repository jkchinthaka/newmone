import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { InventoryService } from "./inventory.service";
import { ErpStockSyncService } from "./erp-stock-sync.service";
import { InventoryExcelImportService } from "./inventory-excel-import.service";
import { InventoryDailyService } from "./inventory-daily.service";
import { ErpExcelImportService } from "./erp-excel-import.service";
import { ERP_EXCEL_MAX_BYTES } from "./erp-excel-stock.parser";
import {
  ApprovePurchaseOrderDto,
  CreatePurchaseOrderDto,
  CreatePurchaseReceiptDto,
  RejectPurchaseOrderDto,
  RetryPurchaseOrderSyncDto,
  SyncPurchaseOrderDto
} from "./dto/purchase-order.dto";

type AuthedRequest = {
  user: JwtPayload;
};

/** Option A: inventory.manage remains the read+master permission; keeper is on read roles only. */
const INVENTORY_READ_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "ASSET_MANAGER",
  "MECHANIC",
  "INVENTORY_KEEPER",
  "MANAGER",
  "OPERATIONS_MANAGER"
] as const;

@ApiTags("Inventory")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("inventory")
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly erpStockSyncService: ErpStockSyncService,
    private readonly excelImportService: InventoryExcelImportService,
    private readonly dailyService: InventoryDailyService,
    private readonly erpExcelImportService: ErpExcelImportService
  ) {}

  @Get("parts")
  @Roles(...INVENTORY_READ_ROLES)
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
  @Roles(...INVENTORY_READ_ROLES)
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
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: "Stock deducted against a tenant-scoped work order" })
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("inventory.stock_issue")
  async stockOut(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body()
    body: {
      quantity: number;
      workOrderId: string;
      notes?: string;
      overrideReason?: string;
      idempotencyKey?: string;
    }
  ) {
    const idempotencyKey = (body.idempotencyKey || idempotencyHeader || "").trim() || undefined;
    const data = await this.inventoryService.stockOut(
      id,
      body.quantity,
      {
        workOrderId: body.workOrderId,
        notes: body.notes,
        overrideReason: body.overrideReason,
        idempotencyKey
      },
      req.user
    );
    return { data, message: "Stock deducted" };
  }

  @Get("parts/:id/movements")
  @Roles(...INVENTORY_READ_ROLES)
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
  @Roles(...INVENTORY_READ_ROLES)
  @Permissions("inventory.manage")
  async lowStock(@Req() req: AuthedRequest) {
    const data = await this.inventoryService.lowStock(req.user);
    return { data, message: "Low stock fetched" };
  }

  @Get("purchase-orders")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "ASSET_MANAGER",
    "INVENTORY_KEEPER",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "PROCUREMENT_OFFICER",
    "FINANCE"
  )
  @Permissions("purchase_orders.view")
  async purchaseOrders(@Req() req: AuthedRequest) {
    const data = await this.inventoryService.purchaseOrders(req.user);
    return { data, message: "Purchase orders fetched" };
  }

  @Get("purchase-orders/:id")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "ASSET_MANAGER",
    "INVENTORY_KEEPER",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "PROCUREMENT_OFFICER",
    "FINANCE"
  )
  @Permissions("purchase_orders.view")
  async purchaseOrder(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.inventoryService.getPurchaseOrder(id, req.user);
    return { data, message: "Purchase order fetched" };
  }

  @Post("purchase-orders")
  @HttpCode(HttpStatus.CREATED)
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "PROCUREMENT_OFFICER")
  @Permissions("purchase_orders.create")
  async createPurchaseOrder(@Req() req: AuthedRequest, @Body() body: CreatePurchaseOrderDto) {
    const data = await this.inventoryService.createPurchaseOrder(body, req.user);
    return { data, message: "Purchase order created" };
  }

  @Patch("purchase-orders/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "PROCUREMENT_OFFICER")
  @Permissions("purchase_orders.create")
  async updatePurchaseOrder(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Partial<{ status: "PENDING" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED"; receivedDate: string; notes: string }>
  ) {
    const data = await this.inventoryService.updatePurchaseOrder(id, body, req.user);
    return { data, message: "Purchase order updated" };
  }

  @Patch("purchase-orders/:id/approve-operational")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "OPERATIONS_MANAGER")
  @Permissions("purchase_orders.approve_operational")
  async approvePurchaseOrderOperational(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: ApprovePurchaseOrderDto
  ) {
    const data = await this.inventoryService.approvePurchaseOrderOperational(id, body, req.user);
    return { data, message: "Purchase order operationally approved" };
  }

  @Patch("purchase-orders/:id/approve-finance")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FINANCE")
  @Permissions("purchase_orders.approve_finance")
  async approvePurchaseOrderFinance(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: ApprovePurchaseOrderDto
  ) {
    const data = await this.inventoryService.approvePurchaseOrderFinance(id, body, req.user);
    return { data, message: "Purchase order finance approved" };
  }

  @Patch("purchase-orders/:id/reject")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "OPERATIONS_MANAGER")
  @Permissions("purchase_orders.reject")
  async rejectPurchaseOrder(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: RejectPurchaseOrderDto
  ) {
    const data = await this.inventoryService.rejectPurchaseOrder(id, body, req.user);
    return { data, message: "Purchase order rejected" };
  }

  @Get("purchase-orders/:id/receipts")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "ASSET_MANAGER",
    "INVENTORY_KEEPER",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "PROCUREMENT_OFFICER",
    "FINANCE"
  )
  @Permissions("purchase_orders.view")
  async listPurchaseReceipts(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.inventoryService.listPurchaseReceipts(id, req.user);
    return { data, message: "Purchase receipts fetched" };
  }

  @Post("purchase-orders/:id/receipts")
  @HttpCode(HttpStatus.CREATED)
  @Roles("SUPER_ADMIN", "ADMIN", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("purchase_orders.receive")
  async createPurchaseReceipt(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: CreatePurchaseReceiptDto
  ) {
    const data = await this.inventoryService.createPurchaseReceipt(id, body, req.user);
    return { data, message: "Purchase receipt created" };
  }

  @Post("purchase-orders/:id/erp-sync")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("purchase_orders.erp_sync")
  async syncPurchaseOrderToErp(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: SyncPurchaseOrderDto
  ) {
    const data = await this.inventoryService.syncPurchaseOrderToErp(id, body, req.user);
    return { data, message: "Manual ERP sync executed" };
  }

  @Post("purchase-orders/:id/erp-sync/retry")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("purchase_orders.erp_sync_retry")
  async retryPurchaseOrderErpSync(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: RetryPurchaseOrderSyncDto
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
  @Permissions("inventory.erp_dry_run")
  async dryRunErpStockSync(@Req() req: AuthedRequest) {
    const data = await this.erpStockSyncService.dryRunStockSync(req.user);
    return { data, message: "ERP stock sync dry-run completed" };
  }

  @Post("erp/stock-sync/apply")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("inventory.erp_apply")
  async applyErpStockSync(
    @Req() req: AuthedRequest,
    @Body()
    body?: {
      erpBalances?: Array<{
        partSku: string;
        quantityOnHand: number;
        warehouseCode?: string | null;
      }>;
    }
  ) {
    const data = await this.erpStockSyncService.applyStockSnapshot(req.user, {
      erpBalances: body?.erpBalances
    });
    return { data, message: "ERP stock sync apply completed" };
  }

  @Get("dashboard")
  @Roles(...INVENTORY_READ_ROLES)
  @Permissions("inventory.manage")
  async dashboard(@Req() req: AuthedRequest) {
    const data = await this.inventoryService.dashboard(req.user);
    return { data, message: "Inventory dashboard fetched" };
  }

  @Get("warehouses")
  @Roles(...INVENTORY_READ_ROLES)
  @Permissions("inventory.manage")
  async warehouses(@Req() req: AuthedRequest) {
    const data = await this.inventoryService.listWarehouses(req.user);
    return { data, message: "Warehouses fetched" };
  }

  @Get("warehouse-balances")
  @Roles(...INVENTORY_READ_ROLES)
  @Permissions("inventory.manage")
  async warehouseBalances(
    @Req() req: AuthedRequest,
    @Query("warehouseId") warehouseId?: string,
    @Query("partId") partId?: string,
    @Query("nonZeroOnly") nonZeroOnly?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const data = await this.inventoryService.listWarehouseBalances(req.user, {
      warehouseId,
      partId,
      nonZeroOnly,
      page,
      limit
    });
    return { data: data.items, meta: data.meta, message: "Warehouse balances fetched" };
  }

  @Get("movements")
  @Roles(...INVENTORY_READ_ROLES)
  @Permissions("inventory.manage")
  async allMovements(
    @Req() req: AuthedRequest,
    @Query("type") type?: string,
    @Query("warehouseId") warehouseId?: string,
    @Query("partId") partId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("take") take?: string
  ) {
    const data = await this.inventoryService.listAllMovements(req.user, {
      type,
      warehouseId,
      partId,
      from,
      to,
      take: take ? Number(take) : undefined
    });
    return { data, message: "Stock movements fetched" };
  }

  @Get("daily")
  @Roles(...INVENTORY_READ_ROLES)
  @Permissions("inventory.manage")
  async daily(
    @Req() req: AuthedRequest,
    @Query("preset") preset?: "today" | "yesterday" | "last_7_days" | "this_month" | "custom",
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("warehouseId") warehouseId?: string,
    @Query("partId") partId?: string,
    @Query("category") category?: string
  ) {
    const data = await this.dailyService.report({ preset, from, to, warehouseId, partId, category }, req.user);
    return { data, message: "Daily inventory fetched" };
  }

  @Post("transfers")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("inventory.manage")
  async transfer(
    @Req() req: AuthedRequest,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body()
    body: {
      partId: string;
      quantity: number;
      sourceWarehouseId?: string;
      destWarehouseId?: string;
      notes?: string;
      idempotencyKey?: string;
    }
  ) {
    const data = await this.inventoryService.transferStock(
      { ...body, idempotencyKey: body.idempotencyKey || idempotencyHeader },
      req.user
    );
    return { data, message: "Transfer completed" };
  }

  @Post("adjustments")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("inventory.manage")
  async adjust(
    @Req() req: AuthedRequest,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body() body: { partId: string; quantity: number; direction: "IN" | "OUT"; reason: string; warehouseId?: string; idempotencyKey?: string }
  ) {
    const data = await this.inventoryService.adjustStock(
      { ...body, idempotencyKey: body.idempotencyKey || idempotencyHeader },
      req.user
    );
    return { data, message: "Adjustment recorded" };
  }

  @Post("reversals")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("inventory.manage")
  async reverse(
    @Req() req: AuthedRequest,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body() body: { movementId: string; quantity?: number; reason: string; idempotencyKey?: string }
  ) {
    const data = await this.inventoryService.reverseMovement(
      { ...body, idempotencyKey: body.idempotencyKey || idempotencyHeader },
      req.user
    );
    return { data, message: "Reversal recorded" };
  }

  @Get("imports")
  @Roles(...INVENTORY_READ_ROLES)
  @Permissions("inventory.erp_dry_run")
  async listImports(@Req() req: AuthedRequest) {
    const data = await this.excelImportService.listRuns(req.user);
    return { data, message: "Inventory import runs fetched" };
  }

  @Get("imports/:id")
  @Roles(...INVENTORY_READ_ROLES)
  @Permissions("inventory.erp_dry_run")
  async getImport(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.excelImportService.getRun(id, req.user);
    return { data, message: "Inventory import run fetched" };
  }

  @Post("imports/preview")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "INVENTORY_KEEPER", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("inventory.erp_dry_run")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  async previewImport(@Req() req: AuthedRequest, @UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException("Excel file is required");
    }
    const data = await this.excelImportService.preview(file.buffer, file.originalname, req.user);
    return { data, message: "Inventory import preview completed without stock mutation" };
  }

  @Post("imports/:id/apply")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("inventory.erp_apply")
  async applyImport(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.excelImportService.apply(id, req.user);
    return { data, message: "Inventory import applied" };
  }

  @Patch("imports/:id/rows/:rowId/map")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("inventory.erp_apply")
  async mapImportRow(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("rowId") rowId: string,
    @Body() body: { partId?: string; warehouseId?: string }
  ) {
    const data = await this.excelImportService.mapRow(id, rowId, body, req.user);
    return { data, message: "Import row mapping saved" };
  }

  @Post("erp-import/upload")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER")
  @Permissions("inventory.erp_import.upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: ERP_EXCEL_MAX_BYTES }
    })
  )
  async uploadErpExcelImport(@Req() req: AuthedRequest, @UploadedFile() file: Express.Multer.File) {
    const data = await this.erpExcelImportService.upload(file, req.user);
    return { data, message: data.reused ? "Existing ERP Excel import recovered" : "ERP Excel uploaded" };
  }

  @Get("erp-import/history")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER")
  @Permissions("inventory.erp_import.history")
  async erpExcelImportHistory(@Req() req: AuthedRequest, @Query("take") take?: string) {
    const data = await this.erpExcelImportService.history(req.user, take ? Number(take) : 50);
    return { data, message: "ERP Excel import history" };
  }

  @Get("erp-import/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER")
  @Permissions("inventory.erp_import.view")
  async getErpExcelImport(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.erpExcelImportService.getRun(id, req.user);
    return { data, message: "ERP Excel import run" };
  }

  @Post("erp-import/:id/validate")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER")
  @Permissions("inventory.erp_import.upload")
  async validateErpExcelImport(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      sheetName?: string;
      mapping: {
        itemCode: string;
        quantity: string;
        itemName?: string | null;
        warehouse?: string | null;
        uom?: string | null;
        businessDate?: string | null;
      };
      warehouseScope?: string | null;
      businessDate?: string | null;
      confirmMultiWarehouseAggregate?: boolean;
    }
  ) {
    const data = await this.erpExcelImportService.validate(id, body, req.user);
    return { data, message: "ERP Excel import validated" };
  }

  @Post("erp-import/:id/apply")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "INVENTORY_KEEPER")
  @Permissions("inventory.erp_import.apply")
  async applyErpExcelImport(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { confirmed?: boolean }
  ) {
    const data = await this.erpExcelImportService.apply(
      id,
      { confirmed: Boolean(body?.confirmed) },
      req.user
    );
    return { data, message: data.message };
  }
}
