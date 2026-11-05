"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { EntityPicker } from "@/components/ui/entity-picker";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

type Pin = { id: string; assetId: string; x: number; y: number; assetName: string; assetTag: string | null };
type Plan = { id: string; name: string; imageData: string; pins: Pin[] };

export default function FloorPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState("");
  const [assetName, setAssetName] = useState("");
  const imageRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: Plan }>(`/floor-plans/${id}`);
      setPlan(res.data.data);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Could not load this floor plan."));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function place(event: React.MouseEvent<HTMLDivElement>) {
    if (!assetId) {
      toast.error("Choose an asset first, then click the plan.");
      return;
    }
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    try {
      await apiClient.post(`/floor-plans/${id}/pins`, { assetId, x, y });
      toast.success(`${assetName || "Asset"} pinned`);
      setAssetId("");
      setAssetName("");
      await load();
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Could not save the pin."));
    }
  }

  async function removePin(pinId: string) {
    try {
      await apiClient.delete(`/floor-plans/${id}/pins/${pinId}`);
      await load();
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Could not remove the pin."));
    }
  }

  async function removePlan() {
    if (!window.confirm("Remove this floor plan?")) return;
    try {
      await apiClient.delete(`/floor-plans/${id}`);
      router.push("/floor-plans" as Route);
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Could not remove the floor plan."));
    }
  }

  if (error) return <p className="text-sm text-rose-700" role="alert">{error}</p>;
  if (!plan) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={"/floor-plans" as Route} className="text-sm text-blue-700 hover:underline">← Floor Plans</Link>
          <h1 className="page-title">{plan.name}</h1>
        </div>
        <button type="button" onClick={() => void removePlan()} className="min-h-11 rounded-lg border border-rose-300 px-3 text-sm text-rose-700 hover:bg-rose-50">
          Remove plan
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div>
          <div className="mb-2 max-w-md space-y-1">
            <span className="text-sm font-medium text-slate-700">Pin an asset: pick it, then click its place on the plan</span>
            <EntityPicker
              endpoint="/assets"
              searchParam="search"
              pageSizeParam="limit"
              pageSize={20}
              value={assetId || null}
              displayField="name"
              secondaryField="assetTag"
              placeholder="Search asset..."
              onChange={(value, entity) => {
                setAssetId(value ?? "");
                setAssetName(entity ? String(entity.name ?? "") : "");
              }}
            />
          </div>
          <div ref={imageRef} onClick={(event) => void place(event)} className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${assetId ? "cursor-crosshair" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={plan.imageData} alt={plan.name} className="block w-full select-none" draggable={false} />
            {plan.pins.map((pin) => (
              <span
                key={pin.id}
                title={`${pin.assetTag ? `${pin.assetTag} — ` : ""}${pin.assetName}`}
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-600 shadow"
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              />
            ))}
          </div>
        </div>
        <aside className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="text-sm font-semibold text-slate-900">Pinned assets ({plan.pins.length})</h2>
          {plan.pins.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nothing pinned yet.</p> : null}
          <ul className="mt-2 space-y-1">
            {plan.pins.map((pin) => (
              <li key={pin.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/assets/${pin.assetId}` as Route} className="truncate text-blue-700 hover:underline">{pin.assetName}</Link>
                <button type="button" onClick={() => void removePin(pin.id)} className="text-slate-500 hover:text-rose-700" aria-label={`Remove ${pin.assetName}`}>✕</button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
