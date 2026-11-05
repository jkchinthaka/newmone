"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

import { apiClient } from "@/lib/api-client";

export type PinState = "OPEN_JOB" | "OK" | "RETIRED";

export const PIN_COLOR: Record<PinState, string> = {
  OPEN_JOB: "bg-rose-500",
  OK: "bg-emerald-500",
  RETIRED: "bg-slate-400"
};

type Location = { planId: string; planName: string; siteName: string | null; x: number; y: number; state: PinState };

/** Where an asset is pinned (null when it is on no floor plan). Fails quietly. */
export function useAssetPlanLocation(assetId?: string | null) {
  return useQuery({
    queryKey: ["floor-plans", "by-asset", assetId],
    enabled: Boolean(assetId),
    staleTime: 60_000,
    retry: false,
    queryFn: async () => (await apiClient.get<{ data: Location | null }>(`/floor-plans/by-asset/${assetId}`)).data.data
  });
}

/** "Where is it?" block for the asset page: a small grid with the pin, plus a link to the full plan. */
export function WhereIsIt({ assetId, canPin }: { assetId: string; canPin?: boolean }) {
  const { data, isLoading } = useAssetPlanLocation(assetId);
  if (isLoading) return null;
  if (!data) {
    return canPin ? (
      <section className="rounded-xl border border-dashed border-slate-300 p-3 text-sm">
        <p className="font-semibold text-slate-800">Not on a map yet</p>
        <Link href={"/floor-plans" as Route} className="mt-1 inline-block font-semibold text-brand-600 hover:underline">＋ Pin it on a floor plan</Link>
      </section>
    ) : null;
  }
  return (
    <section className="rounded-xl border border-slate-200 p-3 text-sm">
      <p className="font-semibold text-slate-800">Where is it?</p>
      <div className="relative mt-2 h-24 overflow-hidden rounded-lg bg-slate-100" style={{ backgroundImage: "linear-gradient(#d3dce8 1px,transparent 1px),linear-gradient(90deg,#d3dce8 1px,transparent 1px)", backgroundSize: "20px 20px" }} aria-hidden="true">
        <i className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-4 ring-brand-200 ${PIN_COLOR[data.state]}`} style={{ left: `${data.x}%`, top: `${data.y}%` }} />
      </div>
      <p className="mt-2 text-slate-600">{data.planName}{data.siteName ? ` · ${data.siteName}` : ""}</p>
      <Link href={`/floor-plans/${data.planId}?asset=${assetId}` as Route} className="font-semibold text-brand-600 hover:underline">Open full plan →</Link>
    </section>
  );
}

/** "Show on plan" button for the job page. Renders nothing when the asset has no pin. */
export function ShowOnPlanButton({ assetId }: { assetId?: string | null }) {
  const { data } = useAssetPlanLocation(assetId);
  if (!assetId || !data) return null;
  return (
    <Link href={`/floor-plans/${data.planId}?asset=${assetId}` as Route} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
      <MapPin size={14} /> Show on plan
    </Link>
  );
}
