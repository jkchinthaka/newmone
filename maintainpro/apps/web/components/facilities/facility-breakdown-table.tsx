import type { FacilityDashboardBreakdownRow } from "@/lib/facility-dashboard-types";
import { formatFacilityDashboardCount } from "@/lib/facility-dashboard";

type FacilityBreakdownTableProps = {
  title: string;
  description?: string;
  rows: readonly FacilityDashboardBreakdownRow[];
  emptyLabel?: string;
};

export function FacilityBreakdownTable({
  title,
  description,
  rows,
  emptyLabel = "No data yet"
}: FacilityBreakdownTableProps) {
  const visibleRows = rows.filter((row) => row.count > 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </header>

      {visibleRows.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Label</th>
                <th className="py-2 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-800">{row.label}</td>
                  <td className="py-2 text-right font-medium tabular-nums text-slate-900">
                    {formatFacilityDashboardCount(row.count)}
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
