"use client";

import { formatEnumLabel } from "@/lib/display-labels";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, History } from "lucide-react";

import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/dashboard";
import { apiClient, getApiErrorMessageForRoute } from "@/lib/api-client";
import { formatCalendarDate } from "@/lib/colombo-datetime";
import { formatCurrency } from "@/lib/localization";
import { formatDrawerDateTime } from "@/lib/work-order-drawer-display";

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
  if (value.includes("T")) return formatDrawerDateTime(value) || "—";
  return formatCalendarDate(value.slice(0, 10)) || formatDrawerDateTime(value) || "—";
}

function formatMoney(value: unknown) {
  // Business currency is LKR. Decimal costs can arrive as numeric strings.
  if (typeof value !== "number" && typeof value !== "string") return "—";
  return formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
      <section className="space-y-2">
        <p className="sr-only">Loading previous maintenance history…</p>
        <SkeletonCard />
      </section>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        message={getApiErrorMessageForRoute(
          query.error,
          "work-order-history",
          "Could not load maintenance history for this job."
        )}
        onRetry={() => void query.refetch()}
      />
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
            Read-only historical context from completed jobs, maintenance logs, and linked asset/vehicle records.
            Legacy FMS archive data is not copied into current jobs.
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
          secondary: `${formatEnumLabel(String(row.type ?? ""), "")} · ${formatDate(row.completedDate)}`,
          meta: row.technicianName ? String(row.technicianName) : undefined
        }))}
      />

      <HistoryTable
        title="Previous breakdowns"
        empty="No breakdown or emergency history."
        rows={data.previousBreakdowns.map((row) => ({
          key: String(row.id),
          primary: String(row.title),
          secondary: `${formatEnumLabel(String(row.type ?? ""), "")} · ${formatDate(row.completedDate)}`,
          meta: typeof row.actualCost === "number" ? formatMoney(row.actualCost) : undefined
        }))}
      />

      {!compact ? (
        <>
          <HistoryTable
            title="Previous spare parts used"
            empty="No spare parts linked to prior jobs."
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
    return empty ? <EmptyState title={title} description={empty} /> : null;
  }

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <h5 className="border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">{title}</h5>
      <ol className="space-y-0 px-3 py-2">
        {rows.map((row) => (
          <li key={row.key} className="relative border-l border-brand-200 py-2 pl-4 text-sm">
            <span className="absolute -left-1 top-3 h-2 w-2 rounded-full bg-brand-600" aria-hidden />
            <p className="text-xs text-slate-500">
              {row.secondary}
              {row.meta ? ` · ${row.meta}` : ""}
            </p>
            <p className="font-medium text-slate-800">{row.primary}</p>
          </li>
        ))}
      </ol>
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
