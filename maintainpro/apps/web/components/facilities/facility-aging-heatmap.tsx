import type { FacilityAgeBucketRow } from "@/lib/facility-aging-types";
import {
  agingBucketHasRows,
  formatAgingMetric,
  formatAgingBucketHeatClass,
  maxAgingBucketCount
} from "@/lib/facility-aging";

type FacilityAgingHeatmapProps = {
  title: string;
  description?: string;
  rows: readonly FacilityAgeBucketRow[];
  emptyLabel?: string;
};

export function FacilityAgingHeatmap({
  title,
  description,
  rows,
  emptyLabel = "No aging data yet"
}: FacilityAgingHeatmapProps) {
  const maxCount = maxAgingBucketCount(rows);
  const hasRows = agingBucketHasRows(rows);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </header>

      {!hasRows ? (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Age bucket</th>
                <th className="py-2 pr-4 text-right">Total</th>
                <th className="py-2 pr-4 text-right">Critical</th>
                <th className="py-2 text-right">High</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-800">{row.label}</td>
                  <td className="py-2 pr-4 text-right">
                    <span
                      className={`inline-flex min-w-12 justify-center rounded-md px-2 py-1 font-medium tabular-nums ${formatAgingBucketHeatClass(row.count, maxCount)}`}
                    >
                      {formatAgingMetric(row.count)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-800">
                    {formatAgingMetric(row.criticalCount)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-800">
                    {formatAgingMetric(row.highCount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
