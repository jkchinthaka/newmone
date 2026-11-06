"use client";

import { Download, Share } from "lucide-react";
import { useState } from "react";

import { promptInstall } from "@/lib/pwa-install-store";

import { usePwa } from "./use-pwa";

type Props = {
  className?: string;
  /** "inverse" is for the dark sidebar. */
  tone?: "default" | "inverse";
};

/**
 * "Install app" for people who open Nelna CMMS in a browser. Shows nothing when the app is already
 * installed or the browser cannot install it. On iPhone/iPad Safari it explains Share → Add to Home Screen.
 */
export function InstallAppButton({ className = "", tone = "default" }: Props) {
  const { canInstall, installed, iosManual } = usePwa();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (installed || (!canInstall && !iosManual)) return null;

  const base =
    tone === "inverse"
      ? "border-white/20 text-white hover:bg-white/10"
      : "border-brand-200 bg-white text-brand-800 hover:bg-brand-50";

  return (
    <div className={className}>
      <button
        type="button"
        data-compact
        onClick={() => (canInstall ? void promptInstall() : setShowIosHelp((open) => !open))}
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${base}`}
      >
        <Download aria-hidden className="h-4 w-4" />
        Install app
      </button>
      {iosManual && showIosHelp ? (
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs leading-5 ${tone === "inverse" ? "bg-white/10 text-white" : "bg-slate-50 text-slate-700"}`}>
          Tap the <Share aria-hidden className="mx-0.5 inline h-3.5 w-3.5" /> <strong>Share</strong> button in Safari, then{" "}
          <strong>Add to Home Screen</strong>.
        </p>
      ) : null}
    </div>
  );
}
