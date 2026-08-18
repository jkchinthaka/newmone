"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ErrorState, InlineLoadingState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  convertProcurementRecommendation,
  evaluateProcurementRecommendations,
  fetchBusinessExceptions,
  fetchMaintenanceForecasts,
  fetchProcurementRecommendations,
  fetchVehicleCosts,
  fetchVehicleHealth,
  fetchWarrantyOpportunities,
  refreshMaintenanceForecasts,
  resolveBusinessException,
  reviewProcurementRecommendation
} from "@/lib/enterprise-ops-api";

type QueueKind = "exceptions" | "forecasts" | "health" | "costs" | "warranty" | "procurement";

function asText(value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  return String(value);
}

export function EnterpriseQueuePage({
  kind,
  title,
  description
}: {
  kind: QueueKind;
  title: string;
  description: string;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("OPEN");
  const [resolution, setResolution] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["enterprise-ops", kind, status],
    queryFn: async () => {
      if (kind === "exceptions") return fetchBusinessExceptions({ status, pageSize: 100 });
      if (kind === "forecasts") return { items: await fetchMaintenanceForecasts() };
      if (kind === "health") return { items: await fetchVehicleHealth() };
      if (kind === "costs") return { items: await fetchVehicleCosts() };
      if (kind === "warranty") return { items: await fetchWarrantyOpportunities() };
      return { items: await fetchProcurementRecommendations() };
    }
  });

  const rows = useMemo(() => {
    const payload = query.data as { items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | undefined;
    if (Array.isArray(payload)) return payload;
    return payload?.items ?? [];
  }, [query.data]);

  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(() => {
    if (kind === "exceptions") {
      return [
        { id: "severity", header: "Severity", cell: (row) => asText(row.severity) },
        { id: "ruleCode", header: "Rule", cell: (row) => asText(row.ruleCode) },
        { id: "module", header: "Module", cell: (row) => asText(row.module) },
        { id: "entityType", header: "Entity", cell: (row) => `${asText(row.entityType)} / ${asText(row.entityId)}` },
        { id: "status", header: "Status", cell: (row) => asText(row.status) }
      ];
    }
    if (kind === "forecasts") {
      return [
        { id: "coverage", header: "Coverage", cell: (row) => asText(row.coverage) },
        { id: "estimatedDueDate", header: "Estimated due", cell: (row) => asText(row.estimatedDueDate) },
        { id: "remainingDays", header: "Remaining days", cell: (row) => asText(row.remainingDays) },
        { id: "confidence", header: "Confidence", cell: (row) => asText(row.confidence) }
      ];
    }
    if (kind === "health") {
      return [
        { id: "registrationNo", header: "Vehicle", cell: (row) => asText(row.registrationNo) },
        { id: "score", header: "Score", cell: (row) => asText(row.score) },
        { id: "band", header: "Band", cell: (row) => asText(row.band) },
        { id: "reasons", header: "Reasons", cell: (row) => asText(row.reasons) }
      ];
    }
    if (kind === "costs") {
      return [
        { id: "registrationNo", header: "Vehicle", cell: (row) => asText(row.registrationNo) },
        { id: "totalOperatingCost", header: "Operating cost", cell: (row) => asText(row.totalOperatingCost) },
        { id: "partsCost", header: "Parts", cell: (row) => asText(row.partsCost) },
        { id: "costPerKm", header: "Cost/km", cell: (row) => (row.costPerKm == null ? "Insufficient data" : asText(row.costPerKm)) },
        { id: "coverage", header: "Coverage", cell: (row) => asText(row.coverage) }
      ];
    }
    if (kind === "warranty") {
      return [
        { id: "ruleCode", header: "Rule", cell: (row) => asText(row.ruleCode) },
        { id: "entityId", header: "Installed part", cell: (row) => asText(row.entityId) },
        { id: "status", header: "Status", cell: (row) => asText(row.status) }
      ];
    }
    return [
      { id: "part", header: "Item", cell: (row) => asText((row.part as { partNumber?: string } | undefined)?.partNumber ?? row.partId) },
      { id: "available", header: "Available", cell: (row) => asText(row.available) },
      { id: "reserved", header: "Reserved", cell: (row) => asText(row.reserved) },
      { id: "forecastNeed", header: "Forecast", cell: (row) => asText(row.forecastNeed) },
      { id: "incoming", header: "Incoming", cell: (row) => asText(row.incoming) },
      { id: "suggestedQuantity", header: "Suggested", cell: (row) => asText(row.suggestedQuantity) },
      { id: "priority", header: "Priority", cell: (row) => asText(row.priority) }
    ];
  }, [kind]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (kind === "exceptions" && selectedId) {
        return resolveBusinessException(selectedId, { status: "RESOLVED", resolution });
      }
      if (kind === "forecasts") return refreshMaintenanceForecasts();
      if (kind === "procurement" && selectedId) return convertProcurementRecommendation(selectedId);
      if (kind === "procurement") return evaluateProcurementRecommendations();
      return null;
    },
    onSuccess: () => {
      toast.success("Updated");
      void queryClient.invalidateQueries({ queryKey: ["enterprise-ops", kind] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Update failed"))
  });

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {kind === "exceptions" ? (
            <select className="rounded-md border px-2 py-1 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="IGNORED_WITH_REASON">Ignored</option>
            </select>
          ) : null}
          {kind === "exceptions" || kind === "forecasts" || kind === "procurement" ? (
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
              onClick={() => mutation.mutate()}
            >
              {kind === "exceptions" ? "Resolve selected" : kind === "forecasts" ? "Refresh forecasts" : selectedId ? "Create purchase order" : "Evaluate"}
            </button>
          ) : null}
          {kind === "procurement" && selectedId ? (
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm"
              onClick={() => {
                void reviewProcurementRecommendation(selectedId).then(() => {
                  toast.success("Marked reviewed");
                  void queryClient.invalidateQueries({ queryKey: ["enterprise-ops", kind] });
                });
              }}
            >
              Review
            </button>
          ) : null}
        </div>
      </header>
      {kind === "exceptions" ? (
        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Resolution reason"
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
        />
      ) : null}
      {query.isLoading ? <InlineLoadingState label={`Loading ${title.toLowerCase()}…`} /> : null}
      {query.error ? (
        <ErrorState title={`Could not load ${title}`} description={getApiErrorMessage(query.error, "Request failed.")} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => String(row.id ?? row.snapshotId ?? row.vehicleId ?? Math.random())}
          ariaLabel={title}
          onRowClick={(row) => setSelectedId(String(row.id ?? ""))}
          emptyTitle={`No ${title.toLowerCase()}`}
          emptyDescription="No live records matched the current filters."
        />
      )}
    </div>
  );
}
