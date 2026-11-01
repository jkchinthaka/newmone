"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DateField } from "@/components/forms/date-fields";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EntityPicker } from "@/components/ui/entity-picker";
import { ButtonSpinner, TableLoadingRows } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/page-state";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { getApiErrorMessage } from "@/lib/api-client";
import { colomboTodayYmd } from "@/lib/colombo-datetime";
import { getStoredRole } from "@/lib/user-role";
import { formatDate } from "@/lib/localization";
import {
  CERTIFICATE_STATE_LABEL,
  CERTIFICATE_WRITE_ROLES,
  addMonthsYmd,
  createCertificate,
  daysLeftText,
  expiryIso,
  getCertificateSummary,
  listCertificateTypes,
  listCertificates,
  removeCertificate,
  renewCertificate,
  type CertificateRow,
  type CertificateState
} from "@/lib/statutory-certificates";

type AssetOption = { id: string; name: string; assetTag?: string } & Record<string, unknown>;

const STATE_TONE: Record<CertificateState, string> = {
  VALID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DUE_SOON: "border-amber-200 bg-amber-50 text-amber-800",
  EXPIRED: "border-rose-200 bg-rose-50 text-rose-700"
};

export function StatutoryCertificates() {
  const queryClient = useQueryClient();
  const canEdit = CERTIFICATE_WRITE_ROLES.includes(getStoredRole());
  const { confirm, dialog } = useConfirmDialog();
  const [filter, setFilter] = useState<CertificateState | "">("");
  const [adding, setAdding] = useState(false);
  const [renewId, setRenewId] = useState<string | null>(null);

  const rowsQuery = useQuery({
    queryKey: ["compliance", "certificates", filter],
    queryFn: () => listCertificates(filter || undefined),
    placeholderData: keepPreviousData
  });
  const summaryQuery = useQuery({ queryKey: ["compliance", "certificates", "summary"], queryFn: getCertificateSummary });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["compliance", "certificates"] });

  const removeMutation = useMutation({
    mutationFn: removeCertificate,
    onSuccess: () => {
      toast.success("Certificate removed.");
      refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not remove the certificate."))
  });

  const columns: DataTableColumn<CertificateRow>[] = [
    {
      id: "asset",
      header: "Machine / equipment",
      cell: (row) => (
        <>
          <span className="font-medium text-slate-900">{row.assetName ?? "—"}</span>
          {row.assetTag ? <p className="text-xs text-slate-500">{row.assetTag}</p> : null}
        </>
      )
    },
    { id: "type", header: "Certificate", cell: (row) => row.typeLabel },
    { id: "provider", header: "Done by", cell: (row) => row.providerName ?? "—", hideOnMobile: true },
    {
      id: "expires",
      header: "Expires",
      cell: (row) => (
        <>
          {formatDate(row.expiresAt)}
          <p className="text-xs text-slate-500">{daysLeftText(row.daysLeft)}</p>
        </>
      )
    },
    {
      id: "state",
      header: "Status",
      cell: (row) => (
        <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${STATE_TONE[row.state]}`}>
          {CERTIFICATE_STATE_LABEL[row.state]}
        </span>
      )
    },
    ...(canEdit
      ? [
          {
            id: "actions",
            header: "",
            cell: (row: CertificateRow) => (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setRenewId(renewId === row.id ? null : row.id)}
                >
                  Renew
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-md px-3 text-sm text-rose-700 hover:bg-rose-50"
                  disabled={removeMutation.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Remove this certificate?",
                      description: `${row.typeLabel} for ${row.assetName ?? "this machine"} will no longer be tracked.`,
                      confirmLabel: "Remove",
                      variant: "destructive"
                    });
                    if (ok) removeMutation.mutate(row.id);
                  }}
                >
                  Remove
                </button>
              </div>
            )
          } satisfies DataTableColumn<CertificateRow>
        ]
      : [])
  ];

  const rows = rowsQuery.data;
  const summary = summaryQuery.data;
  const renewRow = rows?.find((row) => row.id === renewId) ?? null;

  return (
    <section className="space-y-3" aria-labelledby="certificates-heading">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="certificates-heading" className="text-base font-semibold text-slate-900">
            Equipment certificates
          </h2>
          <p className="text-sm text-slate-600">
            Boilers, fire equipment, lifts, generators and other items that need a yearly or half-yearly check.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setAdding((open) => !open)}
            className="min-h-11 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
          >
            {adding ? "Close" : "Add certificate"}
          </button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter certificates">
        {(
          [
            ["", "All", summary?.total],
            ["EXPIRED", "Expired", summary?.expired],
            ["DUE_SOON", "Due soon", summary?.dueSoon],
            ["VALID", "Valid", summary?.valid]
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={label}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`min-h-11 rounded-full border px-4 text-sm ${
              filter === value ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {label}
            {count == null ? "" : ` (${count})`}
          </button>
        ))}
      </div>

      {adding && canEdit ? (
        <CertificateForm
          onDone={() => {
            setAdding(false);
            refresh();
          }}
        />
      ) : null}

      {renewRow && canEdit ? (
        <RenewForm
          row={renewRow}
          onDone={() => {
            setRenewId(null);
            refresh();
          }}
        />
      ) : null}

      {rowsQuery.isError && !rows ? (
        <ErrorState title="Couldn't load certificates" error={rowsQuery.error} onRetry={() => void rowsQuery.refetch()} />
      ) : !rows ? (
        <section className="rounded-xl border border-slate-200 bg-white">
          <TableLoadingRows label="Loading certificates" />
        </section>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          ariaLabel="Equipment certificates"
          emptyTitle={filter ? "Nothing in this group." : "No certificates added yet."}
        />
      )}
      {dialog}
    </section>
  );
}

function CertificateForm({ onDone }: { onDone: () => void }) {
  const typesQuery = useQuery({ queryKey: ["compliance", "certificate-types"], queryFn: listCertificateTypes, staleTime: 60 * 60 * 1000 });
  const [assetId, setAssetId] = useState<string | null>(null);
  const [typeKey, setTypeKey] = useState("");
  const [issued, setIssued] = useState(colomboTodayYmd());
  const [expires, setExpires] = useState("");
  const [provider, setProvider] = useState("");

  const type = typesQuery.data?.find((item) => item.key === typeKey);
  const suggestExpiry = (nextIssued: string, interval: number | undefined) => {
    if (interval) setExpires(addMonthsYmd(nextIssued, interval));
  };

  const save = useMutation({
    mutationFn: () =>
      createCertificate({
        assetId: assetId as string,
        typeKey,
        issuedAt: issued ? expiryIso(issued) : undefined,
        expiresAt: expiryIso(expires),
        providerName: provider.trim() || undefined
      }),
    onSuccess: () => {
      toast.success("Certificate saved.");
      onDone();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not save the certificate."))
  });

  const ready = Boolean(assetId && typeKey && expires) && (!issued || issued <= expires);

  return (
    <form
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !save.isPending) save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Machine / equipment</label>
          <EntityPicker<AssetOption>
            endpoint="/assets"
            searchParam="search"
            value={assetId}
            onChange={(id) => setAssetId(id)}
            displayField="name"
            secondaryField="assetTag"
            pageSizeParam="limit"
            placeholder="Search by name or tag"
            required
          />
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Certificate
          <select
            value={typeKey}
            onChange={(event) => {
              const next = event.target.value;
              setTypeKey(next);
              suggestExpiry(issued, typesQuery.data?.find((item) => item.key === next)?.defaultIntervalMonths);
            }}
            className="mt-1 min-h-11 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
          >
            <option value="">Choose…</option>
            {typesQuery.data?.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <DateField
          label="Done on"
          value={issued}
          onChange={(value) => {
            setIssued(value);
            suggestExpiry(value, type?.defaultIntervalMonths);
          }}
        />
        <DateField label="Expires on" value={expires} onChange={setExpires} minDate={issued || undefined} />
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Done by (optional)
          <input
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            maxLength={200}
            className="mt-1 min-h-11 w-full rounded-md border border-slate-200 px-3 text-sm"
            placeholder="Company or inspector"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={!ready || save.isPending}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {save.isPending ? <ButtonSpinner /> : null}
        Save certificate
      </button>
    </form>
  );
}

function RenewForm({ row, onDone }: { row: CertificateRow; onDone: () => void }) {
  const typesQuery = useQuery({ queryKey: ["compliance", "certificate-types"], queryFn: listCertificateTypes, staleTime: 60 * 60 * 1000 });
  const interval = typesQuery.data?.find((item) => item.key === row.typeKey)?.defaultIntervalMonths ?? 12;
  const today = colomboTodayYmd();
  const [issued, setIssued] = useState(today);
  const [expires, setExpires] = useState(addMonthsYmd(today, interval));

  const save = useMutation({
    mutationFn: () => renewCertificate(row.id, { issuedAt: expiryIso(issued), expiresAt: expiryIso(expires) }),
    onSuccess: () => {
      toast.success("Certificate renewed.");
      onDone();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not renew the certificate."))
  });

  return (
    <form
      className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (expires && issued <= expires && !save.isPending) save.mutate();
      }}
    >
      <p className="text-sm font-medium text-slate-900">
        Renew {row.typeLabel} — {row.assetName ?? "machine"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <DateField
          label="Done on"
          value={issued}
          onChange={(value) => {
            setIssued(value);
            setExpires(addMonthsYmd(value, interval));
          }}
        />
        <DateField label="New expiry" value={expires} onChange={setExpires} minDate={issued || undefined} />
      </div>
      <button
        type="submit"
        disabled={!expires || issued > expires || save.isPending}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {save.isPending ? <ButtonSpinner /> : null}
        Save renewal
      </button>
    </form>
  );
}
