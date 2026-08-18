"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ErrorState, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

import { applyInventoryImport, getInventoryDashboard, listInventoryImports, previewInventoryImport } from "./api";
import { getErrorMessage } from "./helpers";
import { InventorySectionNav } from "./inventory-section-nav";
import { InventoryDashboardKpis } from "./types";

type PreviewRow = {
  rowNumber: number;
  selected: boolean;
  productCode?: string;
  warehouseCode?: string;
  quantity?: number;
  documentStatus?: string;
  status: string;
  errorCode?: string;
  errors?: string[];
};

export default function InventoryImportPage() {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<{ importRunId: string; rows: PreviewRow[]; selectedRows: number; validRows: number } | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["inventory", "dashboard"],
    queryFn: getInventoryDashboard
  });
  const runsQuery = useQuery({
    queryKey: ["inventory", "imports"],
    queryFn: listInventoryImports
  });

  const previewMutation = useMutation({
    mutationFn: (file: File) => previewInventoryImport(file),
    onSuccess: (data) => {
      setPreview(data as never);
      toast.success("Preview complete. Stock was not changed.");
      void queryClient.invalidateQueries({ queryKey: ["inventory", "imports"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const applyMutation = useMutation({
    mutationFn: (id: string) => applyInventoryImport(id),
    onSuccess: () => {
      toast.success("Selected released rows applied.");
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const kpis = dashboardQuery.data as InventoryDashboardKpis | null;

  if (runsQuery.isLoading && !runsQuery.data) {
    return <LoadingState title="Loading imports" description="Fetching ERP / Excel import runs." />;
  }

  if (runsQuery.isError) {
    return (
      <ErrorState
        error={runsQuery.error}
        onRetry={() => void runsQuery.refetch()}
        title="Unable to load imports"
        description={toSafeApiErrorMessage(runsQuery.error, "Unable to load inventory imports.")}
      />
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <PageBreadcrumbs />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">ERP / Excel Import</h1>
        <p className="mt-1 text-sm text-slate-600">
          Yellow-filled cells select the entire row. Upload and preview never mutate stock.
        </p>
      </div>
      <InventorySectionNav />
      {kpis ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pending Imports</p>
            <p className="mt-2 text-2xl font-semibold">{kpis.pendingImports}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Import Errors</p>
            <p className="mt-2 text-2xl font-semibold">{kpis.importErrors}</p>
          </div>
        </div>
      ) : null}

      <label className="block rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">Upload Excel workbook</span>
        <input
          type="file"
          accept=".xlsx,.xlsm,.xls"
          className="mt-3 block"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              previewMutation.mutate(file);
            }
          }}
        />
      </label>

      {preview ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Preview {preview.importRunId} · selected {preview.selectedRows} · valid {preview.validRows}
            </p>
            <button
              type="button"
              disabled={applyMutation.isPending}
              onClick={() => applyMutation.mutate(preview.importRunId)}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              Apply released rows
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Selected</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Warehouse</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.rowNumber}</td>
                    <td className="px-3 py-2">{row.selected ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{row.productCode ?? "—"}</td>
                    <td className="px-3 py-2">{row.warehouseCode ?? "—"}</td>
                    <td className="px-3 py-2">{row.quantity ?? "—"}</td>
                    <td className="px-3 py-2">{row.documentStatus ?? "—"}</td>
                    <td className="px-3 py-2">{row.status}{row.errorCode ? ` (${row.errorCode})` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
