"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Maximize2, Minus, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { PIN_COLOR, type PinState } from "@/components/floor-plans/floor-plan-location";
import { EntityPicker } from "@/components/ui/entity-picker";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";

type Pin = {
  id: string;
  assetId: string;
  x: number;
  y: number;
  assetName: string;
  assetTag: string | null;
  assetLocation: string | null;
  state: PinState;
  openJobs: number;
  latestJob: { id: string; woNumber: string | null; title: string | null } | null;
};
type Plan = { id: string; name: string; siteName: string | null; imageData: string; pins: Pin[] };

const EDIT_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER"]);
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function FloorPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const user = useCurrentUser();
  const canEdit = EDIT_ROLES.has(user.role ?? "");

  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState("");
  const [assetName, setAssetName] = useState("");
  const [selected, setSelected] = useState<string | null>(search.get("asset"));
  const [filter, setFilter] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ kind: "pin" | "pan"; pinId?: string; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: Plan }>(`/floor-plans/${id}`);
      setPlan(res.data.data);
      setNameDraft(res.data.data.name);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Could not load this floor plan."));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const pins = plan?.pins ?? [];
  const selectedPin = pins.find((pin) => pin.assetId === selected || pin.id === selected) ?? null;
  const visibleList = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term ? pins.filter((pin) => `${pin.assetName} ${pin.assetTag ?? ""}`.toLowerCase().includes(term)) : pins;
  }, [pins, filter]);

  function zoom(delta: number) {
    setView((current) => {
      const scale = clamp(current.scale + delta, MIN_SCALE, MAX_SCALE);
      return scale === MIN_SCALE ? { scale, x: 0, y: 0 } : { ...current, scale };
    });
  }

  function show(pin: Pin) {
    setSelected(pin.assetId);
    setView({ scale: 2.2, x: (50 - pin.x) * 2.2 * 0.01 * (frameRef.current?.clientWidth ?? 0), y: (50 - pin.y) * 2.2 * 0.01 * (frameRef.current?.clientHeight ?? 0) });
  }

  // Deep link (?asset=): zoom to that pin once the plan is loaded.
  const shownFromLink = useRef(false);
  useEffect(() => {
    const target = search.get("asset");
    if (!plan || !target || shownFromLink.current) return;
    const pin = plan.pins.find((item) => item.assetId === target);
    if (pin) {
      shownFromLink.current = true;
      show(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  function pctFromEvent(event: { clientX: number; clientY: number }) {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
    };
  }

  function onPinDown(event: React.PointerEvent, pin: Pin) {
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { kind: "pin", pinId: pin.id, startX: event.clientX, startY: event.clientY, originX: pin.x, originY: pin.y, moved: false };
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    if (d.kind === "pan") {
      setView((current) => ({ ...current, x: d.originX + dx, y: d.originY + dy }));
    } else if (canEdit && d.pinId) {
      const at = pctFromEvent(event);
      if (at) setPlan((current) => (current ? { ...current, pins: current.pins.map((pin) => (pin.id === d.pinId ? { ...pin, ...at } : pin)) } : current));
    }
  }

  async function onPointerUp(event: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "pin" && d.pinId) {
      const pin = pins.find((item) => item.id === d.pinId);
      if (!pin) return;
      if (!d.moved) {
        setSelected(pin.assetId);
        return;
      }
      if (!canEdit) {
        await load();
        return;
      }
      try {
        await apiClient.post(`/floor-plans/${id}/pins`, { assetId: pin.assetId, x: pin.x, y: pin.y });
        toast.success(`${pin.assetName} moved`);
      } catch (cause) {
        toast.error(getApiErrorMessage(cause, "Could not move the pin."));
        await load();
      }
    } else if (d.kind === "pan" && !d.moved && assetId && canEdit) {
      await place(event);
    }
  }

  function onMapDown(event: React.PointerEvent) {
    drag.current = { kind: "pan", startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y, moved: false };
  }

  async function place(event: { clientX: number; clientY: number }) {
    const at = pctFromEvent(event);
    if (!at || !assetId) return;
    try {
      await apiClient.post(`/floor-plans/${id}/pins`, { assetId, ...at });
      toast.success(`${assetName || "Asset"} pinned`);
      setAssetId("");
      setAssetName("");
      await load();
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Could not save the pin."));
    }
  }

  async function removePin(pin: Pin) {
    try {
      await apiClient.delete(`/floor-plans/${id}/pins/${pin.id}`);
      if (selected === pin.assetId) setSelected(null);
      await load();
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Could not remove the pin."));
    }
  }

  async function saveName() {
    if (!nameDraft.trim()) return;
    try {
      await apiClient.patch(`/floor-plans/${id}`, { name: nameDraft.trim() });
      setRenaming(false);
      await load();
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Could not rename the floor plan."));
    }
  }

  async function replaceImage(file: File | undefined) {
    if (!file) return;
    try {
      const body = new FormData();
      body.set("file", file);
      await apiClient.post(`/floor-plans/${id}/image`, body);
      toast.success("Image replaced. Pins stay where they were.");
      await load();
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Could not replace the image."));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePlan() {
    if (!window.confirm("Remove this floor plan? The pins on it are removed too; the assets stay.")) return;
    try {
      await apiClient.delete(`/floor-plans/${id}`);
      router.push("/floor-plans" as Route);
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Could not remove the floor plan."));
    }
  }

  if (error) return <p className="p-6 text-sm text-rose-700" role="alert">{error}</p>;
  if (!plan) return <p className="p-6 text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-4 p-6">
      <PageBreadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Floor plans", href: "/floor-plans" }, { label: plan.name }]} />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {renaming ? (
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void saveName(); }}>
              <input autoFocus value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} className="min-h-10 rounded-lg border border-slate-300 px-3 text-lg font-semibold" aria-label="Floor plan name" />
              <button type="submit" className="min-h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white">Save</button>
              <button type="button" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm" onClick={() => { setRenaming(false); setNameDraft(plan.name); }}>Cancel</button>
            </form>
          ) : (
            <h1 className="page-title">{plan.name}</h1>
          )}
          <p className="text-sm text-slate-500">{[plan.siteName, `${pins.length} asset${pins.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium" onClick={() => setRenaming(true)}>Rename</button>
            <button type="button" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium" onClick={() => fileRef.current?.click()}>Replace image</button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void replaceImage(event.target.files?.[0])} aria-label="Replace floor plan image" />
            <button type="button" className="min-h-10 rounded-lg border border-rose-300 bg-white px-3 text-sm font-medium text-rose-700 hover:bg-rose-50" onClick={() => void removePlan()}>Delete</button>
          </div>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div>
          <div
            ref={frameRef}
            className={`relative overflow-hidden rounded-xl border border-slate-300 bg-slate-100 ${assetId && canEdit ? "cursor-crosshair" : "cursor-grab"}`}
            style={{ touchAction: "none" }}
            onPointerDown={onMapDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => void onPointerUp(event)}
            onWheel={(event) => zoom(event.deltaY < 0 ? 0.25 : -0.25)}
          >
            <div ref={imageRef} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "center", transition: drag.current ? "none" : "transform 0.2s" }} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={plan.imageData} alt={plan.name} className="block w-full select-none" draggable={false} />
              {pins.map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  title={`${pin.assetTag ? `${pin.assetTag} · ` : ""}${pin.assetName}`}
                  aria-label={pin.assetName}
                  onPointerDown={(event) => onPinDown(event, pin)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-md ${PIN_COLOR[pin.state]} ${selectedPin?.id === pin.id ? "ring-4 ring-brand-300" : ""} ${canEdit ? "cursor-move" : "cursor-pointer"}`}
                  style={{ left: `${pin.x}%`, top: `${pin.y}%`, width: `${18 / view.scale + 4}px`, height: `${18 / view.scale + 4}px`, touchAction: "none" }}
                />
              ))}
            </div>
            <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm">
              <button type="button" aria-label="Zoom in" className="p-2 hover:bg-slate-50" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoom(0.5)}><Plus size={14} /></button>
              <button type="button" aria-label="Zoom out" className="border-t border-slate-200 p-2 hover:bg-slate-50" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoom(-0.5)}><Minus size={14} /></button>
              <button type="button" aria-label="Reset zoom" className="border-t border-slate-200 p-2 hover:bg-slate-50" onPointerDown={(e) => e.stopPropagation()} onClick={() => setView({ scale: 1, x: 0, y: 0 })}><Maximize2 size={14} /></button>
            </div>
            {selectedPin ? (
              <div className="absolute bottom-3 left-3 w-64 rounded-xl bg-white p-3 text-sm shadow-lg" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{selectedPin.assetName}</p>
                    <p className="text-xs text-slate-500">{[selectedPin.assetTag, selectedPin.assetLocation].filter(Boolean).join(" · ")}</p>
                  </div>
                  <button type="button" aria-label="Close" className="text-slate-400 hover:text-slate-700" onClick={() => setSelected(null)}>✕</button>
                </div>
                <p className="mt-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${selectedPin.state === "OPEN_JOB" ? "bg-rose-100 text-rose-700" : selectedPin.state === "RETIRED" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                    {selectedPin.state === "OPEN_JOB" ? `${selectedPin.openJobs} open job${selectedPin.openJobs === 1 ? "" : "s"}` : selectedPin.state === "RETIRED" ? "Retired" : "All good"}
                  </span>
                </p>
                {selectedPin.latestJob ? <p className="mt-1 text-xs text-slate-600">{[selectedPin.latestJob.woNumber, selectedPin.latestJob.title].filter(Boolean).join(" · ")}</p> : null}
                <div className="mt-2 flex gap-4 text-xs font-semibold text-brand-600">
                  <Link href={`/assets?asset=${encodeURIComponent(selectedPin.assetId)}` as Route} className="hover:underline">Open asset →</Link>
                  {selectedPin.latestJob ? <Link href={`/work-orders/${selectedPin.latestJob.id}` as Route} className="hover:underline">Open job →</Link> : null}
                </div>
                {canEdit ? <p className="mt-2 text-[11px] text-slate-400">Drag the pin to move it.</p> : null}
              </div>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" />Has open job</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />All good</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-slate-400" />Retired</span>
            <span className="ml-auto text-slate-400">Scroll to zoom · drag the map to move</span>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="text-sm font-semibold text-slate-900">Find an asset</h2>
            <div className="relative mt-2">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Name or tag" aria-label="Find an asset on this plan" className="min-h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm" />
            </div>
            {visibleList.length === 0 ? <p className="mt-3 text-sm text-slate-500">{pins.length === 0 ? "Nothing pinned yet." : "No match on this plan."}</p> : null}
            <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-auto">
              {visibleList.map((pin) => (
                <li key={pin.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <i className={`h-2.5 w-2.5 shrink-0 rounded-full ${PIN_COLOR[pin.state]}`} />
                    <span className="truncate">{pin.assetName}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => show(pin)}>Show</button>
                    {canEdit ? <button type="button" onClick={() => void removePin(pin)} className="text-slate-400 hover:text-rose-700" aria-label={`Remove ${pin.assetName}`}>✕</button> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          {canEdit ? (
            <section className="rounded-xl border border-slate-200 bg-white p-3">
              <h2 className="text-sm font-semibold text-slate-900">Add an asset to this plan</h2>
              <div className="mt-2">
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
              <p className="mt-2 text-xs text-slate-500">{assetId ? "Now tap its place on the map." : "Pick it, then tap its place on the map."}</p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
