"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";

import { EntityPicker } from "@/components/ui/entity-picker";
import { pmPlanDraftError } from "@/lib/pm-plan-list";

export type PmPlanCreateValues = {
  name: string;
  description: string;
  assetId: string;
  vehicleId: string;
  trigger: string;
  intervalDays: number;
  intervalValue: number;
  unit: string;
  autoWo: boolean;
  effectiveFrom: string;
};

type Props = {
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: PmPlanCreateValues, activate: boolean) => Promise<void>;
};

export function CreatePmPlanDialog({ busy, error, onClose, onSubmit }: Props) {
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assetId, setAssetId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [assetLabel, setAssetLabel] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [trigger, setTrigger] = useState("CALENDAR");
  const [intervalDays, setIntervalDays] = useState("30");
  const [intervalValue, setIntervalValue] = useState("250");
  const [unit, setUnit] = useState("hrs");
  const [autoWo, setAutoWo] = useState(true);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (event: FormEvent, activate: boolean) => {
    event.preventDefault();
    const message = pmPlanDraftError({
      name,
      assetId,
      vehicleId,
      trigger,
      intervalDays,
      intervalValue,
      activate
    });
    if (message) {
      setLocalError(message);
      return;
    }
    setLocalError(null);
    void onSubmit(
      {
        name: name.trim(),
        description: description.trim(),
        assetId: assetId.trim(),
        vehicleId: vehicleId.trim(),
        trigger,
        intervalDays: trigger === "METER" ? 0 : Number(intervalDays),
        intervalValue: trigger === "CALENDAR" ? 0 : Number(intervalValue),
        unit,
        autoWo,
        effectiveFrom
      },
      activate
    );
  };

  const shownError = localError || error;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close create plan" onClick={onClose} />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-4 shadow-xl"
        onSubmit={(event) => submit(event, false)}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            Create PM Plan
          </h2>
          <button type="button" className="min-h-10 px-2 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Plan name
            <input
              ref={nameRef}
              className="mt-1 min-h-10 w-full rounded-lg border px-3"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea className="mt-1 w-full rounded-lg border px-3 py-2" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Asset</span>
            <EntityPicker
              endpoint="/assets"
              searchParam="search"
              pageSizeParam="limit"
              pageSize={20}
              extraParams={{ selectableForWork: true, status: "ACTIVE" }}
              value={assetId || null}
              displayField="name"
              secondaryField="assetTag"
              initialDisplay={assetLabel}
              placeholder="Search asset by name or tag..."
              onChange={(id, entity) => {
                setAssetId(id ?? "");
                if (id) {
                  setVehicleId("");
                  setVehicleLabel("");
                }
                const tag = entity ? String(entity.assetTag ?? "") : "";
                const assetName = entity ? String(entity.name ?? "") : "";
                setAssetLabel([tag, assetName].filter(Boolean).join(" — ") || assetName);
              }}
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Vehicle</span>
            <EntityPicker
              endpoint="/vehicles"
              value={vehicleId || null}
              displayField="registrationNo"
              secondaryField="vehicleModel"
              initialDisplay={vehicleLabel}
              placeholder="Search vehicle by registration..."
              onChange={(id, entity) => {
                setVehicleId(id ?? "");
                if (id) {
                  setAssetId("");
                  setAssetLabel("");
                }
                setVehicleLabel(entity ? String(entity.registrationNo ?? "") : "");
              }}
            />
          </div>
          <label className="block text-sm">
            Trigger
            <select className="mt-1 min-h-10 w-full rounded-lg border px-2" value={trigger} onChange={(event) => setTrigger(event.target.value)}>
              <option value="CALENDAR">Calendar</option>
              <option value="METER">Meter</option>
              <option value="HYBRID">Calendar or meter, whichever comes first</option>
            </select>
          </label>
          {trigger !== "METER" ? (
            <label className="block text-sm">
              Calendar interval (days)
              <input type="number" min={1} className="mt-1 min-h-10 w-full rounded-lg border px-3" value={intervalDays} onChange={(event) => setIntervalDays(event.target.value)} />
            </label>
          ) : null}
          {trigger !== "CALENDAR" ? (
            <label className="block text-sm">
              Meter interval
              <input type="number" min={1} className="mt-1 min-h-10 w-full rounded-lg border px-3" value={intervalValue} onChange={(event) => setIntervalValue(event.target.value)} />
            </label>
          ) : null}
          <label className="block text-sm">
            Effective date
            <input type="date" className="mt-1 min-h-10 w-full rounded-lg border px-3" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoWo} onChange={(event) => setAutoWo(event.target.checked)} />
            Auto-generate work order when due
          </label>
        </div>
        {shownError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {shownError}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="min-h-10 rounded-lg border px-3 text-sm" disabled={busy}>
            Save draft
          </button>
          <button type="button" className="min-h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white" disabled={busy} onClick={(event) => submit(event, true)}>
            Activate plan
          </button>
        </div>
      </form>
    </div>
  );
}
