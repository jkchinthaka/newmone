"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, ShieldX, RefreshCw, FileWarning, Truck } from "lucide-react";

import { STICKY_TABLE_CLASS } from "@/components/fleet/fleet-register";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ButtonSpinner, RefreshingNote, TableLoadingRows } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/page-state";
import { formatEnumLabel } from "@/lib/display-labels";
import { fleetVehicleHref } from "@/lib/fleet-workspace";
import { formatDate } from "@/lib/localization";
import { p4Get } from "@/lib/phase4-api";

interface Summary {
  total: number;
  compliant: number;
  attention: number;
  nonCompliant: number;
  notAssessed?: number;
}

interface ExpiringDoc {
  id: string;
  documentType: string;
  documentNumber?: string | null;
  expiryDate: string;
  status: string;
  vehicle?: { id: string; registrationNo: string; make: string; vehicleModel: string };
}

const DOC_COLUMNS: DataTableColumn<ExpiringDoc>[] = [
  {
    id: "vehicle",
    header: "Vehicle",
    cell: (doc) => (
      <>
        {doc.vehicle?.id ? (
          <Link href={fleetVehicleHref(doc.vehicle.id) as never} className="font-medium text-slate-900 underline-offset-2 hover:underline">
            {doc.vehicle.registrationNo}
          </Link>
        ) : (
          <span className="font-medium text-slate-900">{doc.vehicle?.registrationNo ?? "—"}</span>
        )}
        {doc.vehicle ? <p className="text-xs text-slate-500">{[doc.vehicle.make, doc.vehicle.vehicleModel].filter(Boolean).join(" ")}</p> : null}
      </>
    )
  },
  { id: "type", header: "Document", cell: (doc) => formatEnumLabel(doc.documentType) },
  { id: "number", header: "Number", cell: (doc) => doc.documentNumber ?? "—", hideOnMobile: true },
  { id: "expiry", header: "Expiry", cell: (doc) => formatDate(doc.expiryDate) },
  {
    id: "status",
    header: "Status",
    cell: () => (
      <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Expiring</span>
    )
  }
];

export default function CompliancePage() {
  const [days, setDays] = useState(30);

  const summaryQuery = useQuery({
    queryKey: ["compliance", "summary"],
    queryFn: () => p4Get<Summary>("/compliance/summary")
  });
  const docsQuery = useQuery({
    queryKey: ["compliance", "expiring-documents", days],
    queryFn: () => p4Get<ExpiringDoc[]>("/compliance/expiring-documents", { days }),
    placeholderData: keepPreviousData
  });

  const refreshing = summaryQuery.isFetching || docsQuery.isFetching;
  const docs = docsQuery.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Vehicle Compliance</h1>
          <p className="text-sm text-slate-600">
            Fleet-wide compliance status and upcoming document expirations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void summaryQuery.refetch();
            void docsQuery.refetch();
          }}
          disabled={refreshing}
          aria-busy={refreshing}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {refreshing ? <ButtonSpinner /> : <RefreshCw aria-hidden size={14} />}
          Refresh
        </button>
      </header>

      {summaryQuery.isError && !summaryQuery.data ? (
        <ErrorState title="Couldn't load the compliance summary" error={summaryQuery.error} onRetry={() => void summaryQuery.refetch()} />
      ) : (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5" aria-busy={summaryQuery.isPending}>
          <SummaryCard label="Total Vehicles" value={summaryQuery.data?.total} icon={<Truck size={18} />} tone="bg-slate-100 text-slate-700" />
          <SummaryCard label="Compliant" value={summaryQuery.data?.compliant} icon={<CheckCircle2 size={18} />} tone="bg-emerald-100 text-emerald-700" />
          <SummaryCard label="Attention Required" value={summaryQuery.data?.attention} icon={<AlertTriangle size={18} />} tone="bg-amber-100 text-amber-700" />
          <SummaryCard label="Non-Compliant" value={summaryQuery.data?.nonCompliant} icon={<ShieldX size={18} />} tone="bg-rose-100 text-rose-700" />
          <SummaryCard label="Not Assessed" value={summaryQuery.data?.notAssessed ?? (summaryQuery.data ? 0 : undefined)} icon={<FileWarning size={18} />} tone="bg-sky-100 text-sky-700" />
        </section>
      )}

      <section className="space-y-2">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2">
            <FileWarning aria-hidden size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-slate-900">Documents expiring within</span>
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value) || 30)}
              className="min-h-11 rounded-md border border-slate-200 bg-white px-2 text-sm"
            >
              <option value={7}>7 days</option>
              <option value={15}>15 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          {docsQuery.isFetching && docs ? <RefreshingNote /> : docs ? <span className="text-xs text-slate-500">{docs.length} document(s)</span> : null}
        </header>
        {docsQuery.isError ? (
          <ErrorState title="Couldn't load expiring documents" error={docsQuery.error} onRetry={() => void docsQuery.refetch()} />
        ) : !docs ? (
          <section className="rounded-xl border border-slate-200 bg-white">
            <TableLoadingRows label="Loading expiring documents" />
          </section>
        ) : (
          <DataTable
            rows={docs}
            columns={DOC_COLUMNS}
            getRowId={(doc) => doc.id}
            ariaLabel="Expiring documents"
            emptyTitle="No documents expiring in this window."
            className={STICKY_TABLE_CLASS}
          />
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <span aria-hidden className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${tone}`}>
          {icon}
        </span>
      </div>
      {/* Never a fake 0 while loading or after a failed load. */}
      <p className="mt-2 page-title">{value == null ? "–" : value}</p>
    </div>
  );
}
