"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";

import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { ErrorState, InlineLoadingState } from "@/components/ui/page-state";
import { fetchEnterpriseDashboard, type EnterpriseDashboard } from "@/lib/enterprise-ops-api";
import { getApiErrorMessage } from "@/lib/api-client";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

const KPI_ITEMS: Array<{ key: keyof EnterpriseDashboard; label: string }> = [
  { key: "fleetAvailability", label: "Fleet availability" },
  { key: "criticalVehicles", label: "Critical vehicles" },
  { key: "maintenanceDue", label: "Maintenance due" },
  { key: "maintenanceOverdue", label: "Maintenance overdue" },
  { key: "openCriticalWorkOrders", label: "Open critical WOs" },
  { key: "lowStock", label: "Low stock" },
  { key: "outOfStock", label: "Out of stock" },
  { key: "forecastShortages", label: "Forecast shortages" },
  { key: "erpVariances", label: "ERP variances" },
  { key: "openExceptions", label: "Open exceptions" },
  { key: "warrantyOpportunities", label: "Warranty opportunities" },
  { key: "procurementRecommendations", label: "Procurement recommendations" },
  { key: "slaBreaches", label: "SLA breaches" },
  { key: "monthlyFleetCost", label: "Monthly fleet cost" }
];

function formatValue(key: keyof EnterpriseDashboard, value: number | null, coverage?: string) {
  if (value == null || coverage === "INSUFFICIENT_DATA") {
    return "Insufficient data";
  }
  if (key === "fleetAvailability") {
    return `${Math.round(value * 100)}%`;
  }
  if (key === "monthlyFleetCost") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return String(value);
}

export function EnterpriseKpiBoard() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const allowed = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FINANCE"].includes(roleName ?? "");
  const query = useQuery({
    queryKey: ["enterprise-ops-dashboard", user.id],
    queryFn: fetchEnterpriseDashboard,
    enabled: allowed,
    refetchInterval: 60_000
  });

  if (!allowed) {
    return null;
  }

  return (
    <DashboardSection
      title="Enterprise operations"
      description="Live actionable KPIs. Empty or insufficient values are not invented."
    >
      {query.isLoading ? <InlineLoadingState label="Loading operations KPIs…" /> : null}
      {query.error ? (
        <ErrorState title="Could not load operations KPIs" description={getApiErrorMessage(query.error, "Unable to load KPIs.")} />
      ) : null}
      {query.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {KPI_ITEMS.map((item) => {
            const kpi = query.data[item.key];
            if (!kpi) return null;
            const href = (kpi.href ?? "/dashboard") as Route;
            return (
              <Link
                key={item.key}
                href={href}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 hover:border-brand-300 hover:bg-white"
              >
                <p className="text-xs font-medium text-slate-500">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatValue(item.key, kpi.value, kpi.coverage)}
                </p>
              </Link>
            );
          })}
        </div>
      ) : null}
    </DashboardSection>
  );
}
