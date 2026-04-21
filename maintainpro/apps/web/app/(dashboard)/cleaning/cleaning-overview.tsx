"use client";

import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";

interface DashboardData {
  windowDays: number;
  totalLocations: number;
  totalVisits: number;
  approved: number;
  rejected: number;
  pending: number;
  openIssues: number;
  complianceRate: number;
}

const card = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

export function CleaningOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/cleaning/dashboard")
      .then((res) => setData(res.data?.data ?? res.data))
      .catch((err) => setError(err?.response?.data?.message ?? "Failed to load metrics"));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Loading metrics…</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Active Locations" value={data.totalLocations} />
      <Metric
        label={`Visits (last ${data.windowDays}d)`}
        value={data.totalVisits}
      />
      <Metric label="Compliance Rate" value={`${data.complianceRate}%`} accent="emerald" />
      <Metric label="Open Issues" value={data.openIssues} accent="red" />
      <div className={card + " sm:col-span-2 lg:col-span-4"}>
        <p className="text-xs uppercase tracking-wide text-slate-500">Visit status breakdown</p>
        <div className="mt-3 grid grid-cols-3 gap-4 text-center">
          <Stat label="Approved" value={data.approved} color="text-emerald-700" />
          <Stat label="Pending Sign-off" value={data.pending} color="text-amber-700" />
          <Stat label="Rejected" value={data.rejected} color="text-red-700" />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent
}: {
  label: string;
  value: string | number;
  accent?: "emerald" | "red";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "red"
        ? "text-red-700"
        : "text-slate-900";
  return (
    <div className={card}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
