"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ActiveFilterChips, JobsEmptyState, JobsLoadingSkeleton, JobsPagination, OperationalJobsHeader } from "@/components/operational";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  GATE_EMPTY,
  gateActionForStatus,
  gateDeskFromSearch,
  gateDeskSearch,
  gateListStatus,
  gateMeterError,
  gatePresenceLabel,
  gateReasonHref,
  splitGateReasons,
  type GateDeskState
} from "@/lib/gate-operations";

type VehicleRow = {
  id: string;
  registrationNo: string;
  make?: string | null;
  vehicleModel?: string | null;
  status?: string | null;
  currentMileage?: number | string | null;
  assetTag?: string | null;
};

type GateReasons = { blocked: boolean; blockedReasons: string[] };

type Movement = {
  id: string;
  movementType?: string;
  status?: string;
  meterReading?: number | string | null;
  checkpoint?: string | null;
  occurredAt?: string;
  blockedReason?: string | null;
};

export function FleetGatePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => gateDeskFromSearch(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [draftQuery, setDraftQuery] = useState(state.q);
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: state.pageSize, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [reasons, setReasons] = useState<GateReasons | null>(null);
  const [reasonsError, setReasonsError] = useState<string | null>(null);
  const [meter, setMeter] = useState("");
  const [checkpoint, setCheckpoint] = useState("Main gate");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<Movement[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => setDraftQuery(state.q), [state.q]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draftQuery.trim() === state.q) return;
      write({ ...state, q: draftQuery.trim(), page: 1 });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftQuery, state]);

  function write(next: GateDeskState) {
    const query = gateDeskSearch(next);
    router.replace((query ? `${pathname}?${query}` : pathname) as never);
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void apiClient
      .get("/vehicles", {
        signal: controller.signal,
        params: {
          q: state.q || undefined,
          status: gateListStatus(state),
          service: state.service || undefined,
          location: state.location || undefined,
          page: state.page,
          pageSize: state.pageSize
        }
      })
      .then((response) => {
        const payload = response.data?.data ?? {};
        setRows(Array.isArray(payload.items) ? payload.items : []);
        setMeta(payload.pagination ?? { page: state.page, pageSize: state.pageSize, total: 0, totalPages: 1 });
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(err, "Unable to load vehicles."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [state.q, state.presence, state.status, state.service, state.location, state.page, state.pageSize, reloadKey]);

  const selectedOnPage = rows.find((row) => row.id === state.vehicleId) ?? null;
  const [selectedOffPage, setSelectedOffPage] = useState<VehicleRow | null>(null);
  const selected = selectedOnPage ?? (selectedOffPage?.id === state.vehicleId ? selectedOffPage : null);

  useEffect(() => {
    if (!state.vehicleId || rows.some((row) => row.id === state.vehicleId)) return;
    const controller = new AbortController();
    void apiClient.get(`/vehicles/${state.vehicleId}`, { signal: controller.signal }).then((response) => {
      setSelectedOffPage(response.data?.data ?? null);
    }).catch(() => setSelectedOffPage(null));
    return () => controller.abort();
  }, [state.vehicleId, rows]);

  useEffect(() => {
    if (!selected || gateActionForStatus(selected.status) !== "out") {
      setReasons(null);
      setReasonsError(null);
      if (selected) setMeter(String(Number(selected.currentMileage ?? 0)));
      return;
    }
    const controller = new AbortController();
    setReasons(null);
    setReasonsError(null);
    setMeter(String(Number(selected.currentMileage ?? 0)));
    void apiClient
      .get(`/vehicles/${selected.id}/gate-block-reasons`, { signal: controller.signal })
      .then((response) => setReasons(response.data?.data ?? { blocked: false, blockedReasons: [] }))
      .catch((err) => {
        if (!controller.signal.aborted) setReasonsError(getApiErrorMessage(err, "Unable to load gate readiness."));
      });
    return () => controller.abort();
  }, [selected?.id, selected?.status, reloadKey]);

  useEffect(() => {
    if (state.vehicleId) document.getElementById("gate-action")?.scrollIntoView({ block: "nearest" });
  }, [state.vehicleId]);

  const action = gateActionForStatus(selected?.status);
  const previous = Number(selected?.currentMileage ?? 0);
  const meterError = selected ? gateMeterError(meter, previous) : null;
  const outBlocked = action === "out" && (reasons?.blocked || Boolean(reasonsError));

  async function submit() {
    if (!selected || !action || submitting) return;
    const validation = gateMeterError(meter, Number(selected.currentMileage ?? 0));
    if (validation) {
      setNotice(validation);
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await apiClient.post(`/vehicles/${selected.id}/gate-${action}`, {
        meterReading: Number(meter),
        checkpoint: checkpoint.trim() || "Main gate"
      });
      const payload = response.data?.data ?? {};
      if (payload.blocked || payload.allowed === false) {
        setNotice(payload.blockedReason || "Gate out was blocked.");
        setReasons({ blocked: true, blockedReasons: splitGateReasons(payload.blockedReason) });
      } else {
        setNotice(action === "out" ? "Gate out recorded." : "Gate in recorded.");
        setReloadKey((value) => value + 1);
      }
    } catch (err) {
      setNotice(getApiErrorMessage(err, "Gate action failed."));
    } finally {
      setSubmitting(false);
    }
  }

  async function loadHistory() {
    if (!selected) return;
    try {
      const response = await apiClient.get(`/vehicles/${selected.id}/gate-movements`, { params: { limit: 8 } });
      const payload = response.data?.data;
      setHistory(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setNotice(getApiErrorMessage(err, "Unable to load gate history."));
    }
  }

  const chips = [
    state.q ? { key: "q", label: `Search: ${state.q}` } : null,
    state.presence ? { key: "presence", label: state.presence === "inside" ? "Inside" : "Outside" } : null,
    state.status ? { key: "status", label: state.status.replaceAll("_", " ") } : null,
    state.service ? { key: "service", label: "Service overdue" } : null,
    state.location ? { key: "location", label: state.location } : null
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  return (
    <div className="space-y-4">
      <OperationalJobsHeader
        eyebrow="Fleet"
        title="Fleet Gate Operations"
        description="Find a vehicle, check readiness, then record gate out or gate in. This screen does not override a block."
        actions={
          <>
            <button type="button" className="h-9 rounded-md border border-slate-300 px-3 text-sm" onClick={() => setReloadKey((value) => value + 1)}>Refresh</button>
            <button type="button" className="h-9 rounded-md border border-slate-300 px-3 text-sm" onClick={() => void loadHistory()} disabled={!selected}>Gate history</button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
            <label className="sr-only" htmlFor="gate-search">Search vehicle</label>
            <input id="gate-search" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Registration, code, model, or driver" className="h-9 min-w-48 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
            <select aria-label="Gate state" value={state.presence} onChange={(event) => write({ ...state, presence: event.target.value as GateDeskState["presence"], page: 1 })} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
              <option value="">Gate state</option>
              <option value="inside">Inside</option>
              <option value="outside">Outside</option>
            </select>
            <select aria-label="Availability" value={state.status} onChange={(event) => write({ ...state, status: event.target.value, page: 1 })} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
              <option value="">Availability</option>
              {["AVAILABLE", "IN_USE", "UNDER_MAINTENANCE", "OUT_OF_SERVICE", "DISPOSED"].map((status) => (
                <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
              ))}
            </select>
            <button type="button" className="h-9 rounded-md border border-slate-300 px-3 text-sm" aria-expanded={more} onClick={() => setMore((value) => !value)}>More filters</button>
            <button type="button" className="h-9 px-2 text-sm" onClick={() => write({ ...gateDeskFromSearch(new URLSearchParams()), vehicleId: state.vehicleId })}>Clear</button>
          </div>
          {more ? (
            <div className="flex flex-wrap gap-2 border-b border-slate-200 px-3 py-2">
              <label className="text-sm text-slate-600">Service
                <select aria-label="Service" value={state.service} onChange={(event) => write({ ...state, service: event.target.value as GateDeskState["service"], page: 1 })} className="ml-2 h-9 rounded-md border border-slate-300 px-2">
                  <option value="">Any</option>
                  <option value="overdue">Overdue</option>
                </select>
              </label>
              <label className="text-sm text-slate-600">Location
                <input value={state.location} onChange={(event) => write({ ...state, location: event.target.value, page: 1 })} className="ml-2 h-9 rounded-md border border-slate-300 px-2" />
              </label>
            </div>
          ) : null}
          <ActiveFilterChips chips={chips} onRemove={(key) => write({ ...state, [key]: "", page: 1 })} onClearAll={() => write({ ...gateDeskFromSearch(new URLSearchParams()), vehicleId: state.vehicleId })} />
          {loading ? <JobsLoadingSkeleton label="Loading vehicles" /> : null}
          {!loading && error ? (
            <div className="px-4 py-8 text-center text-sm">
              <p>{error}</p>
              <button type="button" className="mt-2 font-medium text-brand-700" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
            </div>
          ) : null}
          {!loading && !error && rows.length === 0 ? <JobsEmptyState title={GATE_EMPTY} /> : null}
          {!loading && !error && rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Registration</th>
                    <th className="px-3 py-2">Vehicle</th>
                    <th className="px-3 py-2">Availability</th>
                    <th className="px-3 py-2">Gate</th>
                    <th className="hidden px-3 py-2 md:table-cell">Odometer</th>
                    <th className="px-3 py-2">Next</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const next = gateActionForStatus(row.status);
                    return (
                      <tr key={row.id} aria-selected={row.id === state.vehicleId} className={`border-t border-slate-100 ${row.id === state.vehicleId ? "bg-brand-50" : ""}`}>
                        <td className="px-3 py-2">
                          <button type="button" className="font-medium text-slate-900" onClick={() => write({ ...state, vehicleId: row.id })}>{row.registrationNo}</button>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{[row.make, row.vehicleModel].filter(Boolean).join(" ") || row.assetTag || "Vehicle"}</td>
                        <td className="px-3 py-2">{row.status?.replaceAll("_", " ") || "—"}</td>
                        <td className="px-3 py-2">{gatePresenceLabel(row.status)}</td>
                        <td className="hidden px-3 py-2 md:table-cell">{row.currentMileage ?? "—"}</td>
                        <td className="px-3 py-2">{next === "out" ? "Gate out" : next === "in" ? "Gate in" : "Unavailable"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          <JobsPagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={state.pageSize} onPageChange={(page) => write({ ...state, page })} onPageSizeChange={(pageSize) => write({ ...state, pageSize, page: 1 })} />
        </section>

        <section id="gate-action" className="rounded-lg border border-slate-200 bg-white p-4" aria-live="polite">
          <h2 className="text-sm font-semibold text-slate-900">Gate action</h2>
          {!selected ? <p className="mt-3 text-sm text-slate-600">Select a vehicle.</p> : (
            <div className="mt-3 space-y-3 text-sm">
              <p><span className="text-slate-500">Registration </span><Link href={`/vehicles/${selected.id}` as never} className="font-medium">{selected.registrationNo}</Link></p>
              <p><span className="text-slate-500">Vehicle </span>{[selected.make, selected.vehicleModel].filter(Boolean).join(" ") || "—"}</p>
              <p><span className="text-slate-500">Odometer </span>{selected.currentMileage ?? "—"} km</p>
              <p><span className="text-slate-500">Gate </span>{gatePresenceLabel(selected.status)}</p>
              <p><span className="text-slate-500">Readiness </span>{reasonsError ? reasonsError : !reasons ? "Checking…" : reasons.blocked ? "Blocked" : "Ready"}</p>
              {reasons?.blocked ? (
                <div>
                  <p className="font-medium text-red-800">Cannot gate out</p>
                  <ul className="mt-1 list-disc pl-5">
                    {reasons.blockedReasons.map((reason) => {
                      const href = gateReasonHref(reason, selected.id, selected.registrationNo);
                      return <li key={reason}>{href ? <Link href={href as never}>{reason}</Link> : reason}</li>;
                    })}
                  </ul>
                </div>
              ) : null}
              <label className="block">Meter reading
                <input value={meter} onChange={(event) => setMeter(event.target.value)} inputMode="decimal" className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3" />
              </label>
              {meterError ? <p className="text-red-700">{meterError}</p> : null}
              <label className="block">Checkpoint
                <input value={checkpoint} onChange={(event) => setCheckpoint(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3" />
              </label>
              {action === "out" ? (
                <button type="button" disabled={submitting || Boolean(meterError) || outBlocked} onClick={() => void submit()} className="h-10 w-full rounded-md bg-slate-900 text-sm font-medium text-white disabled:opacity-50">
                  {submitting ? "Recording…" : "Gate out"}
                </button>
              ) : null}
              {action === "in" ? (
                <button type="button" disabled={submitting || Boolean(meterError)} onClick={() => void submit()} className="h-10 w-full rounded-md bg-slate-900 text-sm font-medium text-white disabled:opacity-50">
                  {submitting ? "Recording…" : "Gate in"}
                </button>
              ) : null}
              {!action ? <p>This status cannot gate in or gate out.</p> : null}
              {action === "out" ? <p className="text-xs text-slate-500">Gate in is hidden because the vehicle is inside.</p> : null}
              {action === "in" ? <p className="text-xs text-slate-500">Gate out is hidden because the vehicle is already outside.</p> : null}
              {notice ? <p className="font-medium">{notice}</p> : null}
              {history ? (
                <div id="gate-history">
                  <p className="font-medium">Recent movements</p>
                  <ul className="mt-1 space-y-1 text-xs text-slate-600">
                    {history.length === 0 ? <li>No gate movements yet.</li> : history.map((item) => (
                      <li key={item.id}>{item.movementType} · {item.status} · {item.checkpoint || "—"} · {item.meterReading ?? "—"} · {item.occurredAt ? new Date(item.occurredAt).toLocaleString() : ""}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
