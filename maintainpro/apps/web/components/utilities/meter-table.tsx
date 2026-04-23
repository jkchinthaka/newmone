"use client";

import { Eye, Pencil, Plus, Search } from "lucide-react";

import { utilityTypeLabel, utilityTypeTone } from "./helpers";
import { DataTable, EmptyState, StatusBadge } from "./shared-ui";
import type { UtilityMeter, UtilityTypeFilter } from "./types";

type MeterTableProps = {
  meters: UtilityMeter[];
  search: string;
  typeFilter: UtilityTypeFilter;
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: UtilityTypeFilter) => void;
  onAddMeter: () => void;
  onEditMeter: (meter: UtilityMeter) => void;
  onToggleMeterStatus: (meter: UtilityMeter) => void;
  onOpenReadings: (meter: UtilityMeter) => void;
  canManage: boolean;
  isBusy: boolean;
};

export function MeterTable({
  meters,
  search,
  typeFilter,
  onSearchChange,
  onTypeFilterChange,
  onAddMeter,
  onEditMeter,
  onToggleMeterStatus,
  onOpenReadings,
  canManage,
  isBusy
}: MeterTableProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-1 min-w-[240px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Search size={15} className="text-slate-500" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full bg-transparent text-sm text-slate-700 outline-none"
              placeholder="Search meter number or location"
            />
          </label>

          <select
            value={typeFilter}
            onChange={(event) => onTypeFilterChange(event.target.value as UtilityTypeFilter)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="ALL">All types</option>
            <option value="ELECTRICITY">Electricity</option>
            <option value="WATER">Water</option>
            <option value="GAS">Gas</option>
          </select>

          <button
            type="button"
            onClick={onAddMeter}
            disabled={!canManage}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={15} /> Add Meter
          </button>
        </div>
      </div>

      {meters.length === 0 ? (
        <EmptyState
          title="No utility meters found"
          description="Add your first meter to start tracking utility readings and bills."
        />
      ) : (
        <DataTable>
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Meter Number</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {meters.map((meter) => (
              <tr key={meter.id} className="transition hover:bg-slate-50/70">
                <td className="px-4 py-3 font-medium text-slate-900">{meter.meterNumber}</td>
                <td className="px-4 py-3">
                  <StatusBadge label={utilityTypeLabel(meter.type)} toneClass={utilityTypeTone(meter.type)} />
                </td>
                <td className="px-4 py-3">{meter.location}</td>
                <td className="px-4 py-3">{meter.unit}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    label={meter.isActive ? "Active" : "Inactive"}
                    toneClass={meter.isActive ? "bg-emerald-100 text-emerald-700 ring-emerald-200" : "bg-slate-200 text-slate-600 ring-slate-300"}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenReadings(meter)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      <Eye size={13} /> Readings
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditMeter(meter)}
                      disabled={!canManage}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleMeterStatus(meter)}
                      disabled={!canManage || isBusy}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {meter.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </section>
  );
}
