"use client";

import { useEffect, useState } from "react";

import { LOADING_INDICATOR_DELAY_MS } from "@/lib/loading-standard";

type EmptyProps = {
  title?: string;
  onClear?: () => void;
  onViewAll?: () => void;
};

export function OperationalEmptyState({
  title = "No work orders match these filters.",
  onClear,
  onViewAll
}: EmptyProps) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <div className="mt-3 flex items-center justify-center gap-3">
        {onClear ? (
          <button type="button" onClick={onClear} className="min-h-11 px-2 text-sm font-medium text-brand-700">
            Clear filters
          </button>
        ) : null}
        {onViewAll ? (
          <button type="button" onClick={onViewAll} className="min-h-11 px-2 text-sm font-medium text-slate-700">
            View all
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * True once `active` has stayed true for `delayMs`. Fast responses never flash a loader.
 */
export function useDelayedFlag(active: boolean, delayMs = LOADING_INDICATOR_DELAY_MS): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    if (delayMs <= 0) {
      setShown(true);
      return;
    }
    const timer = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);
  return active && shown;
}

/**
 * The standard list/table loading state: ~6 brand-tinted skeleton rows, shown only after a short
 * delay so quick loads do not flicker, and without pulsing for reduced-motion users.
 */
export function TableLoadingRows({
  rows = 6,
  label = "Loading records",
  delayMs = LOADING_INDICATOR_DELAY_MS
}: {
  rows?: number;
  label?: string;
  delayMs?: number;
}) {
  const visible = useDelayedFlag(true, delayMs);
  return (
    <div className="space-y-2 p-3" role="status" aria-live="polite" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}</span>
      {visible
        ? Array.from({ length: rows }, (_, index) => (
            <div key={index} aria-hidden className="h-10 animate-pulse rounded-md bg-brand-100 motion-reduce:animate-none" />
          ))
        : <div aria-hidden style={{ minHeight: `${rows * 2.5 + (rows - 1) * 0.5}rem` }} />}
    </div>
  );
}
