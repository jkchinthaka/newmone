"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { autoCreatePmWorkOrder, listPmPlans, type PmPlan } from "@/lib/planning-api";

export default function PreventiveMaintenancePage() {
  const [items, setItems] = useState<PmPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listPmPlans());
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load PM plans"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageBreadcrumbs
        items={[
          { label: "Preventive Maintenance", href: "/maintenance/plans" }
        ]}
      />
      <ResponsivePageHeader
        title="Preventive Maintenance"
        description="Plans, next due, triggers, and auto-generated work orders."
      />

      {loading ? (
        <div className="flex min-h-40 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading plans…
        </div>
      ) : error ? (
        <ErrorState title="Could not load plans" description={error} onRetry={() => void refresh()} />
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-600">
          No PM plans yet. Create plans via API or Admin planning setup.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {items.map((plan) => (
              <article key={plan.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  {plan.code} · {plan.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {plan.status} · rev {plan.currentRevision ?? 1} ·{" "}
                  {plan.triggers?.map((t) => t.kind).join(", ") || "no triggers"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Next due: {plan.nextDueAt ? new Date(plan.nextDueAt).toLocaleString() : "—"}
                </p>
                {plan.autoCreateWorkOrder ? (
                  <button
                    type="button"
                    className="mt-3 min-h-10 rounded-lg bg-brand-600 px-3 text-sm text-white"
                    onClick={async () => {
                      try {
                        const result = await autoCreatePmWorkOrder(plan.id);
                        toast.success(String((result as { reason?: string })?.reason ?? "Evaluated"));
                        await refresh();
                      } catch (err) {
                        toast.error(getApiErrorMessage(err, "Auto-WO failed"));
                      }
                    }}
                  >
                    Evaluate / Auto WO
                  </button>
                ) : null}
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Triggers</th>
                  <th className="px-3 py-2">Next due</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((plan) => (
                  <tr key={plan.id} className="border-t">
                    <td className="px-3 py-2 font-medium">
                      {plan.code} — {plan.name}
                    </td>
                    <td className="px-3 py-2">{plan.status}</td>
                    <td className="px-3 py-2">
                      {plan.triggers?.map((t) => t.kind).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {plan.nextDueAt ? new Date(plan.nextDueAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-brand-700 underline"
                        onClick={async () => {
                          try {
                            const result = await autoCreatePmWorkOrder(plan.id);
                            toast.success(String((result as { reason?: string })?.reason ?? "Evaluated"));
                            await refresh();
                          } catch (err) {
                            toast.error(getApiErrorMessage(err, "Auto-WO failed"));
                          }
                        }}
                      >
                        Evaluate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
