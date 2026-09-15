"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  listOutstandingTools,
  listSparePartsMapping,
  type OutstandingToolRow,
  type SparePartMappingRow
} from "@/lib/maintenance-supply-api";

export default function MaintenanceSupplyPage() {
  const [parts, setParts] = useState<SparePartMappingRow[]>([]);
  const [tools, setTools] = useState<OutstandingToolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [partsData, toolsData] = await Promise.all([
        listSparePartsMapping(),
        listOutstandingTools()
      ]);
      setParts(partsData);
      setTools(toolsData);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load maintenance supply"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs
        items={[
          { label: "Spare Parts", href: "/inventory" },
          { label: "Maintenance Supply", href: "/maintenance-supply" }
        ]}
      />
      <ResponsivePageHeader
        title="Maintenance Supply"
        description="ERP mapping status and outstanding tool returns. Official stock remains in Bileeta."
      />

      {loading ? (
        <div className="flex min-h-40 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <ErrorState title="Could not load supply data" description={error} onRetry={() => void refresh()} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Outstanding tools</h2>
            {tools.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-600">
                No outstanding tool returns.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tools.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {row.part?.partNumber ?? "—"} · {row.part?.name ?? "Tool"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      WO {row.workOrderId.slice(-6)} · outstanding {row.outstandingQuantity} of{" "}
                      {row.quantity}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Returned {row.quantityReturned} · {row.part?.classification ?? "TOOL"}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Spare parts ERP mapping</h2>
            {parts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-600">
                No spare parts found.
              </p>
            ) : (
              <>
                <div className="grid gap-3 md:hidden">
                  {parts.map((part) => (
                    <article
                      key={part.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {part.partNumber} · {part.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {part.classification}
                        {part.criticalSpare ? " · critical" : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {part.mapped ? `ERP ${part.erpCode}` : "Unmapped"} ·{" "}
                        {part.stockBoundary?.source ?? "—"}
                      </p>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Part</th>
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">ERP code</th>
                        <th className="px-3 py-2">Boundary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((part) => (
                        <tr key={part.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-900">{part.partNumber}</div>
                            <div className="text-xs text-slate-500">{part.name}</div>
                          </td>
                          <td className="px-3 py-2">{part.classification}</td>
                          <td className="px-3 py-2">{part.erpCode ?? "—"}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {part.stockBoundary?.source ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
