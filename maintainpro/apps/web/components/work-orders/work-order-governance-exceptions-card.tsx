"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import type { GovernanceExceptionSummary } from "@/lib/work-order-governance";

export function WorkOrderGovernanceExceptionsCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<GovernanceExceptionSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<{ data: GovernanceExceptionSummary }>("/work-orders/governance/exceptions");
        if (!cancelled) {
          setSummary(response.data.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Could not load governance exceptions."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        <div className="inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Loading governance exceptions…
        </div>
      </section>
    );
  }

  if (error || !summary) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error ?? "Governance exceptions unavailable."}
      </section>
    );
  }

  const cards = [
    { label: "Completed without evidence", value: summary.completedWithoutEvidence },
    { label: "Closed without supervisor verification", value: summary.closedWithoutSupervisorVerification },
    { label: "Parts issued, job not completed", value: summary.partsIssuedJobNotCompleted },
    { label: "Repeated asset breakdowns (30d)", value: summary.repeatedAssetBreakdowns },
    { label: "High-cost work orders", value: summary.highCostWorkOrders },
    { label: "Cancelled (30d)", value: summary.cancelledWorkOrders },
    { label: "Reopened (30d)", value: summary.reopenedWorkOrders }
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Fraud & exception indicators</h3>
          <p className="mt-1 text-xs text-slate-500">
            Operational misuse signals for maintenance supervisors. Review flagged work orders in Audit and History tabs.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">{card.label}</p>
                <p className="text-lg font-semibold text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>
          {summary.notes.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
              {summary.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
