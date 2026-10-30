"use client";

/**
 * Single import point for the loading standard (lib/loading-standard.ts):
 *   lists/tables  -> <TableLoadingRows />  (skeleton rows, delayed 250ms, reduced-motion safe)
 *   full pages    -> <LoadingState />      (small spinner + text; RouteLoading for loading.tsx)
 *   buttons       -> <ButtonSpinner /> inside a disabled button
 *   inline areas  -> <InlineLoadingState />
 */
import { Loader2 } from "lucide-react";

export { InlineLoadingState, LoadingState } from "@/components/ui/page-state";
export { TableLoadingRows, useDelayedFlag } from "@/components/operational/operational-list-states";
export { RouteLoading } from "@/components/ui/route-loading";
export { LOADING_INDICATOR_DELAY_MS, listLoadPhase } from "@/lib/loading-standard";

/** Inline spinner for a busy button. Pair with `disabled` and `aria-busy` on the button. */
export function ButtonSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 aria-hidden className={`${className} shrink-0 animate-spin motion-reduce:animate-none`} />;
}

/** Small "Updating…" note shown while a list refreshes but keeps its previous rows. */
export function RefreshingNote({ label = "Updating…" }: { label?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <ButtonSpinner className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
