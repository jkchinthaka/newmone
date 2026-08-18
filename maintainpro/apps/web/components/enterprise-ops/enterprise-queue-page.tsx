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
  fetchAssetHealth,
  fetchBudgetSnapshot,
  fetchMasterDataMappings,
  fetchProcurementMatches,
  fetchSlaQueue,
  fetchVendorEligibility,
  reviewProcurementRecommendation
} from "@/lib/enterprise-ops-api";

type QueueKind =
  | "exceptions"
  | "forecasts"
  | "health"
  | "costs"
  | "warranty"
  | "procurement"
  | "sla"
  | "matching"
  | "budget"
  | "assets"
  | "vendors"
  | "mappings";

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
      if (kind === "sla") return { items: await fetchSlaQueue() };
      if (kind === "matching") return { items: await fetchProcurementMatches() };
      if (kind === "budget") return { items: await fetchBudgetSnapshot() };
      if (kind === "assets") return { items: await fetchAssetHealth() };
      if (kind === "vendors") return { items: await fetchVendorEligibility() };
      if (kind === "mappings") return { items: await fetchMasterDataMappings() };
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
    if (kind === "sla") {
      return [
        { id: "woNumber", header: "Work order", cell: (row) => asText(row.woNumber) },
        { id: "stage", header: "SLA stage", cell: (row) => asText(row.stage) },
        { id: "consumedPct", header: "Consumed %", cell: (row) => asText(row.consumedPct) },
        { id: "slaBreached", header: "Breached", cell: (row) => asText(row.slaBreached) }
      ];
    }
    if (kind === "matching") {
      return [
        { id: "poNumber", header: "PO", cell: (row) => asText(row.poNumber) },
        { id: "result", header: "Match", cell: (row) => asText(row.result) },
        { id: "orderedQty", header: "Ordered", cell: (row) => asText(row.orderedQty) },
        { id: "receivedQty", header: "Received", cell: (row) => asText(row.receivedQty) },
        { id: "invoiceCoverage", header: "Invoice", cell: (row) => asText(row.invoiceCoverage) }
      ];
    }
    if (kind === "budget") {
      return [
        { id: "period", header: "Period", cell: (row) => asText(row.period) },
        { id: "budgetAmount", header: "Budget", cell: (row) => (row.budgetAmount == null ? "Insufficient data" : asText(row.budgetAmount)) },
        { id: "committed", header: "Committed", cell: (row) => asText(row.committed) },
        { id: "coverage", header: "Coverage", cell: (row) => asText(row.coverage) }
      ];
    }
    if (kind === "assets") {
      return [
        { id: "assetTag", header: "Asset", cell: (row) => asText(row.assetTag) },
        { id: "score", header: "Score", cell: (row) => asText(row.score) },
        { id: "band", header: "Band", cell: (row) => asText(row.band) },
        { id: "criticality", header: "Criticality", cell: (row) => asText(row.criticality) },
        { id: "reasons", header: "Reasons", cell: (row) => asText(row.reasons) }
      ];
    }
    if (kind === "vendors") {
      return [
        { id: "name", header: "Vendor", cell: (row) => asText(row.name) },
        { id: "allowed", header: "Eligible", cell: (row) => asText(row.allowed) },
        { id: "code", header: "Code", cell: (row) => asText(row.code) },
        { id: "contractCoverage", header: "Contract", cell: (row) => asText(row.contractCoverage) }
      ];
    }
    if (kind === "mappings") {
      return [
        { id: "sourceRecordCode", header: "Source", cell: (row) => asText(row.sourceRecordCode) },
        { id: "mismatchType", header: "Type", cell: (row) => asText(row.mismatchType) },
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
