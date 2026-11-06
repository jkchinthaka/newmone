"use client";

import { RefreshCw } from "lucide-react";

import { usePwa } from "./use-pwa";

/** "New version ready" snackbar. The person chooses when to reload, so nothing typed is lost. */
export function UpdateBanner() {
  const { updateReady } = usePwa();
  if (!updateReady) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[max(5rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg xl:bottom-6"
    >
      <span>A new version of Nelna CMMS is ready.</span>
      <button
        type="button"
        data-compact
        onClick={() => window.location.reload()}
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 font-semibold text-slate-900 hover:bg-slate-100"
      >
        <RefreshCw aria-hidden className="h-4 w-4" />
        Refresh
      </button>
    </div>
  );
}
