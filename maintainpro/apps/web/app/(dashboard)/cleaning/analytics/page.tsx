"use client";

import { type ReactNode, useMemo, useState } from "react";
import { BarChart3, Medal, Timer, TrendingUp, UserCheck } from "lucide-react";
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

type AnalyticsSummary = {
  totalVisits: number;
  avgCleaningTimeMinutes: number;
  rejectionRate: number;
  avgQualityScore: number;
};

type CleanerPerformance = {
  cleanerId: string;
  cleanerName: string;
  totalVisits: number;
  approvedVisits: number;
  rejectedVisits: number;
  avgDurationMinutes: number;
  avgQualityScore: number;
  rejectionRate: number;
  performanceScore: number;
};

type TrendRow = {
  date: string;
  completed: number;
  rejected: number;
  avgDurationMinutes: number;
};

type AnalyticsData = {
  summary: AnalyticsSummary;
  cleanerPerformance: CleanerPerformance[];
  leaderboard: CleanerPerformance[];
  trend: TrendRow[];
};

function defaultDateRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 29);

  return {
    from: start.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10)
  };
}

export default function CleaningAnalyticsPage() {
  const [filters, setFilters] = useState({
    ...defaultDateRange(),
    locationId: "",
    cleanerId: ""
  });

  const metadataQuery = useQuery<{
    locations: Array<{ id: string; name: string }>;
    cleaners: Array<{ id: string; firstName: string; lastName: string }>;
  }>({
    queryKey: ["cleaning", "analytics", "meta"],
    queryFn: async () => {
      const [locationsRes, cleanersRes] = await Promise.all([
        apiClient.get("/cleaning/locations"),
        apiClient.get("/cleaning/users/cleaners")
      ]);

      return {
        locations: (locationsRes.data?.data ?? []) as Array<{ id: string; name: string }>,
        cleaners: (cleanersRes.data?.data ?? []) as Array<{
          id: string;
          firstName: string;
          lastName: string;
        }>
      };
    },
    staleTime: 120_000
  });

  const analyticsQuery = useQuery<AnalyticsData>({
    queryKey: ["cleaning", "analytics", filters],
    queryFn: async () => {
      const response = await apiClient.get("/cleaning/analytics", {
        params: {
          from: filters.from,
          to: filters.to,
          locationId: filters.locationId || undefined,
          cleanerId: filters.cleanerId || undefined
        }
      });

      return response.data?.data as AnalyticsData;
    }
  });

  const topPerformers = useMemo(
    () => (analyticsQuery.data?.leaderboard ?? []).slice(0, 3),
    [analyticsQuery.data?.leaderboard]
  );

  if (analyticsQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading cleaning analytics...</p>;
  }

  if (analyticsQuery.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load analytics dashboard.
      </div>
    );
  }

  const analytics = analyticsQuery.data;
  if (!analytics) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Cleaning Analytics</h1>
        <p className="text-sm text-slate-600">
          Measure cleaner performance, average cleaning time, rejection rates, and leaderboard trends.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-600">
            <span className="mb-1 block">From</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1 block">To</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1 block">Location</span>
            <select
              value={filters.locationId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, locationId: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All locations</option>
              {(metadataQuery.data?.locations ?? []).map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1 block">Cleaner</span>
            <select
              value={filters.cleanerId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, cleanerId: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All cleaners</option>
              {(metadataQuery.data?.cleaners ?? []).map((cleaner) => (
                <option key={cleaner.id} value={cleaner.id}>
                  {cleaner.firstName} {cleaner.lastName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Visits"
          value={analytics.summary.totalVisits}
          subtitle="Visits in selected range"
          icon={<BarChart3 size={16} />}
          tone="neutral"
        />
        <MetricCard
          title="Avg Cleaning Time"
          value={`${analytics.summary.avgCleaningTimeMinutes} min`}
          subtitle="Mean completion duration"
          icon={<Timer size={16} />}
          tone="success"
        />
        <MetricCard
          title="Rejection Rate"
          value={`${analytics.summary.rejectionRate}%`}
          subtitle="Supervisor rejection ratio"
          icon={<TrendingUp size={16} />}
          tone="warning"
        />
        <MetricCard
          title="Avg Quality Score"
          value={analytics.summary.avgQualityScore}
          subtitle="Checklist + photos + sign-off"
          icon={<UserCheck size={16} />}
          tone="success"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Trend Analysis</p>
          <p className="text-xs text-slate-500">Daily completed/rejected counts and average duration</p>

          <div className="mt-3 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.trend} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                <Legend />
                <Line type="monotone" dataKey="completed" stroke="#16a34a" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="rejected" stroke="#dc2626" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="avgDurationMinutes" stroke="#0ea5e9" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Medal size={16} className="text-amber-500" /> Top Cleaners
          </p>
          <p className="text-xs text-slate-500">Ranked by overall performance score</p>

          <div className="mt-3 space-y-2">
            {topPerformers.length === 0 ? (
              <p className="text-sm text-slate-500">No cleaner data for this range.</p>
            ) : (
              topPerformers.map((entry, index) => (
                <div key={entry.cleanerId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      #{index + 1} {entry.cleanerName}
                    </p>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {entry.performanceScore}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {entry.totalVisits} visits · {entry.avgDurationMinutes} min avg · {entry.rejectionRate}% rejected
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Cleaner Performance Table</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Cleaner</th>
                <th className="px-3 py-2">Visits</th>
                <th className="px-3 py-2">Approved</th>
                <th className="px-3 py-2">Rejected</th>
                <th className="px-3 py-2">Avg Time</th>
                <th className="px-3 py-2">Avg Quality</th>
                <th className="px-3 py-2">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.cleanerPerformance.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    No performance records for selected filters.
                  </td>
                </tr>
              ) : (
                analytics.cleanerPerformance.map((entry) => (
                  <tr key={entry.cleanerId}>
                    <td className="px-3 py-2 font-medium text-slate-900">{entry.cleanerName}</td>
                    <td className="px-3 py-2 text-slate-700">{entry.totalVisits}</td>
                    <td className="px-3 py-2 text-emerald-700">{entry.approvedVisits}</td>
                    <td className="px-3 py-2 text-red-700">{entry.rejectedVisits}</td>
                    <td className="px-3 py-2 text-slate-700">{entry.avgDurationMinutes} min</td>
                    <td className="px-3 py-2 text-slate-700">{entry.avgQualityScore}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {entry.performanceScore}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.cleanerPerformance.slice(0, 8)} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="cleanerName" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
              <Legend />
              <Bar dataKey="performanceScore" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  tone: "neutral" | "success" | "warning";
}) {
  const toneStyles: Record<typeof tone, string> = {
    neutral: "border-slate-200 bg-white text-slate-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900"
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneStyles[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
        <div className="rounded-lg bg-white/70 p-2">{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}
