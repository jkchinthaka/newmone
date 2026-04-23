"use client";

import { useMemo, type ReactNode } from "react";
import { AlertTriangle, Building2, CheckCircle2, Clock3, ShieldCheck, Siren } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { apiClient } from "@/lib/api-client";

type DashboardData = {
  windowDays: number;
  totalLocations: number;
  completedVisitsToday: number;
  pendingOrMissedCleanings: number;
  complianceRate: number;
  openIssuesCount: number;
  dailyTrend: Array<{
    date: string;
    completed: number;
    pending: number;
    rejected: number;
  }>;
  weeklyTrend: Array<{
    weekStart: string;
    completed: number;
    pending: number;
    rejected: number;
  }>;
  locationCompliance: Array<{
    locationId: string;
    locationName: string;
    completedCount: number;
    expectedCount: number;
    complianceRate: number;
    shiftAssignment: string;
    assignedCleaner: string | null;
  }>;
  alerts: {
    missedSchedules: Array<{
      locationId: string;
      locationName: string;
      expectedVisits: number;
      completedVisits: number;
      pendingVisits: number;
    }>;
    rejectedVisits: Array<{
      id: string;
      locationName: string;
      cleanerName: string;
      scannedAt: string;
      rejectionReason?: string | null;
    }>;
    highIssueLocations: Array<{
      locationId: string;
      locationName: string;
      openIssueCount: number;
    }>;
  };
};

const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md";

export function CleaningOverview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["cleaning", "dashboard"],
    queryFn: async () => {
      const response = await apiClient.get("/cleaning/dashboard");
      return response.data?.data as DashboardData;
    },
    refetchInterval: 60_000
  });

  const topCompliance = useMemo(
    () =>
      [...(data?.locationCompliance ?? [])]
        .sort((a, b) => b.complianceRate - a.complianceRate)
        .slice(0, 8),
    [data?.locationCompliance]
  );

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {(error as { message?: string }).message ?? "Failed to load cleaning dashboard"}
      </div>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-slate-500">Loading smart cleaning metrics...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Total Locations"
          value={data.totalLocations}
          subtitle="Active monitored areas"
          tone="neutral"
          icon={<Building2 size={18} />}
        />
        <KpiCard
          title="Completed Visits Today"
          value={data.completedVisitsToday}
          subtitle="Validated cleaning runs"
          tone="success"
          icon={<CheckCircle2 size={18} />}
        />
        <KpiCard
          title="Pending / Missed"
          value={data.pendingOrMissedCleanings}
          subtitle="Need immediate action"
          tone="warning"
          icon={<Clock3 size={18} />}
        />
        <KpiCard
          title="Compliance Rate"
          value={`${data.complianceRate}%`}
          subtitle={`Based on ${data.windowDays}-day window`}
          tone="success"
          icon={<ShieldCheck size={18} />}
        />
        <KpiCard
          title="Open Issues"
          value={data.openIssuesCount}
          subtitle="OPEN + IN_PROGRESS"
          tone="danger"
          icon={<Siren size={18} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className={cardClass}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Daily Cleaning Trend</p>
              <p className="text-xs text-slate-500">
                Completed vs pending vs rejected visits (last {data.windowDays} days)
              </p>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyTrend} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={18} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: "#cbd5e1" }}
                  labelStyle={{ color: "#0f172a" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="pending"
                  name="Pending"
                  stroke="#ca8a04"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="rejected"
                  name="Rejected"
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-semibold text-slate-900">Weekly Throughput</p>
          <p className="text-xs text-slate-500">Weekly cleaning output with risk indicators</p>
          <div className="mt-3 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weeklyTrend} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="weekStart" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#cbd5e1" }} />
                <Legend />
                <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#facc15" radius={[6, 6, 0, 0]} />
                <Bar dataKey="rejected" name="Rejected" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className={cardClass}>
          <p className="text-sm font-semibold text-slate-900">Location-wise Compliance</p>
          <p className="text-xs text-slate-500">Top locations by achieved schedule compliance</p>
          <div className="mt-3 h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCompliance} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis
                  type="category"
                  dataKey="locationName"
                  width={160}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <Tooltip
                  formatter={(value: number, _name, row) => {
                    const payload = row?.payload as { completedCount: number; expectedCount: number };
                    return [`${value}% (${payload.completedCount}/${payload.expectedCount})`, "Compliance"];
                  }}
                  contentStyle={{ borderRadius: 12, borderColor: "#cbd5e1" }}
                />
                <Bar dataKey="complianceRate" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-2 text-slate-900">
            <AlertTriangle size={16} className="text-amber-500" />
            <p className="text-sm font-semibold">Alerts Panel</p>
          </div>

          <div className="mt-3 space-y-3 text-sm">
            <AlertBlock
              title="Missed schedules"
              tone="warning"
              emptyText="No missed schedules detected."
              items={data.alerts.missedSchedules.map((item) => ({
                id: item.locationId,
                primary: item.locationName,
                secondary: `${item.pendingVisits} pending out of ${item.expectedVisits}`
              }))}
            />

            <AlertBlock
              title="Rejected cleanings"
              tone="danger"
              emptyText="No rejected visits this week."
              items={data.alerts.rejectedVisits.map((item) => ({
                id: item.id,
                primary: `${item.locationName} (${item.cleanerName})`,
                secondary: item.rejectionReason || new Date(item.scannedAt).toLocaleString()
              }))}
            />

            <AlertBlock
              title="High-issue locations"
              tone="danger"
              emptyText="No high-issue hotspots right now."
              items={data.alerts.highIssueLocations.map((item) => ({
                id: item.locationId,
                primary: item.locationName,
                secondary: `${item.openIssueCount} active issues`
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  tone,
  icon
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone: "neutral" | "success" | "warning" | "danger";
  icon: ReactNode;
}) {
  const toneStyles: Record<typeof tone, string> = {
    neutral: "border-slate-200 bg-white text-slate-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800"
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneStyles[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
        <div className="rounded-lg bg-white/70 p-2">{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function AlertBlock({
  title,
  tone,
  emptyText,
  items
}: {
  title: string;
  tone: "warning" | "danger";
  emptyText: string;
  items: Array<{ id: string; primary: string; secondary: string }>;
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50/60"
      : "border-red-200 bg-red-50/60";

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-slate-500">{emptyText}</p>
        ) : (
          items.slice(0, 4).map((item) => (
            <div key={item.id} className="rounded-lg border border-white/80 bg-white/80 p-2">
              <p className="text-sm font-medium text-slate-800">{item.primary}</p>
              <p className="text-xs text-slate-600">{item.secondary}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
