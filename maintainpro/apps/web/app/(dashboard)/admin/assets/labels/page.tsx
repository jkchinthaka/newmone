"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { LABEL_IDS_STORAGE_KEY } from "@/lib/asset-register-import";

type Label = { id: string; assetTag: string; name: string; site: string | null; svg: string };

const BATCH = 100;

/** A4 sheet of QR labels (3 × 4 per page) for the assets just added or tagged. */
export default function AssetLabelsPage() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let ids: string[] = [];
    try {
      ids = JSON.parse(sessionStorage.getItem(LABEL_IDS_STORAGE_KEY) ?? "[]") as string[];
    } catch {
      ids = [];
    }
    ids = Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
    if (!ids.length) {
      setState("empty");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const loaded: Label[] = [];
        for (let index = 0; index < ids.length; index += BATCH) {
          const response = await apiClient.post("/admin/asset-register/qr-labels", { ids: ids.slice(index, index + BATCH) });
          loaded.push(...((response.data?.data ?? []) as Label[]));
        }
        if (cancelled) return;
        setLabels(loaded);
        setState(loaded.length ? "ready" : "empty");
      } catch (cause) {
        if (cancelled) return;
        setError(getApiErrorMessage(cause, "The labels could not be loaded."));
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="label-print-root fixed inset-0 z-50 overflow-auto bg-white">
      <style>{`
        @page { size: A4; margin: 8mm; }
        @media print {
          body * { visibility: hidden !important; }
          .label-print-root, .label-print-root * { visibility: visible !important; }
          .label-print-root { position: absolute !important; inset: 0 !important; overflow: visible !important; }
          .label-print-toolbar { display: none !important; }
          .label-sheet { gap: 0 !important; padding: 0 !important; }
          .label-card { break-inside: avoid; page-break-inside: avoid; }
        }
        .label-card svg { width: 100%; height: 100%; display: block; }
      `}</style>
      <div className="label-print-toolbar sticky top-0 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-slate-700">
          {state === "loading" ? "Loading labels…" : state === "ready" ? `${labels.length} QR label${labels.length === 1 ? "" : "s"} · A4, 12 per page` : null}
          {state === "empty" ? "No assets to print. Add assets or tags first, then press Print QR labels." : null}
          {state === "error" ? error : null}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={state !== "ready"}
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Printer size={16} aria-hidden /> Print
          </button>
          <button type="button" onClick={() => window.close()} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm">
            Close
          </button>
        </div>
      </div>
      <div className="label-sheet mx-auto grid max-w-[210mm] grid-cols-2 gap-2 p-4 sm:grid-cols-3">
        {labels.map((label) => (
          <div key={label.id} className="label-card flex h-[68mm] flex-col items-center justify-center gap-1 border border-dashed border-slate-300 p-2 text-center">
            <div className="h-[38mm] w-[38mm]" aria-hidden dangerouslySetInnerHTML={{ __html: label.svg }} />
            <p className="font-mono text-base font-bold tracking-wide text-slate-900">{label.assetTag}</p>
            <p className="line-clamp-2 text-xs text-slate-700">{label.name}</p>
            {label.site ? <p className="text-[10px] text-slate-500">{label.site}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
