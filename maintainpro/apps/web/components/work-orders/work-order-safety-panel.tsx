"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/dashboard";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { downtimeCategoryLabel, formatDrawerDateTime, formatDowntimeElapsed, formatDowntimeSpan } from "@/lib/work-order-drawer-display";
import { withTenantScope } from "@/lib/tenant-query";

type DowntimeSegment = {
  id: string;
  category: string;
  startedAt: string;
  endedAt?: string | null;
};

type DowntimeSummary = {
  segments?: DowntimeSegment[];
  openCount?: number;
};

type Props = {
  workOrderId: string;
  readOnly?: boolean;
};

function LiveElapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="font-semibold tabular-nums text-amber-900">{formatDowntimeElapsed(startedAt, now)}</span>;
}

const DOWNTIME_CATEGORIES = [
  "ACTIVE_REPAIR",
  "WAITING_PARTS",
  "WAITING_VENDOR",
  "WAITING_APPROVAL",
  "WAITING_TECHNICIAN",
  "AWAITING_SHUTDOWN",
  "TESTING",
  "OPERATIONAL_DELAY",
  "OTHER"
];

export function WorkOrderSafetyPanel({ workOrderId, readOnly = false }: Props) {
  const qc = useQueryClient();
  const downtimeQuery = useQuery({
    queryKey: withTenantScope(["work-order", workOrderId, "downtime"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: DowntimeSummary }>(`/work-orders/${workOrderId}/downtime`);
      return res.data.data;
    }
  });

  const openDowntime = useMutation({
    mutationFn: async (category: string) => {
      await apiClient.post(`/work-orders/${workOrderId}/downtime`, { category });
    },
    onSuccess: async () => {
      toast.success("Machine stopped time opened.");
      await qc.invalidateQueries({ queryKey: withTenantScope(["work-order", workOrderId, "downtime"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not open machine stopped time."))
  });

  const closeDowntime = useMutation({
    mutationFn: async (segmentId: string) => {
      await apiClient.post(`/downtime/${segmentId}/close`, {});
    },
    onSuccess: async () => {
      toast.success("Machine stopped time closed.");
      await qc.invalidateQueries({ queryKey: withTenantScope(["work-order", workOrderId, "downtime"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not close machine stopped time."))
  });

  const segments = downtimeQuery.data?.segments ?? [];
  const openSegments = segments.filter((segment) => !segment.endedAt);
  const now = Date.now();

  return (
    <div className="space-y-4" aria-labelledby="wo-safety-heading">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 id="wo-safety-heading" className="text-sm font-semibold text-slate-900">Machine stopped time</h3>
        <p className="mt-1 text-xs text-slate-600">
          Record actual machine stopped time separately from work-order elapsed time.
        </p>

        {downtimeQuery.isLoading ? (
          <div className="mt-3">
            <p className="sr-only">Loading machine stopped time…</p>
            <SkeletonCard />
          </div>
        ) : downtimeQuery.isError ? (
          <div className="mt-3">
            <ErrorState
              message={getApiErrorMessage(downtimeQuery.error, "Could not load machine stopped time.")}
              onRetry={() => void downtimeQuery.refetch()}
            />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {openSegments.length === 0 ? (
              <p className="text-sm text-slate-600">No open machine stopped time.</p>
            ) : (
              openSegments.map((segment) => (
                <div
                  key={segment.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-amber-950">Asset down now</p>
                    <p className="text-xs text-amber-900">
                      Started {formatDrawerDateTime(segment.startedAt)} · {downtimeCategoryLabel(segment.category)}
                    </p>
                  </div>
                  <LiveElapsed startedAt={segment.startedAt} />
                  {readOnly ? null : (
                    <button
                      type="button"
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                      disabled={closeDowntime.isPending}
                      onClick={() => closeDowntime.mutate(segment.id)}
                    >
                      Close segment
                    </button>
                  )}
                </div>
              ))
            )}

            {segments.length === 0 ? (
              <EmptyState title="No machine stopped time recorded" description="Open a segment when the asset cannot be used." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3">Start</th>
                      <th className="py-2 pr-3">End</th>
                      <th className="py-2 pr-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.map((segment) => (
                      <tr key={segment.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {downtimeCategoryLabel(segment.category)}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{formatDrawerDateTime(segment.startedAt)}</td>
                        <td className="py-2 pr-3">{segment.endedAt ? formatDrawerDateTime(segment.endedAt) : "running"}</td>
                        <td className="py-2 pr-3">{formatDowntimeSpan(segment.startedAt, segment.endedAt, now)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {readOnly ? null : (
            <label className="block text-sm text-slate-700">
              <span className="font-medium">Open segment</span>
              <select
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                defaultValue=""
                disabled={openDowntime.isPending}
                onChange={(event) => {
                  const category = event.target.value;
                  if (!category) return;
                  openDowntime.mutate(category);
                  event.target.value = "";
                }}
              >
                <option value="" disabled>
                  Select category…
                </option>
                {DOWNTIME_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {downtimeCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
