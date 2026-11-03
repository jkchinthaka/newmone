"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ButtonSpinner } from "@/components/ui/loading";
import { WORK_ORDERS_QUERY_KEY } from "@/components/work-orders/hooks";
import type { WorkOrderStatus } from "@/components/work-orders/types";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  fetchVehicleJobsOverview,
  serviceDueText,
  serviceJobPayload,
  type VehicleJobsOverview as Overview,
  type VehicleServiceDueRow
} from "@/lib/vehicle-jobs-overview";

const REFRESH_MS = 60_000;
const CREATE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"]);

type Card = { key: string; label: string; value: number; help: string; status?: WorkOrderStatus; tone: string };

/**
 * Vehicle Jobs header: workshop counts (press a card to filter the list) and vehicles whose
 * service is due soon or overdue, with "Create service job". Refreshes every minute.
 */
export function VehicleJobsOverview({ onFocus }: { onFocus: (status: WorkOrderStatus) => void }) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const canCreate = CREATE_ROLES.has(String(user.role ?? "").toUpperCase());

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setData(await fetchVehicleJobsOverview(signal));
      setError(null);
    } catch (cause) {
      if ((cause as { name?: string })?.name === "CanceledError") return;
      setError(getApiErrorMessage(cause, "Vehicle summary could not be loaded."));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  async function createServiceJob(row: VehicleServiceDueRow) {
    if (!user.id) return;
    setCreating(row.vehicleId);
    try {
      await apiClient.post("/work-orders", serviceJobPayload(row, user.id));
      toast.success(`Service job created for ${row.registrationNo}.`);
      await queryClient.invalidateQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
      await load();
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "The service job could not be created."));
    } finally {
      setCreating(null);
    }
  }

  if (error && !data) {
    return (
      <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {error}
      </p>
    );
  }
  if (!data) {
    return <div className="h-24 animate-pulse rounded-xl bg-slate-100" aria-label="Loading vehicle summary" />;
  }

  const counts = data.counts;
  const cards: Card[] = [
    { key: "workshop", label: "In the workshop", value: counts.inWorkshop, help: "Work started", status: "IN_PROGRESS", tone: "border-sky-200 bg-sky-50 text-sky-900" },
    { key: "waiting", label: "Waiting parts / vendor", value: counts.waitingPartsOrVendor, help: "On hold", status: "ON_HOLD", tone: "border-amber-200 bg-amber-50 text-amber-900" },
    { key: "check", label: "Waiting supervisor check", value: counts.waitingCheck, help: "Work done", status: "TECHNICIAN_COMPLETED", tone: "border-violet-200 bg-violet-50 text-violet-900" },
    { key: "offroad", label: "Vehicles off the road", value: counts.offRoad, help: "Under maintenance or out of service", tone: "border-rose-200 bg-rose-50 text-rose-900" },
    { key: "overdue", label: "Service overdue", value: counts.serviceOverdue, help: "Past date or km", tone: "border-rose-200 bg-white text-rose-900" },
    { key: "soon", label: "Service due soon", value: counts.serviceDueSoon, help: "7 days or 500 km", tone: "border-slate-200 bg-white text-slate-900" }
  ];

  return (
    <section className="space-y-3" aria-label="Vehicle summary">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => {
          const body = (
            <>
              <span className="block text-2xl font-semibold">{card.value}</span>
              <span className="block text-sm font-medium">{card.label}</span>
              <span className="block text-xs opacity-75">{card.help}</span>
            </>
          );
          return card.status ? (
            <button
              key={card.key}
              type="button"
              onClick={() => onFocus(card.status as WorkOrderStatus)}
              className={`min-h-11 rounded-xl border p-3 text-left hover:shadow-sm ${card.tone}`}
            >
              {body}
            </button>
          ) : (
            <div key={card.key} className={`rounded-xl border p-3 ${card.tone}`}>
              {body}
            </div>
          );
        })}
      </div>

      {data.serviceDue.length > 0 ? (
        <details className="rounded-xl border border-slate-200 bg-white" open={counts.serviceOverdue > 0}>
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
            Service due ({data.serviceDue.length})
          </summary>
          <ul className="divide-y divide-slate-100">
            {data.serviceDue.map((row) => (
              <li key={row.vehicleId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    <Link href={`/vehicles/${row.vehicleId}` as Route} className="hover:underline">
                      {row.registrationNo}
                    </Link>
                    {row.makeModel ? <span className="font-normal text-slate-600"> · {row.makeModel}</span> : null}
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className={row.state === "OVERDUE" ? "font-semibold text-rose-700" : "text-amber-800"}>
                      {row.state === "OVERDUE" ? "Overdue" : "Due soon"}: {serviceDueText(row)}
                    </span>
                    {row.currentMileage != null ? ` · ${Math.round(row.currentMileage).toLocaleString()} km now` : ""}
                    {row.driverName ? ` · Driver ${row.driverName}` : ""}
                  </p>
                </div>
                {row.openServiceJob ? (
                  <Link
                    href={`/work-orders?wo=${row.openServiceJob.id}` as Route}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700"
                  >
                    Open {row.openServiceJob.woNumber}
                  </Link>
                ) : canCreate ? (
                  <button
                    type="button"
                    disabled={creating === row.vehicleId}
                    onClick={() => void createServiceJob(row)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {creating === row.vehicleId ? <ButtonSpinner /> : null}
                    Create service job
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
