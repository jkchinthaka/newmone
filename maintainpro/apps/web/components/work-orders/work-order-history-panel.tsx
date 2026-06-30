"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, History, Loader2 } from "lucide-react";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";

export type WorkOrderHistoryContext = {
  workOrderId: string;
  hasLinkedTarget: boolean;
  message?: string;
  assetSummary: Record<string, unknown> | null;
  vehicleSummary: Record<string, unknown> | null;
  lastService: Record<string, unknown> | null;
  previousMaintenance: Array<Record<string, unknown>>;
  previousBreakdowns: Array<Record<string, unknown>>;
  previousPartsUsed: Array<Record<string, unknown>>;
  costSummary: {
    totalActualCost: number;
    totalEstimatedCost: number;
    completedJobCount: number;
  };
  meterHistory: Array<Record<string, unknown>>;
  complianceWarnings: Array<Record<string, unknown>>;
  repeatIssueWarnings: Array<{ kind: string; label: string; count: number; windowDays: number }>;
  readOnly: true;
  dataSources: string[];
};

type Props = {
  workOrderId: string;
  compact?: boolean;
};

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  return new Date(value).toLocaleDateString();
}

function formatMoney(value: unknown) {
  if (typeof value !== "number") return "—";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function WorkOrderHistoryPanel({ workOrderId, compact = false }: Props) {
  const query = useQuery({
    queryKey: ["work-orders", workOrderId, "history"],
    queryFn: async () => {
      const response = await apiClient.get<{ data: WorkOrderHistoryContext }>(`/work-orders/${workOrderId}/history`);
      return response.data.data;
    }
  });

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
        <div className="inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Loading previous maintenance history…
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {getApiErrorMessage(query.error, "Could not load maintenance history for this work order.")}
      </section>
    );
  }

  const data = query.data;
  if (!data) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-2">
        <History className="mt-0.5 h-4 w-4 text-brand-700" aria-hidden />
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Previous maintenance history</h4>
          <p className="mt-1 text-xs text-slate-500">
            Read-only historical context from completed work orders, maintenance logs, and linked asset/vehicle records.
            Legacy FMS archive data is not copied into current work orders.
          </p>
        </div>
      </div>

      {data.message ? <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{data.message}</p> : null}

      {data.repeatIssueWarnings.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Repeated issue detected for this asset/vehicle.</p>
              <ul className="mt-1 list-disc pl-4 text-xs">
                {data.repeatIssueWarnings.map((warning) => (
                  <li key={`${warning.kind}-${warning.label}`}>{warning.label}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {!compact && (data.assetSummary || data.vehicleSummary) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.assetSummary ? (
            <article className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <h5 className="font-medium text-slate-900">Asset</h5>
              <p className="mt-1 text-slate-700">
                {String(data.assetSummary.assetTag ?? "")} · {String(data.assetSummary.name ?? "")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Last service: {formatDate(data.assetSummary.lastServiceDate)} · Meter:{" "}
                {String(data.assetSummary.meterReading ?? "—")}
              </p>
            </article>
          ) : null}
          {data.vehicleSummary ? (
            <article className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <h5 className="font-medium text-slate-900">Vehicle</h5>
              <p className="mt-1 text-slate-700">
                {String(data.vehicleSummary.registrationNo ?? "")} · {String(data.vehicleSummary.vehicleModel ?? "")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Mileage: {String(data.vehicleSummary.currentMileage ?? "—")} · Service status:{" "}
                {String(data.vehicleSummary.serviceStatus ?? "—")}
              </p>
            </article>
          ) : null}
        </div>
      ) : null}

      {data.lastService ? (
        <article className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <h5 className="font-medium text-slate-900">Last service</h5>
          <p className="mt-1 text-slate-700">{String(data.lastService.description ?? "Service record")}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(data.lastService.performedAt)}
            {data.lastService.performedBy ? ` · ${String(data.lastService.performedBy)}` : ""}
            {typeof data.lastService.cost === "number" ? ` · ${formatMoney(data.lastService.cost)}` : ""}
          </p>
        </article>
      ) : null}

      <HistoryTable
        title="Previous maintenance"
        empty="No preventive or inspection history."
        rows={data.previousMaintenance.map((row) => ({
          key: String(row.id),
          primary: String(row.woNumber ?? row.title),
          secondary: `${String(row.type ?? "").replaceAll("_", " ")} · ${formatDate(row.completedDate)}`,
          meta: row.technicianName ? String(row.technicianName) : undefined
        }))}
      />

      <HistoryTable
        title="Previous breakdowns"
        empty="No breakdown or emergency history."
        rows={data.previousBreakdowns.map((row) => ({
          key: String(row.id),
          primary: String(row.title),
          secondary: `${String(row.type ?? "").replaceAll("_", " ")} · ${formatDate(row.completedDate)}`,
          meta: typeof row.actualCost === "number" ? formatMoney(row.actualCost) : undefined
        }))}
      />

      {!compact ? (
        <>
          <HistoryTable
            title="Previous spare parts used"
            empty="No spare parts linked to prior work orders."
            rows={data.previousPartsUsed.slice(0, 12).map((row) => ({
              key: `${row.workOrderId}-${row.partId}`,
              primary: String(row.partName ?? row.partNumber),
              secondary: `WO ${String(row.woNumber ?? "")} · Qty ${String(row.quantity ?? "")}`,
              meta: typeof row.totalCost === "number" ? formatMoney(row.totalCost) : undefined
            }))}
          />

          <article className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <h5 className="font-medium text-slate-900">Cost summary (prior jobs)</h5>
            <p className="mt-1 text-slate-700">
              Completed jobs: {data.costSummary.completedJobCount} · Actual total:{" "}
              {formatMoney(data.costSummary.totalActualCost)}
            </p>
          </article>

          {data.complianceWarnings.length > 0 ? (
            <HistoryTable
              title="Compliance warnings"
              empty=""
              rows={data.complianceWarnings.map((row) => ({
                key: String(row.id),
                primary: String(row.documentType ?? "Document"),
                secondary: String(row.message ?? "Check document"),
                meta: formatDate(row.expiryDate)
              }))}
            />
          ) : null}

          {data.meterHistory.length > 0 ? (
            <HistoryTable
              title="Meter / mileage history"
              empty=""
              rows={data.meterHistory.map((row) => ({
                key: String(row.id),
                primary: String(row.reading ?? "—"),
                secondary: String(row.readingType ?? "Reading"),
                meta: formatDate(row.recordedAt)
              }))}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function HistoryTable({
  title,
  empty,
  rows
}: {
  title: string;
  empty: string;
  rows: Array<{ key: string; primary: string; secondary: string; meta?: string }>;
}) {
  if (rows.length === 0) {
    return empty ? <p className="text-sm text-slate-500">{empty}</p> : null;
  }

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <h5 className="border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">{title}</h5>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{row.primary}</p>
              <p className="truncate text-xs text-slate-500">{row.secondary}</p>
            </div>
            {row.meta ? <span className="shrink-0 text-xs text-slate-500">{row.meta}</span> : null}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function useWorkOrderHistorySummary(workOrderId?: string) {
  return useQuery({
    queryKey: ["work-orders", workOrderId, "history", "summary"],
    enabled: Boolean(workOrderId),
    queryFn: async () => {
      const response = await apiClient.get<{ data: WorkOrderHistoryContext }>(`/work-orders/${workOrderId}/history`);
      return response.data.data;
    },
    staleTime: 60_000
  });
}
