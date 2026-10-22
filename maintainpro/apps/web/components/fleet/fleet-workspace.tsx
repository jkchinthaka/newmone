"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, FileWarning, ShieldAlert, Truck, Wrench, type LucideIcon } from "lucide-react";

import { ActiveFilterChips, JobsEmptyState, JobsLoadingSkeleton, JobsPagination, OperationalJobsHeader } from "@/components/operational";
import { KpiCard, StatusBadge } from "@/components/ui/dashboard";
import { columnHasData, fleetDocumentBadge, fleetEnumLabel, fleetGateBadge, fleetServiceBadge, fleetUsageLabel } from "@/lib/batch-3-presentation";
import type { StatusTone } from "@/lib/dashboard-status";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { getFleetOverview, type FleetOverviewSummary } from "@/lib/fleet-lifecycle-api";
import {
  FLEET_EMPTY,
  FLEET_VIEWS,
  fleetKpiTarget,
  fleetSearch,
  fleetStateFromSearch,
  fleetVehicleHref,
  type FleetState,
  type FleetView
} from "@/lib/fleet-workspace";

type VehicleRow = {
  id: string;
  registrationNo: string;
  make?: string | null;
  vehicleModel?: string | null;
  year?: number | null;
  type?: string | null;
  fuelType?: string | null;
  status?: string | null;
  serviceStatus?: string | null;
  currentMileage?: number | string | null;
  nextServiceDate?: string | null;
  insuranceExpiry?: string | null;
  roadTaxExpiry?: string | null;
  gateBlocked?: boolean | null;
  location?: string | null;
  blocked?: boolean;
  blockedReasons?: string[];
};

type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };

const VIEW_LABELS: Record<FleetView, string> = {
  vehicles: "Vehicles",
  gate: "Gate",
  accidents: "Accidents",
  claims: "Claims",
  fines: "Traffic Fines",
  compliance: "Compliance"
};

function daysUntil(value?: string | null, now = new Date()) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function soonestDoc(row: VehicleRow) {
  const now = Date.now();
  const end = now + 30 * 24 * 60 * 60 * 1000;
  const options = [
    { type: "Insurance", at: row.insuranceExpiry },
    { type: "Road tax", at: row.roadTaxExpiry }
  ].filter((item) => item.at && new Date(item.at).getTime() >= now && new Date(item.at).getTime() <= end);
  options.sort((a, b) => new Date(a.at as string).getTime() - new Date(b.at as string).getTime());
  return options[0] ?? null;
}

export function FleetWorkspace() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const canRegisterVehicle = currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => fleetStateFromSearch(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [draftQuery, setDraftQuery] = useState(state.q);
  const [summary, setSummary] = useState<FleetOverviewSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [summaryAttempt, setSummaryAttempt] = useState(0);
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, pageSize: state.pageSize, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string[]>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setDraftQuery(state.q);
  }, [state.q]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draftQuery.trim() === state.q) return;
      write({ ...state, q: draftQuery.trim(), page: 1 });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftQuery]);

  function write(next: FleetState) {
    const query = fleetSearch(next);
    router.replace((query ? `${pathname}?${query}` : pathname) as never);
  }

  useEffect(() => {
    const controller = new AbortController();
    setSummaryLoading(true);
    setSummaryFailed(false);
    void getFleetOverview(controller.signal)
      .then((overview) => {
        if (controller.signal.aborted) return;
        setSummary(overview);
        setSummaryFailed(false);
        setSummaryLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || isCanceledRequest(cause)) return;
        setSummary(null);
        setSummaryFailed(true);
        setSummaryLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey, summaryAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        if (state.view === "gate" && state.gate) {
          const response = await apiClient.get("/vehicles/gate-queue", {
            signal: controller.signal,
            params: { state: state.gate, q: state.q || undefined, page: state.page, pageSize: state.pageSize }
          });
          const payload = response.data?.data ?? {};
          if (!controller.signal.aborted) {
            setRows(Array.isArray(payload.items) ? payload.items : []);
            setRecords([]);
            setMeta(payload.pagination ?? { page: state.page, pageSize: state.pageSize, total: 0, totalPages: 1 });
          }
        } else if (state.view === "vehicles" || state.view === "gate" || state.view === "compliance") {
          const response = await apiClient.get("/vehicles", {
            signal: controller.signal,
            params: {
              q: state.q || undefined,
              status: state.view === "vehicles" ? state.status || undefined : undefined,
              service: state.view === "vehicles" ? state.service || undefined : undefined,
              gate: state.view === "gate" ? state.gate || undefined : undefined,
              location: state.location || undefined,
              docs: state.view === "compliance" && state.expiry === "30d" ? "expiring" : undefined,
              page: state.page,
              pageSize: state.pageSize
            }
          });
          const payload = response.data?.data ?? {};
          if (!controller.signal.aborted) {
            setRows(Array.isArray(payload.items) ? payload.items : []);
            setRecords([]);
            setMeta(payload.pagination ?? { page: state.page, pageSize: state.pageSize, total: 0, totalPages: 1 });
          }
        } else {
          const path = state.view === "accidents" ? "/accidents" : state.view === "claims" ? "/insurance-claims" : "/traffic-fines";
          const response = await apiClient.get(path, {
            signal: controller.signal,
            params: {
              page: state.page,
              pageSize: state.pageSize,
              repair: state.view === "accidents" && state.repair === "open" ? "open" : undefined,
              status: state.view === "claims" ? state.claimStatus || undefined : undefined,
              paymentStatus: state.view === "fines" ? state.fineStatus || undefined : undefined,
              q: undefined
            }
          });
          if (!controller.signal.aborted) {
            setRows([]);
            setRecords(Array.isArray(response.data?.data) ? response.data.data : []);
            setMeta(response.data?.meta ?? { page: state.page, pageSize: state.pageSize, total: 0, totalPages: 1 });
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(getApiErrorMessage(err, "Unable to load fleet records."));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [state.view, state.q, state.status, state.service, state.gate, state.location, state.expiry, state.repair, state.claimStatus, state.fineStatus, state.page, state.pageSize, reloadKey]);

  useEffect(() => {
    if (state.service || state.gate || state.expiry || state.repair || state.status) {
      document.getElementById("fleet-results")?.scrollIntoView({ block: "start" });
    }
  }, [state.view, state.service, state.gate, state.expiry, state.repair, state.status]);

  const vehicleSearch = state.view === "vehicles" || state.view === "gate" || state.view === "compliance";
  const chips = [
    vehicleSearch && state.q ? { key: "q", label: `Search: ${state.q}` } : null,
    state.status ? { key: "status", label: state.status.replaceAll("_", " ") } : null,
    state.service ? { key: "service", label: `Service: ${state.service}` } : null,
    state.gate ? { key: "gate", label: state.gate === "blocked" ? "Blocked" : "Ready" } : null,
    state.location ? { key: "location", label: state.location } : null,
    state.expiry ? { key: "expiry", label: "Expiring in 30 days" } : null,
    state.repair ? { key: "repair", label: "Open repairs" } : null,
    state.claimStatus ? { key: "claimStatus", label: state.claimStatus } : null,
    state.fineStatus ? { key: "fineStatus", label: state.fineStatus } : null
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  async function openReasons(id: string) {
    if (reasons[id]) return;
    try {
      const response = await apiClient.get(`/vehicles/${id}/gate-block-reasons`);
      const result = response.data?.data as { blocked?: boolean; blockedReasons?: string[] };
      const next = result?.blockedReasons?.length ? result.blockedReasons : ["Ready to gate"];
      setReasons((current) => ({ ...current, [id]: next }));
    } catch (err) {
      setReasons((current) => ({ ...current, [id]: [getApiErrorMessage(err, "Unable to load the gate reason.")] }));
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <OperationalJobsHeader
        eyebrow="Fleet"
        title="Fleet"
        description="Vehicles, service due dates, documents and gate readiness."
        actions={
          <>
            <button type="button" className="h-9 rounded-md border border-slate-300 px-3 text-sm" onClick={() => setReloadKey((value) => value + 1)}>
              Refresh
            </button>
            {canRegisterVehicle ? (
              <Link href={"/admin/vehicles/new" as never} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm">
                Register vehicle
              </Link>
            ) : null}
          </>
        }
      />

      <div className="flex max-w-full gap-1 overflow-x-auto rounded-card border border-slate-200 bg-white p-1 shadow-card [contain:paint]" role="tablist" aria-label="Fleet sections">
        {FLEET_VIEWS.map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={state.view === view}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${state.view === view ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            onClick={() => write({ ...fleetStateFromSearch(new URLSearchParams()), view, pageSize: state.pageSize, expiry: view === "compliance" ? "30d" : "" })}
          >
            {VIEW_LABELS[view]}
          </button>
        ))}
      </div>

      <FleetSummaryChips
        summary={summary}
        loading={summaryLoading}
        failed={summaryFailed}
        onRetry={() => setSummaryAttempt((value) => value + 1)}
        onSelect={(key) => write(fleetKpiTarget(key, state.pageSize))}
      />

      <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <label className="sr-only" htmlFor="fleet-search">Search</label>
          <input
            id="fleet-search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder={vehicleSearch ? "Search registration, name, or code" : "Search applies on Vehicles, Gate, and Compliance"}
            disabled={!vehicleSearch}
            className="h-9 min-w-48 flex-1 rounded-md border border-slate-300 px-3 text-sm"
          />
          {state.view === "vehicles" ? (
            <>
              <select aria-label="Status" value={state.status} onChange={(event) => write({ ...state, status: event.target.value, page: 1 })} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
                <option value="">Status</option>
                {["AVAILABLE", "IN_USE", "UNDER_MAINTENANCE", "OUT_OF_SERVICE", "DISPOSED"].map((status) => (
                  <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                ))}
              </select>
              <select aria-label="Service state" value={state.service} onChange={(event) => write({ ...state, service: event.target.value as FleetState["service"], page: 1 })} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
                <option value="">Service state</option>
                <option value="overdue">Overdue</option>
                <option value="due-soon">Due soon</option>
                <option value="current">Current</option>
              </select>
            </>
          ) : null}
          {state.view === "gate" ? (
            <select aria-label="Gate readiness" value={state.gate} onChange={(event) => write({ ...state, gate: event.target.value as FleetState["gate"], page: 1 })} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
              <option value="">Gate readiness</option>
              <option value="ready">Ready</option>
              <option value="blocked">Blocked</option>
            </select>
          ) : null}
          {state.view === "fines" ? (
            <select aria-label="Fine status" value={state.fineStatus} onChange={(event) => write({ ...state, fineStatus: event.target.value, page: 1 })} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
              <option value="">Status</option>
              <option value="PENDING">Unpaid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PAID">Paid</option>
            </select>
          ) : null}
          <button type="button" className="h-9 rounded-md border border-slate-300 px-3 text-sm" aria-expanded={more} onClick={() => setMore((value) => !value)}>
            More filters
          </button>
          <button type="button" className="h-9 px-2 text-sm text-slate-700" onClick={() => write({ ...fleetStateFromSearch(new URLSearchParams()), view: state.view })}>
            Clear
          </button>
        </div>
        {more ? (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 px-3 py-2">
            <label className="text-sm text-slate-600">
              Location
              <input value={state.location} onChange={(event) => write({ ...state, location: event.target.value, page: 1 })} className="ml-2 h-9 rounded-md border border-slate-300 px-2" />
            </label>
          </div>
        ) : null}
        <ActiveFilterChips
          chips={chips}
          onRemove={(key) => write({ ...state, [key]: "", page: 1 })}
          onClearAll={() => write({ ...fleetStateFromSearch(new URLSearchParams()), view: state.view })}
        />

        <div id="fleet-results" className="max-w-full overflow-x-auto [contain:paint]">
          {loading ? <JobsLoadingSkeleton label="Loading fleet records" /> : null}
          {!loading && error ? (
            <div className="px-4 py-8 text-center text-sm">
              <p>{error}</p>
              <button type="button" className="mt-2 font-medium text-brand-700" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
            </div>
          ) : null}
          {!loading && !error && state.view === "vehicles" ? <VehicleTable rows={rows} menuId={menuId} setMenuId={setMenuId} /> : null}
          {!loading && !error && state.view === "gate" ? (
            <GateTable rows={rows} reasons={reasons} checked={Boolean(state.gate)} onOpen={(id) => void openReasons(id)} />
          ) : null}
          {!loading && !error && state.view === "compliance" ? <ComplianceTable rows={rows} /> : null}
          {!loading && !error && (state.view === "accidents" || state.view === "claims" || state.view === "fines") ? (
            <RecordTable view={state.view} rows={records} />
          ) : null}
          {!loading && !error && meta.total === 0 ? <JobsEmptyState title={FLEET_EMPTY} /> : null}
        </div>
        <JobsPagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          pageSize={state.pageSize}
          onPageChange={(page) => write({ ...state, page })}
          onPageSizeChange={(pageSize) => write({ ...state, pageSize, page: 1 })}
        />
      </div>
    </div>
  );
}

function VehicleTable({ rows, menuId, setMenuId }: { rows: VehicleRow[]; menuId: string | null; setMenuId: (id: string | null) => void }) {
  if (!rows.length) return null;
  const documentBadgeFor = (row: VehicleRow) =>
    fleetDocumentBadge([
      { label: "Insurance", at: row.insuranceExpiry },
      { label: "Road tax", at: row.roadTaxExpiry }
    ]);
  const showService = columnHasData(rows, (row) => fleetServiceBadge(row.nextServiceDate));
  const showDocuments = columnHasData(rows, documentBadgeFor);
  const showGate = columnHasData(rows, (row) => fleetGateBadge(row.gateBlocked));
  return (
    <div className="max-w-full overflow-x-auto [contain:paint]">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Vehicle</th>
            <th className="px-3 py-2">Type</th>
            <th className="hidden px-3 py-2 sm:table-cell">Fuel</th>
            <th className="px-3 py-2">Mileage</th>
            {showService ? <th className="px-3 py-2">Next service</th> : null}
            {showDocuments ? <th className="hidden px-3 py-2 md:table-cell">Documents</th> : null}
            {showGate ? <th className="px-3 py-2">Gate</th> : null}
            <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const service = fleetServiceBadge(row.nextServiceDate);
            const documents = documentBadgeFor(row);
            const gate = fleetGateBadge(row.gateBlocked);
            const usage = fleetUsageLabel(row.currentMileage);
            const type = fleetEnumLabel(row.type);
            const fuel = fleetEnumLabel(row.fuelType);
            const identity = [row.make, row.vehicleModel, row.year].filter(Boolean).join(" ");
            return (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <Link href={fleetVehicleHref(row.id) as never} className="font-medium text-slate-900">{row.registrationNo}</Link>
                  {identity ? <p className="text-xs text-slate-500">{identity}</p> : null}
                </td>
                <td className="px-3 py-2 text-slate-700">{type ?? "—"}</td>
                <td className="hidden px-3 py-2 text-slate-700 sm:table-cell">{fuel ?? "—"}</td>
                <td className="px-3 py-2 text-slate-700">{usage ?? "—"}</td>
                {showService ? <td className="px-3 py-2">{service ? <StatusBadge status={service.label} label={service.label} tone={service.tone} /> : <span className="text-slate-400">—</span>}</td> : null}
                {showDocuments ? <td className="hidden px-3 py-2 md:table-cell">{documents ? <StatusBadge status={documents.label} label={documents.label} tone={documents.tone} /> : <span className="text-slate-400">—</span>}</td> : null}
                {showGate ? <td className="px-3 py-2">{gate ? <StatusBadge status={gate.label} label={gate.label} tone={gate.tone} /> : <span className="text-slate-400">—</span>}</td> : null}
                <td className="relative px-3 py-2">
                  <button type="button" aria-label={`Actions for ${row.registrationNo}`} aria-expanded={menuId === row.id} onClick={() => setMenuId(menuId === row.id ? null : row.id)} className="h-8 w-8 rounded-md hover:bg-slate-100">⋯</button>
                  {menuId === row.id ? (
                    <div className="absolute right-2 z-10 w-44 rounded-md border border-slate-200 bg-white py-1 text-sm shadow">
                      <Link className="block px-3 py-1.5 hover:bg-slate-50" href={fleetVehicleHref(row.id) as never}>Open</Link>
                      <Link className="block px-3 py-1.5 hover:bg-slate-50" href={fleetVehicleHref(row.id) as never}>Edit</Link>
                      <Link className="block px-3 py-1.5 hover:bg-slate-50" href={"/maintenance/jobs/vehicle" as never}>Create Work Order</Link>
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GateTable({
  rows,
  reasons,
  checked,
  onOpen
}: {
  rows: VehicleRow[];
  reasons: Record<string, string[]>;
  checked: boolean;
  onOpen: (id: string) => void;
}) {
  if (!rows.length) return null;
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row) => {
        const listed = checked ? row.blockedReasons ?? [] : reasons[row.id];
        const blocked = checked ? row.blocked === true : listed ? listed.some((reason) => reason !== "Ready to gate") : false;
        const label = listed ? (blocked ? "Blocked" : "Ready") : "Not checked";
        return (
          <div key={row.id} className="px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={fleetVehicleHref(row.id) as never} className="font-medium">{row.registrationNo}</Link>
                <p className="text-xs text-slate-500">{row.make} {row.vehicleModel}</p>
              </div>
              <p className={blocked ? "font-medium text-red-700" : "text-slate-600"}>{label}</p>
              {listed ? null : (
                <button type="button" className="text-sm font-medium text-brand-700" onClick={() => onOpen(row.id)}>
                  Check readiness
                </button>
              )}
            </div>
            {listed?.length ? <ul className="mt-1 list-disc pl-5 text-slate-700">{listed.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
          </div>
        );
      })}
    </div>
  );
}

function ComplianceTable({ rows }: { rows: VehicleRow[] }) {
  if (!rows.length) return null;
  return (
    <table className="min-w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-3 py-2">Vehicle</th>
          <th className="px-3 py-2">Document</th>
          <th className="px-3 py-2">Expiry</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2">Days</th>
          <th className="px-3 py-2">Next action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const doc = soonestDoc(row);
          const days = daysUntil(doc?.at);
          return (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="px-3 py-2"><Link href={fleetVehicleHref(row.id) as never}>{row.registrationNo}</Link></td>
              <td className="px-3 py-2">{doc?.type ?? "—"}</td>
              <td className="px-3 py-2">{doc?.at ? new Date(doc.at).toLocaleDateString() : "—"}</td>
              <td className="px-3 py-2 font-medium text-amber-800">{doc ? "Expiring soon" : "—"}</td>
              <td className="px-3 py-2">{days ?? "—"}</td>
              <td className="px-3 py-2">Document expiry</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RecordTable({ view, rows }: { view: FleetView; rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return null;
  return (
    <table className="min-w-full text-sm">
      <tbody>
        {rows.map((row) => {
          const id = String(row.id ?? "");
          const vehicle = row.vehicle as { id?: string; registrationNo?: string } | undefined;
          const title = String(row.reportNumber ?? row.claimNumber ?? row.fineNumber ?? id);
          const register = view === "accidents" ? "/accidents" : view === "claims" ? "/insurance-claims" : "/traffic-fines";
          return (
            <tr key={id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium"><Link href={register as never}>{title}</Link></td>
              <td className="px-3 py-2">{vehicle?.id ? <Link href={fleetVehicleHref(String(vehicle.id)) as never}>{vehicle.registrationNo}</Link> : vehicle?.registrationNo ?? "—"}</td>
              <td className="px-3 py-2">{String(row.severity ?? row.status ?? row.paymentStatus ?? "")}</td>
              <td className="px-3 py-2 text-slate-600"><Link href={register as never}>Open register</Link></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const FLEET_SUMMARY_METRICS = [
  ["overdue", "Service overdue", "overdueService", AlertTriangle, "red"],
  ["due", "Due soon", "dueService", Clock, "amber"],
  ["docs", "Docs expiring", "expiringDocs", FileWarning, "amber"],
  ["gate", "Gate blocked", "blockedVehicles", ShieldAlert, "red"],
  ["repairs", "Open repairs", "openRepairs", Wrench, "sky"],
  ["out", "Out of service", "outOfService", Truck, "neutral"]
] as const satisfies ReadonlyArray<readonly [string, string, keyof FleetOverviewSummary, LucideIcon, StatusTone]>;

export function FleetSummaryChips({
  summary,
  loading,
  failed,
  onRetry,
  onSelect
}: {
  summary: FleetOverviewSummary | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onSelect: (metric: (typeof FLEET_SUMMARY_METRICS)[number][0]) => void;
}) {
  if (failed) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
        <p className="text-sm text-rose-800">{"Couldn't load fleet summary"}</p>
        <button type="button" className="h-9 rounded-md border border-rose-300 bg-white px-3 text-sm" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Fleet summary">
      {FLEET_SUMMARY_METRICS.map(([key, label, field, Icon, tone]) => {
        const count = summary ? summary[field] : null;
        const shown = loading || count == null ? "–" : String(count);
        const alert = typeof count === "number" && count > 0;
        return (
          <button
            key={key}
            type="button"
            className="rounded-card text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            onClick={() => onSelect(key)}
          >
            <KpiCard compact icon={Icon} label={label} tone={alert ? tone : "neutral"} value={shown} />
          </button>
        );
      })}
    </div>
  );
}

function isCanceledRequest(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; name?: string };
  return candidate.code === "ERR_CANCELED" || candidate.name === "CanceledError" || candidate.name === "AbortError";
}
