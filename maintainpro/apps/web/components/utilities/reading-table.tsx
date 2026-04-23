"use client";

import { Plus, Route } from "lucide-react";

import { formatDate, formatQuantity, toNumber, utilityTypeLabel } from "./helpers";
import { DataTable, EmptyState, StatusBadge } from "./shared-ui";
import type { MeterReading, UtilityMeter } from "./types";

type ReadingTableProps = {
  readings: MeterReading[];
  meters: UtilityMeter[];
  selectedMeterId: string;
  onSelectedMeterChange: (meterId: string) => void;
  onAddReading: () => void;
  canManage: boolean;
};

function buildSpikeMap(readings: MeterReading[]) {
  const grouped = new Map<string, MeterReading[]>();

  readings.forEach((reading) => {
    const list = grouped.get(reading.meterId) ?? [];
    list.push(reading);
    grouped.set(reading.meterId, list);
  });

  const spikes = new Set<string>();

  grouped.forEach((list) => {
    const sorted = [...list].sort((a, b) => a.readingDate.localeCompare(b.readingDate));

    for (let index = 1; index < sorted.length; index += 1) {
      const currentConsumption = toNumber(sorted[index].consumption);
      const previousConsumption = toNumber(sorted[index - 1].consumption);

      if (previousConsumption > 0 && currentConsumption >= previousConsumption * 2) {
        spikes.add(sorted[index].id);
      }
    }
  });

  return spikes;
}

export function ReadingTable({
  readings,
  meters,
  selectedMeterId,
  onSelectedMeterChange,
  onAddReading,
  canManage
}: ReadingTableProps) {
  const meterById = new Map(meters.map((meter) => [meter.id, meter]));
  const spikes = buildSpikeMap(readings);

  const filteredReadings = selectedMeterId
    ? readings.filter((reading) => reading.meterId === selectedMeterId)
    : readings;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedMeterId}
            onChange={(event) => onSelectedMeterChange(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">All meters</option>
            {meters.map((meter) => (
              <option key={meter.id} value={meter.id}>
                {meter.meterNumber} - {meter.location}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onAddReading}
            disabled={!canManage}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={15} /> Add Reading
          </button>
        </div>
      </div>

      {filteredReadings.length === 0 ? (
        <EmptyState
          title="No readings found"
          description="Add a reading to start tracking per-meter utility consumption trends."
        />
      ) : (
        <DataTable minWidthClass="min-w-[960px]">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Meter</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Reading Date</th>
              <th className="px-4 py-3">Reading Value</th>
              <th className="px-4 py-3">Consumption</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3 text-right">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {filteredReadings.map((reading) => {
              const meter = reading.meter ?? meterById.get(reading.meterId);
              const consumption = toNumber(reading.consumption);
              const isSpike = spikes.has(reading.id);

              return (
                <tr key={reading.id} className={`transition hover:bg-slate-50/70 ${isSpike ? "bg-rose-50/40" : ""}`}>
                  <td className="px-4 py-3 font-medium text-slate-900">{meter?.meterNumber ?? "Unknown"}</td>
                  <td className="px-4 py-3">{meter ? utilityTypeLabel(meter.type) : "-"}</td>
                  <td className="px-4 py-3">{formatDate(reading.readingDate)}</td>
                  <td className="px-4 py-3">{formatQuantity(reading.readingValue)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={`${formatQuantity(consumption)} ${meter?.unit ?? ""}`.trim()}
                      toneClass={
                        isSpike
                          ? "bg-rose-100 text-rose-700 ring-rose-200"
                          : consumption > 0
                            ? "bg-sky-100 text-sky-700 ring-sky-200"
                            : "bg-slate-100 text-slate-600 ring-slate-200"
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{reading.notes || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/utilities/meters/${reading.meterId}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      <Route size={13} /> Open
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </section>
  );
}
