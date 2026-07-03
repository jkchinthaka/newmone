"use client";

import { useQuery } from "@tanstack/react-query";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { fetchEscalationMatrix, fetchSlaDashboard } from "@/lib/operations-api";

export function SlaMonitorPage() {
  const query = useQuery({ queryKey: ["support", "sla"], queryFn: fetchSlaDashboard });

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">SLA Monitor</h2>
      {query.isLoading ? (
        <InlineLoadingState label="Loading SLA metrics…" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Open SLA Breaches", query.data?.openSlaBreaches],
              ["Near Breach", query.data?.ticketsNearBreach],
              ["Avg First Response (min)", query.data?.avgFirstResponseMinutes],
              ["Avg Resolution (min)", query.data?.avgResolutionMinutes]
            ] as Array<[string, unknown]>
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-white p-4">
              <p className="text-xs uppercase text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{String(value ?? 0)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EscalationMatrixPage() {
  const query = useQuery({ queryKey: ["support", "escalation"], queryFn: fetchEscalationMatrix });

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Escalation Matrix</h2>
      {query.isLoading ? (
        <InlineLoadingState label="Loading escalation rules…" />
      ) : (
        <ul className="space-y-2">
          {(query.data as Array<Record<string, unknown>>)?.map((rule) => (
            <li key={String(rule.id)} className="rounded-lg border bg-white p-3 text-sm">
              Level {String(rule.escalationLevel)} — {String(rule.responsibleRole)} — after {String(rule.escalationAfterMinutes)} min
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
