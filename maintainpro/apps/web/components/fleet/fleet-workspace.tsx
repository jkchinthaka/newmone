"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, FileWarning, Truck, Wrench, type LucideIcon } from "lucide-react";

import { STICKY_TABLE_CLASS } from "@/components/fleet/fleet-register";
import { RowActionsMenu } from "@/components/fleet/row-actions-menu";
import { ActiveFilterChips, JobsEmptyState, JobsPagination, OperationalJobsHeader } from "@/components/operational";
import { KpiCard, StatusBadge } from "@/components/ui/dashboard";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ButtonSpinner, RefreshingNote, TableLoadingRows } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/page-state";
import { columnHasData, fleetDocumentBadge, fleetGateBadge, fleetServiceBadge, fleetUsageLabel } from "@/lib/batch-3-presentation";
import type { StatusTone } from "@/lib/dashboard-status";
import { apiClient } from "@/lib/api-client";
import { formatEnumLabel } from "@/lib/display-labels";
import { registerRecordHref } from "@/lib/fleet-register";
import { formatCurrency, formatDate } from "@/lib/localization";
import { useCurrentUser } from "@/lib/use-current-user";
import { getFleetOverview, type FleetOverviewSummary } from "@/lib/fleet-lifecycle-api";
import {
  FLEET_EMPTY,
  FLEET_VIEWS,
  fleetKpiTarget,
  fleetSearch,
  fleetStateFromSearch,
  fleetVehicleHref,
  type FleetKpiMetric,
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
};

type RecordRow = Record<string, unknown>;

type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };

type FleetListResult = { view: FleetView; vehicles: VehicleRow[]; records: RecordRow[]; meta: PageMeta };

const VIEW_LABELS: Record<FleetView, string> = {
  vehicles: "Vehicles",
  accidents: "Accidents",
  claims: "Claims",
  fines: "Traffic Fines",
  compliance: "Compliance"
};

const FILTER_INPUT_CLASS = "min-h-11 rounded-md border border-slate-300 px-2 text-sm sm:min-h-9";
const TOOLBAR_BUTTON_CLASS = "inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm sm:min-h-9";

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

function fallbackMeta(state: FleetState): PageMeta {
  return { page: state.page, pageSize: state.pageSize, total: 0, totalPages: 1 };
}

async function fetchFleetList(state: FleetState, signal: AbortSignal): Promise<FleetListResult> {
  if (state.view === "vehicles" || state.view === "compliance") {
    const response = await apiClient.get("/vehicles", {
      signal,
      params: {
        q: state.q || undefined,
        status: state.view === "vehicles" ? state.status || undefined : undefined,
        service: state.view === "vehicles" ? state.service || undefined : undefined,
        location: state.location || undefined,
        docs: state.view === "compliance" && state.expiry === "30d" ? "expiring" : undefined,
        page: state.page,
        pageSize: state.pageSize
      }
    });
    const payload = response.data?.data ?? {};
    return {
      view: state.view,
      vehicles: Array.isArray(payload.items) ? payload.items : [],
      records: [],
      meta: payload.pagination ?? fallbackMeta(state)
    };
  }
  const path = state.view === "accidents" ? "/accidents" : state.view === "claims" ? "/insurance-claims" : "/traffic-fines";
  const response = await apiClient.get(path, {
    signal,
    params: {
      page: state.page,
      pageSize: state.pageSize,
      repair: state.view === "accidents" && state.repair === "open" ? "open" : undefined,
      status: state.view === "claims" ? state.claimStatus || undefined : undefined,
      paymentStatus: state.view === "fines" ? state.fineStatus || undefined : undefined
    }
  });
  return {
    view: state.view,
    vehicles: [],
    records: Array.isArray(response.data?.data) ? response.data.data : [],
    meta: response.data?.meta ?? fallbackMeta(state)
  };
}

export function FleetWorkspace() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const canRegisterVehicle = currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => fleetStateFromSearch(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [draftQuery, setDraftQuery] = useState(state.q);
  const [draftLocation, setDraftLocation] = useState(state.location);
  const [more, setMore] = useState(Boolean(state.location));

  function write(next: FleetState) {
    const query = fleetSearch(next);
    router.replace((query ? `${pathname}?${query}` : pathname) as never, { scroll: false });
  }

  useEffect(() => {
    setDraftQuery(state.q);
  }, [state.q]);

  useEffect(() => {
    setDraftLocation(state.location);
  }, [state.location]);

  // Typing never fires a request per keystroke: search and location wait for a pause.
  useEffect(() => {
    const q = draftQuery.trim();
    const location = draftLocation.trim();
    if (q === state.q && location === state.location) return;
    const timer = window.setTimeout(() => write({ ...state, q, location, page: 1 }), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQuery, draftLocation]);

  const summaryQuery = useQuery({
    queryKey: ["fleet-lifecycle", "overview"],
    queryFn: ({ signal }) => getFleetOverview(signal)
  });

  const listQuery = useQuery({
    queryKey: ["fleet-workspace", "list", state],
    queryFn: ({ signal }) => fetchFleetList(state, signal),
    // Keep the current rows and pager on screen while the next page or filter loads,
    // but never show one tab's rows under another tab.
    placeholderData: (previous) => (previous?.view === state.view ? previous : undefined)
  });

  const list = listQuery.data?.view === state.view ? listQuery.data : undefined;
  const meta = list?.meta ?? fallbackMeta(state);

  useEffect(() => {
    if (state.service || state.expiry || state.repair || state.status) {
      document.getElementById("fleet-results")?.scrollIntoView({ block: "start" });
    }
  }, [state.view, state.service, state.expiry, state.repair, state.status]);

  const vehicleSearch = state.view === "vehicles" || state.view === "compliance";
  const chips = [
    vehicleSearch && state.q ? { key: "q", label: `Search: ${state.q}` } : null,
    state.status ? { key: "status", label: formatEnumLabel(state.status) } : null,
    state.service ? { key: "service", label: `Service: ${state.service}` } : null,
    state.location ? { key: "location", label: state.location } : null,
    state.expiry ? { key: "expiry", label: "Expiring in 30 days" } : null,
    state.repair ? { key: "repair", label: "Open repairs" } : null,
    state.claimStatus ? { key: "claimStatus", label: formatEnumLabel(state.claimStatus) } : null,
    state.fineStatus ? { key: "fineStatus", label: formatEnumLabel(state.fineStatus) } : null
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  const refreshing = listQuery.isFetching || summaryQuery.isFetching;

  return (
    <div className="min-w-0 space-y-4">
      <OperationalJobsHeader
        eyebrow="Fleet"
        title="Fleet"
        description="Vehicles, service due dates, documents, accidents and fines."
        actions={
          <>
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASS}
              disabled={refreshing}
              aria-busy={refreshing}
              onClick={() => {
                void listQuery.refetch();
                void summaryQuery.refetch();
              }}
            >
              {refreshing ? <ButtonSpinner /> : null}
              Refresh
            </button>
            {canRegisterVehicle ? (
              <Link href={"/admin/vehicles/new" as never} className={TOOLBAR_BUTTON_CLASS}>
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
            className={`min-h-11 whitespace-nowrap rounded-lg px-3 text-sm font-medium sm:min-h-9 ${state.view === view ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            onClick={() => write({ ...fleetStateFromSearch(new URLSearchParams()), view, pageSize: state.pageSize, expiry: view === "compliance" ? "30d" : "" })}
          >
            {VIEW_LABELS[view]}
          </button>
        ))}
      </div>

      <FleetSummaryChips
        summary={summaryQuery.data ?? null}
        loading={summaryQuery.isPending}
        failed={summaryQuery.isError && !summaryQuery.data}
        onRetry={() => void summaryQuery.refetch()}
        onSelect={(key) => write(fleetKpiTarget(key, state.pageSize))}
      />

      <div className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <label className="sr-only" htmlFor="fleet-search">Search</label>
          <input
            id="fleet-search"
            type="search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder={vehicleSearch ? "Search registration, name, or code" : "Search applies on Vehicles and Compliance"}
            disabled={!vehicleSearch}
            className={`${FILTER_INPUT_CLASS} min-w-48 flex-1 px-3`}
          />
          {state.view === "vehicles" ? (
            <>
              <select aria-label="Status" value={state.status} onChange={(event) => write({ ...state, status: event.target.value, page: 1 })} className={FILTER_INPUT_CLASS}>
                <option value="">Status</option>
                {["AVAILABLE", "IN_USE", "UNDER_MAINTENANCE", "OUT_OF_SERVICE", "DISPOSED"].map((status) => (
                  <option key={status} value={status}>{formatEnumLabel(status)}</option>
                ))}
              </select>
              <select aria-label="Service state" value={state.service} onChange={(event) => write({ ...state, service: event.target.value as FleetState["service"], page: 1 })} className={FILTER_INPUT_CLASS}>
                <option value="">Service state</option>
                <option value="overdue">Overdue</option>
                <option value="due-soon">Due soon</option>
                <option value="current">Current</option>
              </select>
            </>
          ) : null}
          {state.view === "fines" ? (
            <select aria-label="Fine status" value={state.fineStatus} onChange={(event) => write({ ...state, fineStatus: event.target.value, page: 1 })} className={FILTER_INPUT_CLASS}>
              <option value="">Status</option>
              <option value="PENDING">Unpaid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PAID">Paid</option>
            </select>
          ) : null}
          {vehicleSearch ? (
            <button type="button" className={TOOLBAR_BUTTON_CLASS} aria-expanded={more} onClick={() => setMore((value) => !value)}>
              More filters
            </button>
          ) : null}
          <button type="button" className="min-h-11 px-2 text-sm text-slate-700 sm:min-h-9" onClick={() => write({ ...fleetStateFromSearch(new URLSearchParams()), view: state.view })}>
            Clear
          </button>
          {list && listQuery.isFetching ? <RefreshingNote /> : null}
        </div>
        {more && vehicleSearch ? (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 px-3 py-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Location
              <input value={draftLocation} onChange={(event) => setDraftLocation(event.target.value)} className={FILTER_INPUT_CLASS} />
            </label>
          </div>
        ) : null}
        <ActiveFilterChips
          chips={chips}
          onRemove={(key) => write({ ...state, [key]: "", page: 1 })}
          onClearAll={() => write({ ...fleetStateFromSearch(new URLSearchParams()), view: state.view })}
        />

        <div id="fleet-results" className="min-w-0 max-w-full">
          {!list && listQuery.isError ? (
            <div className="p-3">
              <ErrorState title="Couldn't load fleet records" error={listQuery.error} onRetry={() => void listQuery.refetch()} />
            </div>
          ) : null}
          {!list && !listQuery.isError ? <TableLoadingRows label="Loading fleet records" /> : null}
          {list && listQuery.isError ? (
            <div className="p-3">
              <ErrorState title="Couldn't refresh fleet records" error={listQuery.error} onRetry={() => void listQuery.refetch()} />
            </div>
          ) : null}
          {list && !listQuery.isError ? (
            <>
              {state.view === "vehicles" ? <VehicleTable rows={list.vehicles} /> : null}
              {state.view === "compliance" ? <ComplianceTable rows={list.vehicles} /> : null}
              {state.view === "accidents" || state.view === "claims" || state.view === "fines" ? (
                <RecordTable view={state.view} rows={list.records} />
              ) : null}
              {meta.total === 0 ? <JobsEmptyState title={FLEET_EMPTY} /> : null}
            </>
          ) : null}
        </div>
        {list && !listQuery.isError && meta.total > 0 ? (
          <JobsPagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={state.pageSize}
            onPageChange={(page) => write({ ...state, page })}
            onPageSizeChange={(pageSize) => write({ ...state, pageSize, page: 1 })}
          />
        ) : null}
      </div>
    </div>
  );
}

const BARE_TABLE_CLASS = `!rounded-none !border-0 !shadow-none ${STICKY_TABLE_CLASS}`;

function badge(value: { label: string; tone: StatusTone } | null) {
  return value ? <StatusBadge status={value.label} label={value.label} tone={value.tone} /> : <span className="text-slate-400">—</span>;
}

function VehicleTable({ rows }: { rows: VehicleRow[] }) {
  if (!rows.length) return null;
  const documentBadgeFor = (row: VehicleRow) =>
    fleetDocumentBadge([
      { label: "Insurance", at: row.insuranceExpiry },
      { label: "Road tax", at: row.roadTaxExpiry }
    ]);
  const showService = columnHasData(rows, (row) => fleetServiceBadge(row.nextServiceDate));
  const showDocuments = columnHasData(rows, documentBadgeFor);
  const showGate = columnHasData(rows, (row) => fleetGateBadge(row.gateBlocked));
  const columns: DataTableColumn<VehicleRow>[] = [
    {
      id: "vehicle",
      header: "Vehicle",
      cell: (row) => {
        const identity = [row.make, row.vehicleModel, row.year].filter(Boolean).join(" ");
        return (
          <>
            <Link href={fleetVehicleHref(row.id) as never} className="font-medium text-slate-900 underline-offset-2 hover:underline">{row.registrationNo}</Link>
            {identity ? <p className="text-xs text-slate-500">{identity}</p> : null}
          </>
        );
      }
    },
    { id: "type", header: "Type", cell: (row) => formatEnumLabel(row.type) },
    { id: "fuel", header: "Fuel", cell: (row) => formatEnumLabel(row.fuelType), hideOnMobile: true },
    { id: "mileage", header: "Mileage", cell: (row) => fleetUsageLabel(row.currentMileage) ?? "—" },
    ...(showService ? [{ id: "service", header: "Next service", cell: (row: VehicleRow) => badge(fleetServiceBadge(row.nextServiceDate)) }] : []),
    ...(showDocuments ? [{ id: "documents", header: "Documents", cell: (row: VehicleRow) => badge(documentBadgeFor(row)) }] : []),
    ...(showGate ? [{ id: "gate", header: "Gate", cell: (row: VehicleRow) => badge(fleetGateBadge(row.gateBlocked)), hideOnMobile: true }] : [])
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      ariaLabel="Vehicles"
      minWidth="720px"
      className={BARE_TABLE_CLASS}
      actionsHeader={<span className="sr-only">Actions</span>}
      renderActions={(row) => (
        <RowActionsMenu
          label={`Actions for ${row.registrationNo}`}
          actions={[
            { label: "Open", href: fleetVehicleHref(row.id) },
            { label: "Edit", href: fleetVehicleHref(row.id) },
            { label: "Create work order", href: "/maintenance/jobs/vehicle" }
          ]}
        />
      )}
    />
  );
}

function ComplianceTable({ rows }: { rows: VehicleRow[] }) {
  if (!rows.length) return null;
  const columns: DataTableColumn<VehicleRow>[] = [
    {
      id: "vehicle",
      header: "Vehicle",
      cell: (row) => <Link href={fleetVehicleHref(row.id) as never} className="font-medium text-slate-900 underline-offset-2 hover:underline">{row.registrationNo}</Link>
    },
    { id: "document", header: "Document", cell: (row) => soonestDoc(row)?.type ?? "—" },
    { id: "expiry", header: "Expiry", cell: (row) => formatDate(soonestDoc(row)?.at) },
    { id: "status", header: "Status", cell: (row) => (soonestDoc(row) ? <span className="font-medium text-amber-800">Expiring soon</span> : "—") },
    { id: "days", header: "Days left", cell: (row) => daysUntil(soonestDoc(row)?.at) ?? "—" },
    { id: "next", header: "Next action", cell: () => "Renew document", hideOnMobile: true }
  ];
  return <DataTable rows={rows} columns={columns} getRowId={(row) => row.id} ariaLabel="Compliance" minWidth="720px" className={BARE_TABLE_CLASS} />;
}

const RECORD_REGISTERS = {
  accidents: "/accidents",
  claims: "/insurance-claims",
  fines: "/traffic-fines"
} as const;

function recordAmount(view: FleetView, row: RecordRow): string {
  const raw =
    view === "accidents"
      ? row.actualDamageCost ?? row.estimatedDamageCost
      : view === "claims"
        ? row.claimAmount
        : row.fineAmount;
  return formatCurrency(raw as number | string | null | undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

function RecordTable({ view, rows }: { view: "accidents" | "claims" | "fines"; rows: RecordRow[] }) {
  if (!rows.length) return null;
  const register = RECORD_REGISTERS[view];
  const titleOf = (row: RecordRow) => String(row.reportNumber ?? row.claimNumber ?? row.fineNumber ?? row.id ?? "");
  const dateOf = (row: RecordRow) => (row.occurredAt ?? row.filedAt ?? row.fineDate ?? row.createdAt) as string | null | undefined;
  const statusOf = (row: RecordRow) => String((view === "fines" ? row.paymentStatus : row.status) ?? "");
  const columns: DataTableColumn<RecordRow>[] = [
    {
      id: "record",
      header: view === "accidents" ? "Report" : view === "claims" ? "Claim" : "Fine",
      cell: (row) => (
        <Link href={registerRecordHref(register, String(row.id ?? "")) as never} className="font-medium text-slate-900 underline-offset-2 hover:underline">
          {titleOf(row)}
        </Link>
      )
    },
    {
      id: "vehicle",
      header: "Vehicle",
      cell: (row) => {
        const vehicle = row.vehicle as { id?: string; registrationNo?: string } | undefined;
        const vehicleId = vehicle?.id ?? (row.vehicleId as string | undefined);
        return vehicleId && vehicle?.registrationNo ? (
          <Link href={fleetVehicleHref(String(vehicleId)) as never} className="underline-offset-2 hover:underline">{vehicle.registrationNo}</Link>
        ) : (
          vehicle?.registrationNo ?? "—"
        );
      }
    },
    { id: "date", header: view === "accidents" ? "Occurred" : view === "claims" ? "Filed" : "Fine date", cell: (row) => formatDate(dateOf(row)) },
    ...(view === "accidents"
      ? [{ id: "severity", header: "Severity", cell: (row: RecordRow) => formatEnumLabel(row.severity as string | undefined) }]
      : []),
    { id: "status", header: view === "fines" ? "Payment" : "Status", cell: (row) => formatEnumLabel(statusOf(row)) },
    { id: "amount", header: "Amount", cell: (row) => recordAmount(view, row), className: "text-right", headerClassName: "text-right" }
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={(row) => String(row.id ?? titleOf(row))}
      ariaLabel={VIEW_LABELS[view]}
      minWidth="720px"
      className={BARE_TABLE_CLASS}
    />
  );
}

const FLEET_SUMMARY_METRICS = [
  ["overdue", "Service overdue", "overdueService", AlertTriangle, "red"],
  ["due", "Due soon", "dueService", Clock, "amber"],
  ["docs", "Docs expiring", "expiringDocs", FileWarning, "amber"],
  ["repairs", "Open repairs", "openRepairs", Wrench, "sky"],
  ["out", "Out of service", "outOfService", Truck, "neutral"]
] as const satisfies ReadonlyArray<readonly [FleetKpiMetric, string, keyof FleetOverviewSummary, LucideIcon, StatusTone]>;

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
  onSelect: (metric: FleetKpiMetric) => void;
}) {
  if (failed) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
        <p className="text-sm text-rose-800">{"Couldn't load fleet summary"}</p>
        <button type="button" className="min-h-11 rounded-md border border-rose-300 bg-white px-3 text-sm sm:min-h-9" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Fleet summary" aria-busy={loading}>
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
