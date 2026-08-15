import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { BileetaInventoryErpAdapter } from "./bileeta-inventory-erp.adapter";
import type { StockBalanceSnapshot } from "./inventory-erp-adapter.service";
import {
  buildDryRunResult,
  compareStockBalances,
  ErpStockSyncApplyResult,
  ErpStockSyncDryRunResult,
  ErpStockSyncReadiness
} from "./erp-stock-sync.mapper";

type Actor = Pick<JwtPayload, "sub" | "tenantId">;

export type ApplyStockSnapshotOptions = {
  /**
   * Normalized ERP balances from a prior dry-run in the same request flow.
   * When provided, apply does not refetch ERP (avoids snapshot drift).
   */
  erpBalances?: StockBalanceSnapshot[];
};

@Injectable()
export class ErpStockSyncService {
  /** In-process per-tenant apply mutex (same Node process only). */
  private readonly applyLocks = new Map<string, Promise<void>>();

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
      message: "Stock sync dry-run completed without modifying MaintainPro inventory.",
      erpBalances: fetchResult.balances
    });
  }

  async applyStockSnapshot(
    actor?: Actor,
    options?: ApplyStockSnapshotOptions
  ): Promise<ErpStockSyncApplyResult> {
    const lockKey = `tenant:${actor?.tenantId ?? "none"}`;
    return this.withApplyLock(lockKey, () => this.runApplyStockSnapshot(actor, options));
  }

  private async runApplyStockSnapshot(
    actor?: Actor,
    options?: ApplyStockSnapshotOptions
  ): Promise<ErpStockSyncApplyResult> {
    const readiness = this.getReadiness();
    const emptyFailure = (mode: string, status: ErpStockSyncApplyResult["status"], message: string) => ({
      mode,
      status,
      appliedAt: new Date().toISOString(),
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failedPartNumbers: [] as string[],
      warnings: [] as string[],
      message,
      snapshotBalanceCount: 0
    });

    if (!readiness.applyEnabled) {
      return emptyFailure(
        readiness.mode,
        "blocked",
        "Local stock apply is disabled. Set ERP_STOCK_SYNC_APPLY_ENABLED=true."
      );
    }

    if (readiness.state === "disabled" || readiness.state === "not_configured" || readiness.state === "misconfigured") {
      return emptyFailure(readiness.mode, "blocked", readiness.message);
    }

    let mode = readiness.mode;
    let erpBalances: StockBalanceSnapshot[];

    if (options?.erpBalances && options.erpBalances.length > 0) {
      // Preserve caller-supplied snapshot (dry-run → apply) — no ERP refetch.
      erpBalances = options.erpBalances;
    } else {
      const fetchResult = await this.bileetaInventoryErpAdapter.fetchStockBalances();
      if (!fetchResult.ok) {
        return emptyFailure(fetchResult.mode, "blocked", fetchResult.message);
      }
      mode = fetchResult.mode;
      erpBalances = fetchResult.balances;
    }

    const maintainProParts = await this.loadTenantParts(actor);
    const comparison = compareStockBalances({
      erpBalances,
      maintainProParts
    });
    const checkedAt = new Date().toISOString();

    if (comparison.summary.changedItems === 0) {
      return {
        mode,
        status: "completed",
        appliedAt: checkedAt,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        failedPartNumbers: [],
        warnings: comparison.warnings,
        message: "No quantity changes detected; local inventory was not modified.",
        snapshotBalanceCount: erpBalances.length
      };
    }

    const tenantId = this.resolveTenantId(actor);
    const syncRunId = `erp-stock-sync:${checkedAt}`;
    let updatedCount = 0;
    let skippedCount = 0;
    const failedPartNumbers: string[] = [];

    for (const row of comparison.changedRows) {
      try {
        const part = await this.prisma.sparePart.findFirst({
          where: {
            id: row.partId,
            ...(tenantId !== undefined ? { tenantId } : {})
          },
          select: { id: true, quantityInStock: true }
        });

        if (!part) {
          skippedCount += 1;
          continue;
        }

        // Absolute ERP balance target (never += erpQuantity).
        if (part.quantityInStock === row.erpQuantity) {
          skippedCount += 1;
          continue;
        }

        const priorQuantity = part.quantityInStock;

        await this.prisma.$transaction([
          this.prisma.sparePart.update({
            where: { id: part.id },
            data: { quantityInStock: row.erpQuantity }
          }),
          this.prisma.stockMovement.create({
            data: {
              partId: part.id,
              type: "ADJUSTMENT",
              quantity: Math.abs(row.erpQuantity - priorQuantity),
              reference: syncRunId,
              notes: `ERP stock sync apply (${row.partNumber}) target=${row.erpQuantity}`
            }
          })
        ]);

        updatedCount += 1;
      } catch {
        failedPartNumbers.push(row.partNumber);
      }
    }

    const failedCount = failedPartNumbers.length;
    const status = failedCount > 0 ? "partial" : "completed";
    const message =
      failedCount > 0
        ? `Partial ERP stock apply: updated=${updatedCount}, skipped=${skippedCount}, failed=${failedCount}.`
        : `Applied ${updatedCount} local stock adjustment(s) from ERP stock snapshot.`;

    return {
      mode,
      status,
      appliedAt: new Date().toISOString(),
      updatedCount,
      skippedCount,
      failedCount,
      failedPartNumbers,
      warnings: comparison.warnings,
      message,
      snapshotBalanceCount: erpBalances.length
    };
  }

  private async withApplyLock<T>(lockKey: string, work: () => Promise<T>): Promise<T> {
    const previous = this.applyLocks.get(lockKey) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.applyLocks.set(lockKey, tail);

    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.applyLocks.get(lockKey) === tail) {
        this.applyLocks.delete(lockKey);
      }
    }
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
