import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { BileetaInventoryErpAdapter } from "./bileeta-inventory-erp.adapter";
import {
  buildDryRunResult,
  compareStockBalances,
  ErpStockSyncApplyResult,
  ErpStockSyncDryRunResult,
  ErpStockSyncReadiness
} from "./erp-stock-sync.mapper";

type Actor = Pick<JwtPayload, "sub" | "tenantId">;

@Injectable()
export class ErpStockSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bileetaInventoryErpAdapter: BileetaInventoryErpAdapter
  ) {}

  getReadiness(): ErpStockSyncReadiness {
    return this.bileetaInventoryErpAdapter.checkReadiness();
  }

  async dryRunStockSync(actor?: Actor): Promise<ErpStockSyncDryRunResult> {
    const readiness = this.getReadiness();
    const applyEnabled = readiness.applyEnabled;

    if (readiness.state === "disabled") {
      return buildDryRunResult({
        mode: readiness.mode,
        status: "blocked",
        comparison: compareStockBalances({ erpBalances: [], maintainProParts: [] }),
        applyEnabled,
        message: readiness.message
      });
    }

    if (readiness.state === "not_configured" || readiness.state === "misconfigured") {
      return buildDryRunResult({
        mode: readiness.mode,
        status: readiness.state,
        comparison: compareStockBalances({ erpBalances: [], maintainProParts: [] }),
        applyEnabled,
        message: readiness.message
      });
    }

    const fetchResult = await this.bileetaInventoryErpAdapter.fetchStockBalances();
    if (!fetchResult.ok) {
      return buildDryRunResult({
        mode: fetchResult.mode,
        status: "misconfigured",
        comparison: compareStockBalances({ erpBalances: [], maintainProParts: [] }),
        applyEnabled,
        message: fetchResult.message
      });
    }

    const maintainProParts = await this.loadTenantParts(actor);
    const comparison = compareStockBalances({
      erpBalances: fetchResult.balances,
      maintainProParts
    });

    return buildDryRunResult({
      mode: fetchResult.mode,
      status: "completed",
      comparison,
      applyEnabled,
      message: "Stock sync dry-run completed without modifying MaintainPro inventory."
    });
  }

  async applyStockSnapshot(actor?: Actor): Promise<ErpStockSyncApplyResult> {
    const readiness = this.getReadiness();

    if (!readiness.applyEnabled) {
      return {
        mode: readiness.mode,
        status: "blocked",
        appliedAt: new Date().toISOString(),
        updatedCount: 0,
        skippedCount: 0,
        warnings: [],
        message: "Local stock apply is disabled. Set ERP_STOCK_SYNC_APPLY_ENABLED=true."
      };
    }

    const dryRun = await this.dryRunStockSync(actor);
    if (dryRun.status !== "completed") {
      return {
        mode: dryRun.mode,
        status: "blocked",
        appliedAt: new Date().toISOString(),
        updatedCount: 0,
        skippedCount: 0,
        warnings: dryRun.warnings,
        message: dryRun.message
      };
    }

    if (dryRun.summary.changedItems === 0) {
      return {
        mode: dryRun.mode,
        status: "completed",
        appliedAt: new Date().toISOString(),
        updatedCount: 0,
        skippedCount: 0,
        warnings: dryRun.warnings,
        message: "No quantity changes detected; local inventory was not modified."
      };
    }

    const comparison = await this.buildStockComparison(actor);
    if (!comparison) {
      return {
        mode: dryRun.mode,
        status: "blocked",
        appliedAt: new Date().toISOString(),
        updatedCount: 0,
        skippedCount: 0,
        warnings: dryRun.warnings,
        message: "Could not rebuild ERP stock comparison for apply."
      };
    }

    const tenantId = this.resolveTenantId(actor);
    let updatedCount = 0;

    for (const row of comparison.changedRows) {
      const part = await this.prisma.sparePart.findFirst({
        where: {
          id: row.partId,
          ...(tenantId !== undefined ? { tenantId } : {})
        },
        select: { id: true, quantityInStock: true }
      });

      if (!part) {
        continue;
      }

      await this.prisma.$transaction([
        this.prisma.sparePart.update({
          where: { id: part.id },
          data: { quantityInStock: row.erpQuantity }
        }),
        this.prisma.stockMovement.create({
          data: {
            partId: part.id,
            type: "ADJUSTMENT",
            quantity: Math.abs(row.delta),
            reference: "erp-stock-sync",
            notes: `ERP stock sync apply (${row.partNumber})`
          }
        })
      ]);

      updatedCount += 1;
    }

    return {
      mode: dryRun.mode,
      status: "completed",
      appliedAt: new Date().toISOString(),
      updatedCount,
      skippedCount: dryRun.summary.changedItems - updatedCount,
      warnings: dryRun.warnings,
      message: `Applied ${updatedCount} local stock adjustment(s) from ERP dry-run snapshot.`
    };
  }

  private async buildStockComparison(actor?: Actor) {
    const fetchResult = await this.bileetaInventoryErpAdapter.fetchStockBalances();
    if (!fetchResult.ok) {
      return null;
    }

    const maintainProParts = await this.loadTenantParts(actor);
    return compareStockBalances({
      erpBalances: fetchResult.balances,
      maintainProParts
    });
  }

  private async loadTenantParts(actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    return this.prisma.sparePart.findMany({
      where: {
        isActive: true,
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      select: {
        id: true,
        partNumber: true,
        name: true,
        quantityInStock: true
      },
      orderBy: { partNumber: "asc" }
    });
  }

  private resolveTenantId(actor?: Actor): string | null | undefined {
    if (!actor) {
      return undefined;
    }

    return actor.tenantId ?? null;
  }
}
