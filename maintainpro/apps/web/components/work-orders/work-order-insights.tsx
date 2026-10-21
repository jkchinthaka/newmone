"use client";

import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";

type Insights = {
  cost: { labour: number | null; parts: number | null; vendor: number | null; total: number | null };
  sla: { respond: string | null; resolve: string | null };
};

const cache = new Map<string, Promise<Insights | null>>();

function loadInsights(id: string) {
  const existing = cache.get(id);
  if (existing) return existing;
  const pending = apiClient
    .get(`/work-orders/${id}/insights`)
    .then((response) => {
      const body = response.data as { data?: Insights };
      return body.data ?? null;
    })
    .catch(() => null);
  cache.set(id, pending);
  return pending;
}

function money(value: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function WorkOrderSlaHeader({ workOrderId }: { workOrderId: string }) {
  const [sla, setSla] = useState<Insights["sla"] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadInsights(workOrderId).then((data) => {
      if (!cancelled) setSla(data?.sla ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [workOrderId]);
  if (!sla) return null;
  return (
    <p className="mt-1 text-xs text-slate-600">
      Respond {sla.respond ?? "—"} · Resolve {sla.resolve ?? "—"}
    </p>
  );
}

export function WorkOrderCostBreakdown({ workOrderId }: { workOrderId: string }) {
  const [cost, setCost] = useState<Insights["cost"] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadInsights(workOrderId).then((data) => {
      if (!cancelled) setCost(data?.cost ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [workOrderId]);
  if (!cost) return null;
  const rows: Array<[string, number | null]> = [
    ["Labour", cost.labour],
    ["Parts", cost.parts],
    ["Vendor", cost.vendor],
    ["Total", cost.total]
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-200 px-3 py-2">
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="font-semibold text-slate-900">{money(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
