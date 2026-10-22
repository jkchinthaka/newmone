"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  listMaintenanceRequests,
  type MaintenanceRequestListItem
} from "@/lib/maintenance-requests-api";
import {
  REQUEST_TRACKER_LABELS,
  requestTrackerIndex,
  requesterFacingStatus
} from "@/lib/maintenance-request-ui";

export default function MyRequestsPage() {
  const [items, setItems] = useState<MaintenanceRequestListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listMaintenanceRequests({ mine: true, limit: 50 })
      .then((result) => {
        if (!cancelled) setItems(result.items);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(cause, "Couldn't load your requests."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My requests</h1>
        <p className="text-sm text-slate-600">Requests you submitted. This page is read-only.</p>
      </div>
      {loading ? <p className="text-sm text-slate-600">Loading requests...</p> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-slate-600">No requests yet.</p>
      ) : null}
      <ul className="space-y-3">
        {items.map((item) => {
          const current = requestTrackerIndex(item.status, item.workOrder?.status);
          return (
            <li key={item.id} className="rounded-card border border-slate-200 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <Link href={`/requests/${item.id}` as Route} className="font-medium text-brand-700">
                  {item.requestNumber}
                </Link>
                <span className="text-sm text-slate-600">{item.workOrder?.woNumber ?? "No work order yet"}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{item.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                {requesterFacingStatus(item.status, item.workOrder?.status)}
              </p>
              <ol className="mt-3 flex flex-wrap gap-2 text-xs">
                {REQUEST_TRACKER_LABELS.map((label, step) => (
                  <li
                    key={label}
                    className={
                      step === current
                        ? "rounded-full bg-brand-700 px-2 py-1 text-white"
                        : step < current
                          ? "text-brand-700"
                          : "text-slate-400"
                    }
                  >
                    {label}
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
