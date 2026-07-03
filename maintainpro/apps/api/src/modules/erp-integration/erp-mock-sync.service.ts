import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { AuditAction, ErpIntegrationSyncMode, Prisma, RoleName } from "@prisma/client";
import { ConfigService } from "@nestjs/config";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { createErpConnector, resolveErpSyncMode } from "./connectors/erp-connectors";
import type { MockSyncDto } from "./dto/erp.dto";

@Injectable()
export class ErpMockSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private ctx() {
    const c = requestContext.get();
    return { actorId: c?.actorId, actorRole: c?.actorRole, permissions: c?.permissions ?? [], tenantId: c?.tenantId };
  }

  canManage() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("erp.manage");
  }

  private tenantId(): string | null {
    return this.ctx().tenantId ?? null;
  }

  async getStatus() {
    const mode = resolveErpSyncMode(this.configService);
    const lastRun = await this.prisma.erpMockSyncRun.findFirst({
      where: this.tenantId() ? { tenantId: this.tenantId()! } : {},
      orderBy: { createdAt: "desc" }
    });
    return {
      mode,
      mockSyncAllowed: mode === "mock",
      lastMockSync: lastRun,
      message: mode === "mock" ? "Mock sync uses local sample data only" : "Enable ERP_SYNC_MODE=mock to run mock sync"
    };
  }

  async runMockSync(dto: MockSyncDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to run ERP mock sync");
    const mode = resolveErpSyncMode(this.configService);
    if (mode !== "mock") {
      throw new BadRequestException("Mock sync is only available when ERP_SYNC_MODE=mock");
    }

    const connector = createErpConnector(this.configService);
    const entityTypes = dto.entityTypes?.length
      ? dto.entityTypes
      : ["employees", "vendors", "items", "stockBalances", "assets", "vehicles", "purchaseOrders", "invoices"];

    await writeAuditTrail(this.prisma, {
      entity: "ErpMockSyncRun",
      entityId: "pending",
      action: AuditAction.CREATE,
      module: "erp-integration",
      metadata: { event: "erp_mock_sync_started", entityTypes } as Prisma.InputJsonValue
    });

    const fetches: Record<string, unknown> = {};
    let total = 0;
    for (const type of entityTypes) {
      switch (type) {
        case "employees":
          fetches.employees = await connector.fetchEmployees();
          total += (fetches.employees as { count: number }).count;
          break;
        case "vendors":
          fetches.vendors = await connector.fetchVendors();
          total += (fetches.vendors as { count: number }).count;
          break;
        case "items":
          fetches.items = await connector.fetchItems();
          total += (fetches.items as { count: number }).count;
          break;
        case "stockBalances":
          fetches.stockBalances = await connector.fetchStockBalances();
          total += (fetches.stockBalances as { count: number }).count;
          break;
        case "assets":
          fetches.assets = await connector.fetchAssets();
          total += (fetches.assets as { count: number }).count;
          break;
        case "vehicles":
          fetches.vehicles = await connector.fetchVehicles();
          total += (fetches.vehicles as { count: number }).count;
          break;
        case "purchaseOrders":
          fetches.purchaseOrders = await connector.fetchPurchaseOrders();
          total += (fetches.purchaseOrders as { count: number }).count;
          break;
        case "invoices":
          fetches.invoices = await connector.fetchInvoices();
          total += (fetches.invoices as { count: number }).count;
          break;
        default:
          break;
      }
    }

    const run = await this.prisma.erpMockSyncRun.create({
      data: {
        tenantId: this.tenantId(),
        syncMode: ErpIntegrationSyncMode.MOCK,
        entityTypes: entityTypes as Prisma.InputJsonValue,
        recordsFetched: total,
        summary: fetches as Prisma.InputJsonValue,
        startedByUserId: this.ctx().actorId ?? undefined,
        completedAt: new Date()
      }
    });

    await writeAuditTrail(this.prisma, {
      entity: "ErpMockSyncRun",
      entityId: run.id,
      action: AuditAction.UPDATE,
      module: "erp-integration",
      metadata: { event: "erp_mock_sync_completed", recordsFetched: total } as Prisma.InputJsonValue
    });

    return { run, fetches, readOnly: true, productionDataModified: false };
  }
}
