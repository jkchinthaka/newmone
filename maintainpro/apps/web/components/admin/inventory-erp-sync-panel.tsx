"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  canAccessInventoryErpSync,
  formatErpStockSyncSummary,
  inventoryErpSyncPayloadHasSecrets,
  type ErpStockSyncDryRunResult,
  type ErpStockSyncReadiness
} from "@/lib/inventory-erp-sync";
import { useCurrentUser } from "@/lib/use-current-user";

type ApiEnvelope<T> = {
  data: T;
  message?: string;
};

export function InventoryErpSyncPanel() {
  const currentUser = useCurrentUser();
  const canManage = canAccessInventoryErpSync(currentUser?.role);

  const [loading, setLoading] = useState(true);
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [readiness, setReadiness] = useState<ErpStockSyncReadiness | null>(null);
  const [dryRun, setDryRun] = useState<ErpStockSyncDryRunResult | null>(null);

  const loadReadiness = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get<ApiEnvelope<ErpStockSyncReadiness>>("/inventory/erp/readiness");
      setReadiness(response.data.data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load ERP stock sync readiness."));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  if (!canManage) {
    return null;
  }

  const runDryRun = async () => {
    setRunningDryRun(true);
    setDryRun(null);

    try {
      const response = await apiClient.post<ApiEnvelope<ErpStockSyncDryRunResult>>(
        "/inventory/erp/stock-sync/dry-run"
      );
      const result = response.data.data;
      setDryRun(result);
      toast.message(formatErpStockSyncSummary(result));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "ERP stock sync dry-run failed."));
    } finally {
      setRunningDryRun(false);
    }
  };

  return (
    <section
      aria-labelledby="inventory-erp-sync-heading"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
            <Database size={18} aria-hidden="true" />
            <span>Inventory ERP sync</span>
          </div>
          <h2 id="inventory-erp-sync-heading" className="mt-2 text-lg font-semibold text-slate-900">
            Bileeta read-only stock sync
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Compare Bileeta stock balances with MaintainPro inventory using dry-run only. No ERP writes. Local apply
            stays disabled unless ERP_STOCK_SYNC_APPLY_ENABLED is enabled on the server.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReadiness()}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh readiness
        </button>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Loading ERP stock sync readiness…
        </div>
      ) : readiness ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mode</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{readiness.mode}</p>
            <p className="mt-1 text-xs text-slate-600">{readiness.state}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Read sync</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {readiness.readOnlySyncEnabled ? "enabled" : "disabled"}
            </p>
            <p className="mt-1 text-xs text-slate-600">{readiness.message}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Local apply</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {readiness.applyEnabled ? "enabled" : "disabled"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {readiness.missingKeys.length > 0
                ? `Missing: ${readiness.missingKeys.join(", ")}`
                : "Apply remains server-guarded and off by default."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={runningDryRun}
          onClick={() => void runDryRun()}
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningDryRun ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Run dry-run sync
        </button>
      </div>

      {dryRun ? (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Dry-run summary</p>
          <p className="mt-2">{formatErpStockSyncSummary(dryRun)}</p>
          <p className="mt-1 text-xs text-slate-600">{dryRun.message}</p>
          {dryRun.warnings.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800">
              {dryRun.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {inventoryErpSyncPayloadHasSecrets(dryRun) ? (
            <p className="mt-3 text-xs font-medium text-red-700">Unexpected secret-like fields detected in response.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
