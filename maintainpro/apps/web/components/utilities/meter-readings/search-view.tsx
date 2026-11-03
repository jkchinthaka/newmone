"use client";

import type { FormEvent } from "react";
import { QrCode, Search } from "lucide-react";

import { EmptyState, ErrorState, SectionCard, SkeletonCard, StatusBadge } from "@/components/ui/dashboard";
import { formatMeterQuantity, formatRecorded, meterLine } from "@/lib/meter-readings-display";

import type { MeterRecord, ReadingRecord, RecentReadingRow } from "./types";

export function SearchView({
  query,
  onQueryChange,
  onSearch,
  onScan,
  recent,
  onPick,
  meters,
  latestByMeter,
  metersState,
  metersError,
  onRetryMeters,
  readings,
  readingsState,
  readingsError,
  onRetryReadings,
  notice,
  filtered
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: (event?: FormEvent) => void;
  onScan: () => void;
  recent: MeterRecord[];
  onPick: (meter: MeterRecord) => void;
  meters: MeterRecord[];
  latestByMeter: Map<string, ReadingRecord>;
  metersState: "loading" | "ready" | "error";
  metersError: string;
  onRetryMeters: () => void;
  readings: RecentReadingRow[];
  readingsState: "loading" | "ready" | "error";
  readingsError: string;
  onRetryReadings: () => void;
  notice: string;
  filtered: boolean;
}) {
  return (
    <div className="min-w-0 space-y-4">
      <form className="rounded-card border border-slate-200 bg-white p-3 shadow-card sm:p-4" onSubmit={(event) => onSearch(event)}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="meter-search">
            Search by meter number, name, or location
          </label>
          <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
            <Search aria-hidden className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              id="meter-search"
              className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
              placeholder="Meter number, name, or location"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <button className="min-h-12 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700" type="submit">
              Search
            </button>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800" type="button" onClick={onScan}>
              <QrCode aria-hidden className="h-4 w-4" />
              Scan QR
            </button>
          </div>
        </div>
        {recent.length > 0 ? (
          <div className="mt-3" aria-label="Recently used meters">
            <p className="text-sm text-slate-600">Recently used</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {recent.map((meter) => (
                <li key={meter.id}>
                  <button className="min-h-11 rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800" type="button" onClick={() => onPick(meter)}>
                    {meter.meterNumber}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>

      {notice ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {notice}
        </p>
      ) : null}

      <SectionCard title="Recent meters" description="Tap a meter to record its reading.">
        {metersState === "loading" ? (
          <div className="grid grid-cols-1 gap-3 min-[641px]:grid-cols-2 xl:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : null}
        {metersState === "error" ? <ErrorState message={metersError} onRetry={onRetryMeters} /> : null}
        {metersState === "ready" && meters.length === 0 ? (
          <EmptyState
            title={filtered ? "No meters found" : "No meters"}
            description={filtered ? "Try another number, name, or location." : "No meters are set up for this site yet."}
          />
        ) : null}
        {metersState === "ready" && meters.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 min-[641px]:grid-cols-2 xl:grid-cols-3">
            {meters.map((meter) => {
              const latest = latestByMeter.get(meter.id);
              const last = latest ? formatMeterQuantity(latest.readingValue, meter.unit) : null;
              const recorded = latest ? formatRecorded(latest.readingDate) : null;
              const line = meterLine(meter.description, meter.location);
              return (
                <li key={meter.id} className="min-w-0 rounded-card border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{meter.meterNumber}</p>
                      {line ? <p className="truncate text-sm text-slate-600">{line}</p> : null}
                    </div>
                    {meter.type ? <StatusBadge className="shrink-0" status={meter.type} /> : null}
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <dt className="text-slate-500">Last reading</dt>
                      <dd className="truncate font-semibold text-slate-900">{last ?? "None"}</dd>
                    </div>
                    <div className="min-w-0 text-right">
                      <dt className="text-slate-500">Recorded</dt>
                      <dd className="truncate font-semibold text-slate-900">{recorded ?? "None"}</dd>
                    </div>
                  </dl>
                  <button className="mt-4 min-h-11 w-full rounded-lg border border-brand-200 bg-brand-50 text-sm font-semibold text-brand-800" type="button" onClick={() => onPick(meter)}>
                    Record reading
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </SectionCard>

      <SectionCard title="My recent readings" description="Readings you saved in the last 7 days.">
        {readingsState === "loading" ? <SkeletonCard /> : null}
        {readingsState === "error" ? <ErrorState message={readingsError} onRetry={onRetryReadings} /> : null}
        {readingsState === "ready" && readings.length === 0 ? (
          <EmptyState title="No readings" description="Readings you save in the last 7 days show up here." />
        ) : null}
        {readingsState === "ready" && readings.length > 0 ? (
          <>
            <ul className="divide-y divide-slate-100 min-[641px]:hidden">
              {readings.map((row) => (
                <li key={row.id} className="flex min-w-0 items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{row.meterNumber}</p>
                    {row.meterLine ? <p className="truncate text-sm text-slate-600">{row.meterLine}</p> : null}
                    <p className="mt-1 text-sm text-slate-800">{row.reading}</p>
                    <p className="text-sm text-slate-500">{row.recorded}</p>
                  </div>
                  <StatusBadge className="shrink-0" status={row.status} />
                </li>
              ))}
            </ul>
            <table className="hidden w-full table-fixed text-sm min-[641px]:table">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2 font-medium">Meter</th>
                  <th className="py-2 pr-2 font-medium">Reading</th>
                  <th className="py-2 pr-2 font-medium">Used since last</th>
                  <th className="py-2 pr-2 font-medium">Recorded</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-2">
                      <p className="truncate font-semibold text-brand-800">{row.meterNumber}</p>
                      {row.meterLine ? <p className="truncate text-slate-600">{row.meterLine}</p> : null}
                    </td>
                    <td className="py-3 pr-2 font-medium text-slate-900">{row.reading}</td>
                    <td className="py-3 pr-2 text-emerald-800">{row.used ?? "—"}</td>
                    <td className="truncate py-3 pr-2 text-slate-700">{row.recorded}</td>
                    <td className="py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </SectionCard>
    </div>
  );
}
