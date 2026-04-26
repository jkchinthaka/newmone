"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";

import { PageHeader, Section, StatCard } from "@/components/farm/farm-ui";
import { farmGet, formatLkr } from "@/lib/farm-api";
import { getActiveTenantId } from "@/lib/tenant-context";

type Field = { id: string; areaHectares?: number | null };
type CropCycle = { id: string; status?: string | null };
type Animal = { id: string; status?: string | null };
type Alert = { id: string; alertType?: string | null; recordedAt: string };
type Summary = { totalIncome: number; totalExpense: number; netProfit: number };

export const dynamic = "force-dynamic";

export default function FarmDashboardPage() {
  const tenantId = typeof window !== "undefined" ? getActiveTenantId() ?? "" : "";

  const fields = useQuery({ queryKey: ["farm-fields-overview"], queryFn: () => farmGet<Field[]>("/farm/fields") });
  const crops = useQuery({ queryKey: ["farm-crops-overview"], queryFn: () => farmGet<CropCycle[]>("/farm/crops") });
  const livestock = useQuery({ queryKey: ["farm-livestock-overview"], queryFn: () => farmGet<Animal[]>("/farm/livestock/animals") });
  const alerts = useQuery({ queryKey: ["farm-weather-alerts"], queryFn: () => farmGet<Alert[]>("/farm/weather/alerts") });
  const finance = useQuery({
    queryKey: ["farm-finance-summary"],
    queryFn: () => farmGet<Summary>("/farm/finance/summary", { tenantId }),
    enabled: Boolean(tenantId)
  });

  const totalArea = (fields.data ?? []).reduce((s, f) => s + (f.areaHectares ?? 0), 0);
  const activeCrops = (crops.data ?? []).filter((c) => c.status !== "HARVESTED" && c.status !== "FAILED").length;
  const activeAnimals = (livestock.data ?? []).filter((a) => a.status === "ACTIVE" || !a.status).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Nelna Farm Operations"
        title="Farm Operations Command Center"
        description="Real-time overview of fields, crops, livestock, weather alerts, and farm finance for your tenancy."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total fields" value={fields.data?.length ?? "—"} hint={`${totalArea.toFixed(2)} ha managed`} />
        <StatCard label="Active crop cycles" value={activeCrops} />
        <StatCard label="Active livestock" value={activeAnimals} />
        <StatCard label="Weather alerts (recent)" value={alerts.data?.length ?? 0} />
      </div>

      <Section title="Finance snapshot">
        {!tenantId ? (
          <p className="text-sm text-slate-500">Select an active tenant to view finance summary.</p>
        ) : finance.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : finance.data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Income" value={formatLkr(finance.data.totalIncome)} />
            <StatCard label="Expense" value={formatLkr(finance.data.totalExpense)} />
            <StatCard label="Net profit" value={formatLkr(finance.data.netProfit)} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">No finance data yet.</p>
        )}
      </Section>

      <Section title="Quick links">
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 xl:grid-cols-4">
          {[
            ["/farm/fields", "Fields & Map"],
            ["/farm/crops", "Crops"],
            ["/farm/harvest", "Harvest"],
            ["/farm/livestock", "Livestock"],
            ["/farm/irrigation", "Irrigation"],
            ["/farm/spray-logs", "Spray Logs"],
            ["/farm/soil-tests", "Soil Tests"],
            ["/farm/weather", "Weather"],
            ["/farm/workers", "Workers"],
            ["/farm/attendance", "Attendance"],
            ["/farm/finance", "Finance"],
            ["/farm/traceability", "Traceability"]
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href as Route}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-medium text-amber-900 hover:bg-amber-100"
            >
              {label} →
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
