"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Plus } from "lucide-react";
import { Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getStoredRole } from "@/lib/user-role";

import { formatCompact, formatDate, formatQuantity, getErrorMessage, toNumber } from "./helpers";
import { useCreateUtilityReadingMutation, useUtilityMetersQuery, useUtilityReadingsQuery } from "./hooks";
import { DataTable, EmptyState, LoadingPanel, ModalShell } from "./shared-ui";
import type { ReadingFormValues, UtilityRole } from "./types";

const readingFormSchema = z.object({
  meterId: z.string().min(1, "Meter is required"),
  readingDate: z.string().min(1, "Reading date is required"),
  readingValue: z.coerce.number().min(0, "Reading value must be non-negative"),
  notes: z.string().trim().optional(),
  images: z.string().trim().optional()
});

const UTILITY_WRITE_ROLES = new Set<UtilityRole>(["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"]);

export default function MeterReadingsPage() {
  const params = useParams<{ meterId: string }>();
  const meterId = typeof params?.meterId === "string" ? params.meterId : "";

  const [role, setRole] = useState<UtilityRole>("VIEWER");
  const [modalOpen, setModalOpen] = useState(false);

  const metersQuery = useUtilityMetersQuery();
  const readingsQuery = useUtilityReadingsQuery();
  const createReadingMutation = useCreateUtilityReadingMutation();

  const readingForm = useForm<ReadingFormValues>({
    resolver: zodResolver(readingFormSchema),
    defaultValues: {
      meterId,
      readingDate: new Date().toISOString().slice(0, 10),
      readingValue: 0,
      notes: "",
      images: ""
    }
  });

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  useEffect(() => {
    if (meterId) {
      readingForm.setValue("meterId", meterId);
    }
  }, [meterId, readingForm]);

  const canManage = UTILITY_WRITE_ROLES.has(role);

  const meters = metersQuery.data ?? [];
  const meter = meters.find((entry) => entry.id === meterId) ?? null;

  const readings = useMemo(
    () =>
      (readingsQuery.data ?? [])
        .filter((reading) => reading.meterId === meterId)
        .map((reading) => ({
          ...reading,
          meter
        })),
    [readingsQuery.data, meterId, meter]
  );

  const readingHistory = [...readings].sort((a, b) => b.readingDate.localeCompare(a.readingDate));

  const chartData = [...readings]
    .sort((a, b) => a.readingDate.localeCompare(b.readingDate))
    .map((reading) => ({
      label: formatDate(reading.readingDate),
      consumption: toNumber(reading.consumption),
      readingValue: toNumber(reading.readingValue)
    }));

  const openModal = () => {
    readingForm.reset({
      meterId,
      readingDate: new Date().toISOString().slice(0, 10),
      readingValue: 0,
      notes: "",
      images: ""
    });
    setModalOpen(true);
  };

  const handleCreateReading = readingForm.handleSubmit(async (values) => {
    const latest = [...readings].sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0];

    if (latest && values.readingValue < toNumber(latest.readingValue)) {
      readingForm.setError("readingValue", {
        message: `Reading must be at least ${formatQuantity(toNumber(latest.readingValue))}`
      });
      toast.error("Reading value cannot be lower than the previous value.");
      return;
    }

    try {
      await createReadingMutation.mutateAsync(values);
      toast.success("Reading added");
      setModalOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  if (metersQuery.isLoading || readingsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <LoadingPanel className="h-20" />
        <LoadingPanel className="h-72" />
        <LoadingPanel className="h-[360px]" />
      </div>
    );
  }

  if (!meter) {
    return (
      <EmptyState
        title="Meter not found"
        description="The requested meter does not exist or you do not have access to it."
      />
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <a
            href="/utilities?tab=readings"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700"
          >
            <ArrowLeft size={13} /> Back to Utilities
          </a>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{meter.meterNumber}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {meter.location} · {meter.unit}
          </p>
        </div>

        <button
          type="button"
          onClick={openModal}
          disabled={!canManage}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={15} /> Add Reading
        </button>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Consumption trend</h3>
        {chartData.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No readings yet for this meter.</p>
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => formatCompact(Number(value))} />
                <Tooltip formatter={(value: number) => formatCompact(value)} />
                <Legend />
                <Line dataKey="consumption" name="Consumption" stroke="#1476d6" strokeWidth={2.4} dot={false} />
                <Line dataKey="readingValue" name="Reading value" stroke="#0e9aa7" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>

      <article className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Reading history</h3>

        {readingHistory.length === 0 ? (
          <EmptyState title="No reading history" description="Add the first reading for this meter." />
        ) : (
          <DataTable minWidthClass="min-w-[880px]">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Reading Value</th>
                <th className="px-4 py-3">Consumption</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {readingHistory.map((reading) => (
                <tr key={reading.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-3">{formatDate(reading.readingDate)}</td>
                  <td className="px-4 py-3 font-medium">
                    {formatQuantity(toNumber(reading.readingValue))} {meter.unit}
                  </td>
                  <td className="px-4 py-3">
                    {formatQuantity(toNumber(reading.consumption))} {meter.unit}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{reading.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </article>

      <ModalShell
        open={modalOpen}
        title="Add Reading"
        subtitle={`New reading for ${meter.meterNumber}`}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleCreateReading()}
              disabled={createReadingMutation.isPending}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save reading
            </button>
          </>
        }
      >
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
          <label className="text-sm text-slate-700">
            Reading date
            <input
              type="date"
              {...readingForm.register("readingDate")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700">
            Reading value
            <input
              type="number"
              step="0.01"
              {...readingForm.register("readingValue", { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-rose-600">{readingForm.formState.errors.readingValue?.message}</span>
          </label>

          <label className="text-sm text-slate-700">
            Image URLs
            <input
              {...readingForm.register("images")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="https://... (comma separated)"
            />
          </label>

          <label className="text-sm text-slate-700 md:col-span-2">
            Notes
            <textarea
              rows={3}
              {...readingForm.register("notes")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </form>
      </ModalShell>
    </div>
  );
}
