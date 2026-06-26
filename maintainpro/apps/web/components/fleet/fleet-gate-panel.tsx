"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, InlineLoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

type VehicleRow = {
  id: string;
  registrationNo: string;
  vehicleModel?: string | null;
  make?: string | null;
  status?: string;
  currentMileage?: number;
};

type GateResult = {
  allowed?: boolean;
  blocked?: boolean;
  blockedReason?: string | null;
  movement?: { id?: string; status?: string };
};

export function FleetGatePanel() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [meterReading, setMeterReading] = useState("");
  const [checkpoint, setCheckpoint] = useState("Main gate");
  const [lastResult, setLastResult] = useState<GateResult | null>(null);
  const [submitting, setSubmitting] = useState<"out" | "in" | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: ["fleet-gate", "vehicles"],
    queryFn: async () => {
      const response = await apiClient.get<{ data: VehicleRow[] }>("/vehicles", { params: { limit: 100 } });
      const rows = response.data?.data;
      return Array.isArray(rows) ? rows : [];
    }
  });

  const filtered = useMemo(() => {
    const rows = vehiclesQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return rows;
    }

    return rows.filter((row) => {
      const haystack = [row.registrationNo, row.make, row.vehicleModel, row.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [vehiclesQuery.data, search]);

  const selected = filtered.find((row) => row.id === selectedId) ?? filtered[0] ?? null;

  async function runGate(action: "out" | "in") {
    if (!selected?.id) {
      toast.error("Select a vehicle first.");
      return;
    }

    const reading = Number(meterReading);
    if (!Number.isFinite(reading) || reading <= 0) {
      toast.error("Enter a valid meter reading.");
      return;
    }

    setSubmitting(action);
    try {
      const path = action === "out" ? `/vehicles/${selected.id}/gate-out` : `/vehicles/${selected.id}/gate-in`;
      const response = await apiClient.post<{ data: GateResult; message?: string }>(path, {
        meterReading: reading,
        checkpoint: checkpoint.trim() || "Main gate"
      });
      const payload = response.data?.data ?? {};
      setLastResult(payload);
      if (payload.blocked || payload.allowed === false) {
        toast.warning("Gate-out blocked", {
          description: payload.blockedReason ?? "Compliance or vehicle state blocked this movement."
        });
      } else {
        toast.success(response.data?.message ?? `Gate-${action} recorded`);
      }
      await vehiclesQuery.refetch();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Gate action failed"));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumbs />
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <div className="rounded-xl bg-brand-50 p-3 text-brand-700">
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Fleet gate operations</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Security officer gate-in and gate-out using live vehicle compliance checks. Blocked attempts are recorded
              with reasons — no override from this screen.
            </p>
          </div>
        </div>
      </header>

      {vehiclesQuery.isLoading ? (
        <InlineLoadingState label="Loading vehicles for gate lookup…" />
      ) : vehiclesQuery.isError ? (
        <ErrorState title="Could not load vehicles" error={vehiclesQuery.error} onRetry={() => vehiclesQuery.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-medium text-slate-700">
              Vehicle lookup
              <div className="relative mt-2">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search registration, model, status…"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
                />
              </div>
            </label>

            <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto" aria-label="Vehicle list">
              {filtered.length === 0 ? (
                <li className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No vehicles match this search.</li>
              ) : (
                filtered.map((vehicle) => (
                  <li key={vehicle.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(vehicle.id);
                        setMeterReading(String(Number(vehicle.currentMileage ?? 0) + 1));
                      }}
                      className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${
                        selected?.id === vehicle.id
                          ? "border-brand-400 bg-brand-50"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <p className="font-semibold text-slate-900">{vehicle.registrationNo}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[vehicle.make, vehicle.vehicleModel].filter(Boolean).join(" ") || "Vehicle"}
                        {vehicle.status ? ` · ${vehicle.status.replaceAll("_", " ")}` : ""}
                        {vehicle.currentMileage != null ? ` · ${vehicle.currentMileage} km` : ""}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Gate action</h2>
            {selected ? (
              <div className="mt-3 space-y-4">
                <p className="text-sm text-slate-700">
                  Selected: <span className="font-semibold text-slate-900">{selected.registrationNo}</span>
                </p>
                <label className="block text-sm text-slate-700">
                  <span className="font-medium">Meter reading</span>
                  <input
                    type="number"
                    min="1"
                    value={meterReading}
                    onChange={(event) => setMeterReading(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  <span className="font-medium">Checkpoint</span>
                  <input
                    value={checkpoint}
                    onChange={(event) => setCheckpoint(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={submitting !== null}
                    onClick={() => void runGate("out")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    <ArrowLeftRight size={16} aria-hidden="true" />
                    {submitting === "out" ? "Processing…" : "Gate out"}
                  </button>
                  <button
                    type="button"
                    disabled={submitting !== null}
                    onClick={() => void runGate("in")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {submitting === "in" ? "Processing…" : "Gate in"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">Select a vehicle to attempt gate movement.</p>
            )}

            {lastResult ? (
              <div
                className={`mt-4 rounded-lg border px-3 py-3 text-sm ${
                  lastResult.blocked || lastResult.allowed === false
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">
                      {lastResult.blocked || lastResult.allowed === false ? "Movement blocked" : "Movement recorded"}
                    </p>
                    {lastResult.blockedReason ? (
                      <p className="mt-1 text-xs opacity-90">{lastResult.blockedReason}</p>
                    ) : (
                      <p className="mt-1 text-xs opacity-90">Gate event persisted to vehicle movement history.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
