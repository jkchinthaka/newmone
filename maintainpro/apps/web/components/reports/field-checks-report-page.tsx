"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin, ShieldAlert, Timer } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { fetchLongLabourSessions, fetchPhotosFarFromSite, formatDistance } from "@/lib/fraud-control-api";
import { withTenantScope } from "@/lib/tenant-query";

function when(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function jobLink(workOrderId: string, woNumber: string | null) {
  return (
    <Link href={`/work-orders?wo=${encodeURIComponent(workOrderId)}` as Route} className="font-mono text-xs text-brand-700 hover:underline">
      {woNumber ?? "Open job"}
    </Link>
  );
}

/** Rule-based field checks: very long labour time and job photos taken away from the site. */
export function FieldChecksReportPage() {
  const labour = useQuery({
    queryKey: withTenantScope(["fraud-control", "long-labour"]),
    queryFn: ({ signal }) => fetchLongLabourSessions(signal)
  });
  const photos = useQuery({
    queryKey: withTenantScope(["fraud-control", "photo-location"]),
    queryFn: ({ signal }) => fetchPhotosFarFromSite(signal)
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-brand-700" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900">Field checks</h1>
        </div>
        <p className="max-w-3xl text-sm text-slate-600">
          Things a supervisor should look at. These are rule-based checks, not proof of wrongdoing: a long labour time may be
          a timer left running, and a far-away photo may be a poor GPS signal.
        </p>
        <Link href={"/reports/fraud-control" as Route} className="text-xs font-medium text-brand-700 hover:underline">
          Back to fraud dashboard
        </Link>
      </header>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Timer size={18} aria-hidden /> Very long labour time
        </h2>
        {labour.isLoading ? (
          <LoadingState title="Loading labour time" description="Checking labour sessions." />
        ) : labour.isError ? (
          <ErrorState title="Unable to load labour time" description={getApiErrorMessage(labour.error, "Request failed")} onRetry={() => labour.refetch()} />
        ) : (
          <>
            <p className="text-xs text-slate-500">
              Sessions longer than {labour.data?.limitHours ?? 12} hours in the last {labour.data?.days ?? 30} days, including timers still running.
            </p>
            {(labour.data?.items ?? []).length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">No very long labour sessions.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Job</th>
                      <th className="px-3 py-2">Technician</th>
                      <th className="px-3 py-2">Started</th>
                      <th className="px-3 py-2">Ended</th>
                      <th className="px-3 py-2">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(labour.data?.items ?? []).map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{jobLink(row.workOrderId, row.woNumber)}</td>
                        <td className="px-3 py-2">{row.technicianName ?? "—"}</td>
                        <td className="px-3 py-2">{when(row.startedAt)}</td>
                        <td className="px-3 py-2">{row.stillRunning ? <span className="font-semibold text-amber-800">Still running</span> : when(row.endedAt)}</td>
                        <td className="px-3 py-2 font-semibold">
                          {row.hours}
                          {row.corrected ? <span className="ml-1 text-xs font-normal text-slate-500">(corrected)</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <MapPin size={18} aria-hidden /> Job photo taken far from the site
        </h2>
        {photos.isLoading ? (
          <LoadingState title="Loading photo locations" description="Checking where job photos were taken." />
        ) : photos.isError ? (
          <ErrorState title="Unable to load photo locations" description={getApiErrorMessage(photos.error, "Request failed")} onRetry={() => photos.refetch()} />
        ) : photos.data?.sitesWithLocation === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No site has a GPS location yet. Add the latitude and longitude for each site in Organization → Sites to turn this check on.
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              Photos in the last {photos.data?.days ?? 30} days taken outside the site radius. Vehicle jobs are not checked.
            </p>
            {(photos.data?.items ?? []).length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">All job photos were taken at their site.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Job</th>
                      <th className="px-3 py-2">Site</th>
                      <th className="px-3 py-2">Taken by</th>
                      <th className="px-3 py-2">When</th>
                      <th className="px-3 py-2">Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(photos.data?.items ?? []).map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{jobLink(row.workOrderId, row.woNumber)}</td>
                        <td className="px-3 py-2">{row.siteName}</td>
                        <td className="px-3 py-2">{row.uploadedByName ?? "—"}</td>
                        <td className="px-3 py-2">{when(row.takenAt)}</td>
                        <td className="px-3 py-2 font-semibold">
                          {formatDistance(row.distanceMeters)}
                          <span className="ml-1 text-xs font-normal text-slate-500">(allowed {formatDistance(row.allowedMeters)})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
