import Link from "next/link";

import type { FacilityDashboardIssuePreview } from "@/lib/facility-dashboard-types";
import { formatDateTime } from "@/lib/localization";

type FacilityAttentionListProps = {
  title: string;
  description?: string;
  items: readonly FacilityDashboardIssuePreview[];
  emptyLabel?: string;
};

export function FacilityAttentionList({
  title,
  description,
  items,
  emptyLabel = "Nothing needs attention right now."
}: FacilityAttentionListProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600">
                    {item.severity} · {item.status}
                    {item.roomName ? ` · ${item.roomName}` : ""}
                  </p>
                  {item.slaTargetAt ? (
                    <p className="text-xs text-amber-700">
                      SLA target: {formatDateTime(item.slaTargetAt)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Link href="/cleaning/issues" className="font-medium text-brand-700 hover:text-brand-800">
                    View issues
                  </Link>
                  {item.workOrderNumber ? (
                    <Link href="/work-orders" className="font-medium text-sky-700 hover:text-sky-800">
                      {item.workOrderNumber}
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
