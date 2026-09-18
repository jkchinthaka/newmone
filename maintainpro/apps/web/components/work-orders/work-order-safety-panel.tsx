"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type ReadinessBlocker = {
  code: string;
  severity: string;
  message: string;
};

type ReadinessPayload = {
  ready: boolean;
  blockers: ReadinessBlocker[];
};

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
};

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

export function WorkOrderSafetyPanel({ workOrderId }: Props) {
  const qc = useQueryClient();
  const readinessQuery = useQuery({
    queryKey: withTenantScope(["work-order", workOrderId, "readiness"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ReadinessPayload }>(`/work-orders/${workOrderId}/readiness`);
      return res.data.data;
    }
  });

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
      toast.success("Downtime segment opened.");
      await qc.invalidateQueries({ queryKey: withTenantScope(["work-order", workOrderId, "downtime"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not open downtime segment."))
  });

  const closeDowntime = useMutation({
    mutationFn: async (segmentId: string) => {
      await apiClient.post(`/downtime/${segmentId}/close`, {});
    },
    onSuccess: async () => {
      toast.success("Downtime segment closed.");
      await qc.invalidateQueries({ queryKey: withTenantScope(["work-order", workOrderId, "downtime"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not close downtime segment."))
  });

  const readiness = readinessQuery.data;
  const openSegments = (downtimeQuery.data?.segments ?? []).filter((segment) => !segment.endedAt);

  return (
    <div className="space-y-4" aria-labelledby="wo-safety-heading">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-2">
          <Shield className="mt-0.5 h-4 w-4 text-slate-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 id="wo-safety-heading" className="text-sm font-semibold text-slate-900">
              Safety and start readiness
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Start is blocked when required permits or LOTO verification are incomplete. Status is evaluated on the
              server.
            </p>
          </div>
        </div>

        {readinessQuery.isLoading ? (
          <p className="mt-3 text-sm text-slate-600">Checking readiness…</p>
        ) : readinessQuery.isError ? (
          <p className="mt-3 text-sm text-rose-700" role="alert">
            {getApiErrorMessage(readinessQuery.error, "Could not load readiness.")}
          </p>
        ) : readiness ? (
          <div className="mt-3 space-y-2">
            <p
              className={`inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-medium ${
                readiness.ready
                  ? "bg-emerald-50 text-emerald-900"
                  : "bg-amber-50 text-amber-950"
              }`}
            >
              {readiness.ready ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              )}
              <span>{readiness.ready ? "Ready to start" : "Not ready — review blockers"}</span>
            </p>
            {(readiness.blockers ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">No readiness blockers for this work order.</p>
            ) : (
              <ul className="space-y-2">
                {readiness.blockers.map((blocker) => (
                  <li
                    key={`${blocker.code}-${blocker.message}`}
                    className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                  >
                    <span className="font-medium">{blocker.severity}</span>
                    <span className="mx-1 text-slate-400">·</span>
                    <span>{blocker.message}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{blocker.code}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-500">
              Manage work permits under Administration → Work Permits. LOTO verification is enforced when the
              reliability policy requires it.
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Downtime segments</h3>
        <p className="mt-1 text-xs text-slate-600">
          Record actual downtime segments separately from work-order elapsed time.
        </p>

        {downtimeQuery.isLoading ? (
          <p className="mt-3 text-sm text-slate-600">Loading downtime…</p>
        ) : downtimeQuery.isError ? (
          <p className="mt-3 text-sm text-rose-700" role="alert">
            {getApiErrorMessage(downtimeQuery.error, "Could not load downtime.")}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {openSegments.length === 0 ? (
              <p className="text-sm text-slate-600">No open downtime segments.</p>
            ) : (
              <ul className="space-y-2">
                {openSegments.map((segment) => (
                  <li
                    key={segment.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span>
                      {segment.category}
                      <span className="ml-2 text-xs text-slate-500">
                        opened {new Date(segment.startedAt).toLocaleString()}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      disabled={closeDowntime.isPending}
                      onClick={() => closeDowntime.mutate(segment.id)}
                    >
                      Close segment
                    </button>
                  </li>
                ))}
              </ul>
            )}

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
                    {category.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
