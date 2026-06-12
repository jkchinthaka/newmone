"use client";

import { AlertTriangle, ArrowRight, RefreshCw, ShieldAlert, Trophy } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { StatePanel, SummaryCards } from "@/components/reports/report-ui";
import { toSafeApiErrorMessage } from "@/components/ui/page-state";
import { getDriverManagementDashboard } from "@/lib/driver-intelligence-api";
import { formatCurrency } from "@/lib/localization";

const riskPalette: Record<string, string> = {
  LOW: "#059669",
  MEDIUM: "#d97706",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626"
};

const toneClasses: Record<string, string> = {
  neutral: "border-slate-200 bg-white text-slate-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800"
};

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 89);
  return { startDate: toInputDate(start), endDate: toInputDate(end) };
}

export default function DashboardPage() {
  const [filters, setFilters] = useState(defaultRange);
  const query = useQuery({
    queryKey: ["driver-intelligence", "dashboard", filters],
    queryFn: () => getDriverManagementDashboard(filters),
    refetchInterval: 60_000
  });

  const dashboard = query.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Management Dashboard</h2>
          <p className="text-sm text-slate-500">Driver intelligence, fleet cost pressure, fuel flags, and assignment readiness in one live view.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Start
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
              className="block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            End
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
              className="block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
            />
          </label>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} /> Refresh
          </button>
          <Link href={"/reports/driver-intelligence" as Route} className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 shadow-sm transition hover:bg-brand-100">
            Reports <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {query.isLoading ? (
        <StatePanel type="loading" title="Loading management dashboard" message="Calculating live driver, cost, and fuel intelligence." />
      ) : query.isError ? (
        <StatePanel type="error" title="Could not load management dashboard" message={toSafeApiErrorMessage(query.error, "The dashboard API returned an error.")} onRetry={() => query.refetch()} />
      ) : dashboard ? (
        <>
          <SummaryCards cards={dashboard.summaryCards} />

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Fleet Net Cost Trend</p>
                  <p className="text-xs text-slate-500">Fuel, maintenance, accident, and fine costs net of insurance recovery</p>
                </div>
              </div>
              <div className="mt-3 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.fleetCostSummary.monthlyTrend} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                    <Legend />
                    <Line type="monotone" dataKey="netCost" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="insuranceRecovery" stroke="#059669" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Driver Risk Distribution</p>
                  <p className="text-xs text-slate-500">Scored from accidents, fines, vehicle care, fuel, compliance, and supervisor review</p>
                </div>
                <ShieldAlert size={18} className="text-rose-500" />
              </div>
              <div className="mt-3 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboard.riskDistribution} dataKey="count" nameKey="level" innerRadius={54} outerRadius={96} paddingAngle={3}>
                      {dashboard.riskDistribution.map((item) => (
                        <Cell key={item.level} fill={riskPalette[item.level] ?? "#64748b"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Monthly Cost Breakdown</p>
              <p className="text-xs text-slate-500">Where vehicle cost pressure is coming from month over month</p>
              <div className="mt-3 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.fleetCostSummary.monthlyTrend} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                    <Legend />
                    <Bar dataKey="fuelCost" stackId="cost" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="maintenanceCost" stackId="cost" fill="#0f766e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="accidentCost" stackId="cost" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fineCost" stackId="cost" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Fuel Cost and Liters Trend</p>
              <p className="text-xs text-slate-500">Abnormal fuel usage is flagged for review, not treated as automatic driver fault</p>
              <div className="mt-3 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.fuelInsights.monthlyTrend} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="totalCost" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="liters" stroke="#0891b2" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <Trophy size={17} className="text-amber-500" />
                <p className="text-sm font-semibold">Best Drivers</p>
              </div>
              <div className="mt-3 space-y-3">
                {dashboard.bestDrivers.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No ranked drivers in the selected range.</p>
                ) : (
                  dashboard.bestDrivers.map((driver) => (
                    <div key={driver.driverId} className="rounded-lg border border-slate-200 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{driver.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{driver.assignedVehicleCount} assigned vehicle(s)</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${driver.eligibility ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                          {driver.eligibility ? "Eligible" : driver.riskLevel}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                        <p>Ranking score: <span className="font-semibold text-slate-900">{driver.rankingScore}</span></p>
                        <p>Driver score: <span className="font-semibold text-slate-900">{driver.driverScore}</span></p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <AlertTriangle size={17} className="text-rose-500" />
                <p className="text-sm font-semibold">Watchlist</p>
              </div>
              <div className="mt-3 space-y-3">
                {dashboard.highRiskDrivers.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No high-risk drivers in the selected range.</p>
                ) : (
                  dashboard.highRiskDrivers.map((driver) => (
                    <div key={driver.driverId} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{driver.name}</p>
                          <p className="mt-1 text-xs text-rose-700">Score {driver.driverScore} · {driver.riskLevel}</p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-rose-800">
                        {driver.primaryReasons.length === 0 ? <p>No primary reasons returned.</p> : driver.primaryReasons.map((reason) => <p key={reason}>{reason}</p>)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Alerts</p>
                  <p className="text-xs text-slate-500">Direct links from accidents, fines, maintenance, fuel, and compliance intelligence</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {dashboard.alerts.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No active intelligence alerts in the selected range.</p>
                ) : (
                  dashboard.alerts.map((alert, index) => (
                    <div key={`${alert.type}-${index}`} className={`rounded-lg border px-3 py-2 text-sm ${toneClasses[alert.tone ?? "neutral"]}`}>
                      <p className="font-semibold">{alert.type}</p>
                      <p className="mt-0.5 text-slate-600">{alert.message}</p>
                    </div>
                  ))
                )}

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Fleet cost snapshot</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <p>Fuel: {formatCurrency(dashboard.fleetCostSummary.breakdown.fuelCost)}</p>
                    <p>Maintenance: {formatCurrency(dashboard.fleetCostSummary.breakdown.maintenanceCost)}</p>
                    <p>Accidents: {formatCurrency(dashboard.fleetCostSummary.breakdown.accidentCost)}</p>
                    <p>Fines: {formatCurrency(dashboard.fleetCostSummary.breakdown.fineCost)}</p>
                    <p>Insurance recovery: {formatCurrency(dashboard.fleetCostSummary.breakdown.insuranceRecovery)}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Driver Spotlight</p>
                <p className="text-xs text-slate-500">Cross-linked safety, vehicle care, trip, and fuel signals for the most relevant drivers in scope</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.driverProfiles.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No driver profiles available in the selected range.</p>
              ) : (
                dashboard.driverProfiles.slice(0, 6).map((driver) => (
                  <div key={driver.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{driver.displayName}</p>
                        <p className="mt-1 text-xs text-slate-500">{driver.department ?? "No department"}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${driver.riskLevel === "LOW" ? "bg-emerald-100 text-emerald-700" : driver.riskLevel === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                        {driver.riskLevel}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                      <p>Driver score: <span className="font-semibold text-slate-900">{driver.driverScore}</span></p>
                      <p>Ranking score: <span className="font-semibold text-slate-900">{driver.rankingScore}</span></p>
                      <p>Vehicle care: <span className="font-semibold text-slate-900">{driver.components.vehicleCareScore}</span></p>
                      <p>Fuel score: <span className="font-semibold text-slate-900">{driver.components.fuelEfficiencyScore}</span></p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <p>Accidents: {driver.summary.driverFaultAccidents}</p>
                      <p>Fines: {driver.summary.driverRelatedFines}</p>
                      <p>Trips: {driver.summary.completedTrips}/{driver.summary.totalTrips}</p>
                      <p>Fuel flags: {driver.summary.abnormalFuelUsageCount}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      ) : (
        <StatePanel type="empty" title="No dashboard data" message="No management analytics are available for the selected range." />
      )}
    </div>
  );
}
