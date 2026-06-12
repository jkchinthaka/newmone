"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ServerCog } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { ErrorState, InlineLoadingState } from "@/components/ui/page-state";
import { formatNumber } from "@/lib/localization";

import { DashboardCard } from "./dashboard-card";
import { DashboardSection } from "./dashboard-section";

type SystemHealthPayload = {
  status: "operational" | "degraded";
  summary: {
    operational: number;
    degraded: number;
    failed: number;
    required: number;
  };
};

type ApiEnvelope<T> = {
  data: T;
};

export function SystemHealthSummary() {
  const query = useQuery({
    queryKey: ["dashboard", "system-health"],
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<SystemHealthPayload>>("/health/readiness");
      return response.data.data;
    },
    refetchInterval: 60_000
  });

  if (query.isLoading) {
    return (
      <DashboardSection title="System health" description="Operational readiness from the existing health endpoint.">
        <InlineLoadingState label="Loading system health…" />
      </DashboardSection>
    );
  }

  if (query.isError) {
    return (
      <DashboardSection title="System health" description="Operational readiness from the existing health endpoint.">
        <ErrorState title="Could not load system health" error={query.error} onRetry={() => query.refetch()} />
      </DashboardSection>
    );
  }

  const health = query.data;

  if (!health) {
    return null;
  }

  const tone = health.status === "operational" ? "success" : "warning";

  return (
    <DashboardSection
      title="System health"
      description="Operational readiness from the existing health endpoint."
      action={
        <Link href={"/system-health" as Route} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
          Open system health <ArrowRight size={14} aria-hidden="true" />
        </Link>
      }
    >
      <div className="flex items-start gap-3">
        <ServerCog size={18} className="mt-0.5 text-brand-600" aria-hidden="true" />
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            label="Overall status"
            value={health.status === "operational" ? "Operational" : "Needs attention"}
            tone={tone}
          />
          <DashboardCard label="Operational checks" value={formatNumber(health.summary.operational, { fallback: "0" })} tone="success" />
          <DashboardCard label="Degraded checks" value={formatNumber(health.summary.degraded, { fallback: "0" })} tone="warning" />
          <DashboardCard label="Failed checks" value={formatNumber(health.summary.failed, { fallback: "0" })} tone="danger" />
        </div>
      </div>
    </DashboardSection>
  );
}
