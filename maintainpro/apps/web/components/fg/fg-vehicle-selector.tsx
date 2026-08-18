"use client";

import { useEffect, useId, useState } from "react";

import { searchFgVehicles } from "@/lib/fg-api";
import type { FgVehicleResult } from "@/lib/fg-types";

type Props = {
  value: string;
  onChange: (registration: string, vehicle?: FgVehicleResult) => void;
  disabled?: boolean;
  error?: string;
};

function isUnavailable(vehicle: FgVehicleResult): boolean {
  if (vehicle.unavailable) {
    return true;
  }
  return Boolean(vehicle.status && vehicle.status.toUpperCase() !== "ACTIVE");
}

export function FgVehicleSelector({ value, onChange, disabled, error }: Props) {
  const listId = useId();
  const listboxId = `${listId}-listbox`;
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<FgVehicleResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setLoading(true);
      void searchFgVehicles(q)
        .then((payload) => setResults(payload.data?.results ?? []))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor={listId}>
        Vehicle
      </label>
      <input
        id={listId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        value={query}
        disabled={disabled}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${listId}-error` : undefined}
        data-fg-invalid={error ? "true" : undefined}
        placeholder="Search registration, make, or asset ID"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            setQuery(value);
          }, 150);
        }}
      />
      {error ? (
        <p id={`${listId}-error`} className="mt-1 text-sm text-rose-700">
          {error}
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          Select a MaintainPro vehicle. Free text is not accepted when a match is required.
        </p>
      )}
      {open && (results.length > 0 || loading) ? (
        <ul
          id={listboxId}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          {loading ? <li className="px-3 py-2 text-sm text-slate-500">Searching vehicles…</li> : null}
          {results.map((vehicle) => {
            const unavailable = isUnavailable(vehicle);
            return (
              <li key={vehicle.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === vehicle.registrationNo}
                  aria-disabled={unavailable}
                  disabled={unavailable}
                  className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (unavailable) {
                      return;
                    }
                    onChange(vehicle.registrationNo, vehicle);
                    setQuery(vehicle.registrationNo);
                    setOpen(false);
                  }}
                >
                  <span className="font-semibold text-slate-900">{vehicle.registrationNo || vehicle.label}</span>
                  <span className="text-xs text-slate-500">
                    {[vehicle.make, vehicle.vehicleModel, vehicle.assetTag].filter(Boolean).join(" · ") || vehicle.label}
                    {unavailable ? ` · ${vehicle.status || "Unavailable"}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
