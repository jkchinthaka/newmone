"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { EntityPicker } from "@/components/ui/entity-picker";
import { suggestWorkOrderTaxonomy, formatTaxonomyPathLabel, type TaxonomySuggestion } from "@/lib/work-order-taxonomy-api";

import { requiresAssetOrVehicle, toTitleCase } from "./helpers";
import { WorkOrderTaxonomyPicker } from "./work-order-taxonomy-picker";
import { WORK_ORDER_PRIORITIES, WORK_ORDER_TYPES, type WorkOrderPriority, type WorkOrderType } from "./types";

function isWorkOrderPriority(value: string | undefined): value is WorkOrderPriority {
  return Boolean(value && WORK_ORDER_PRIORITIES.includes(value as WorkOrderPriority));
}

export type GuidedCreateValues = {
  title: string;
  description: string;
  priority: WorkOrderPriority;
  type: WorkOrderType;
  dueDate?: string;
  expectedCompletionDate?: string;
  assetId?: string;
  vehicleId?: string;
  taxonomyCategoryId?: string;
  taxonomyTypeId?: string;
  taxonomyIssueId?: string;
  isTriage?: boolean;
  triageReason?: string;
  taxonomyPathLabel?: string;
};

type Props = {
  submitting: boolean;
  onSubmit: (values: GuidedCreateValues) => void;
};

const STEPS = ["Context", "Work", "Plan", "Review"] as const;

export function WorkOrderGuidedCreate({ submitting, onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<WorkOrderPriority>("MEDIUM");
  const [type, setType] = useState<WorkOrderType>("CORRECTIVE");
  const [dueDate, setDueDate] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [assetId, setAssetId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [assetLabel, setAssetLabel] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<TaxonomySuggestion | null>(null);
  const [suggestionUnavailable, setSuggestionUnavailable] = useState(false);
  const [taxonomySelection, setTaxonomySelection] = useState<{
    categoryId?: string;
    typeId?: string;
    issueId?: string;
    pathLabel?: string;
    isTriage?: boolean;
  }>({});

  useEffect(() => {
    const trimmed = description.trim();
    if (trimmed.length < 2) {
      setSuggestion(null);
      setSuggestionUnavailable(false);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSuggesting(true);
      setSuggestionUnavailable(false);
      try {
        const result = await suggestWorkOrderTaxonomy(trimmed);
        const nextSuggestion = result.suggestion ?? null;
        setSuggestion(nextSuggestion);
        if (nextSuggestion && !taxonomySelection.pathLabel) {
          setTaxonomySelection({
            categoryId: nextSuggestion.categoryId,
            typeId: nextSuggestion.typeId,
            issueId: nextSuggestion.issueId,
            pathLabel: formatTaxonomyPathLabel(nextSuggestion)
          });
          if (isWorkOrderPriority(nextSuggestion.defaultPriority)) {
            setPriority(nextSuggestion.defaultPriority);
          }
        }
      } catch {
        setSuggestion(null);
        setSuggestionUnavailable(true);
      } finally {
        setSuggesting(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [description, taxonomySelection.pathLabel]);

  const requiresVehicle = suggestion?.requiresVehicle || taxonomySelection.pathLabel?.includes("Fleet");
  const requiresAsset = requiresAssetOrVehicle(type) || suggestion?.requiresAsset;

  const canContinue =
    step === 0
      ? description.trim().length >= 4
      : step === 1
        ? Boolean(taxonomySelection.pathLabel) && title.trim().length > 0
        : true;

  const submit = () => {
    onSubmit({
      title: title.trim() || description.trim().slice(0, 80),
      description: description.trim(),
      priority,
      type,
      dueDate: dueDate || undefined,
      // Do not copy dueDate into expectedCompletionDate — they are independent planning fields.
      expectedCompletionDate: undefined,
      assetId: assetId || undefined,
      vehicleId: vehicleId || undefined,
      taxonomyCategoryId: taxonomySelection.categoryId,
      taxonomyTypeId: taxonomySelection.typeId,
      taxonomyIssueId: taxonomySelection.issueId,
      isTriage: taxonomySelection.isTriage || taxonomySelection.pathLabel?.includes("Triage"),
      triageReason:
        taxonomySelection.isTriage || taxonomySelection.pathLabel?.includes("Triage")
          ? description.trim()
          : undefined,
      taxonomyPathLabel: taxonomySelection.pathLabel
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="list" aria-label="Create work order steps">
        {STEPS.map((label, index) => (
          <span
            key={label}
            role="listitem"
            aria-current={index === step ? "step" : undefined}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              index === step
                ? "bg-brand-600 text-white"
                : index < step
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {step === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Start with where the work belongs and what was observed. Suggested urgency is not final priority.
          </p>
          <label className="block space-y-1 text-sm text-slate-700">
            <span className="font-medium">What needs attention</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Example: cold room temperature high, printer not printing, brake noise on vehicle"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
            />
            {suggesting ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 size={12} className="animate-spin" aria-hidden /> Finding category suggestions...
              </div>
            ) : suggestion ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                Suggested: {suggestion.pathLabel} ({suggestion.confidence}% confidence)
                {suggestion.warnings.length ? ` — ${suggestion.warnings.join(", ")}` : ""}
              </div>
            ) : suggestionUnavailable ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Category suggestions are currently unavailable. You can still select manually or use Triage in the next
                step.
              </div>
            ) : null}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Asset (optional)</span>
              <EntityPicker
                endpoint="/assets"
                value={assetId || null}
                displayField="name"
                secondaryField="assetTag"
                initialDisplay={assetLabel}
                placeholder="Search assets..."
                onChange={(id, entity) => {
                  setAssetId(id ?? "");
                  setAssetLabel(entity ? String(entity.name ?? entity.assetTag ?? "") : "");
                }}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Vehicle (optional)</span>
              <EntityPicker
                endpoint="/vehicles"
                value={vehicleId || null}
                displayField="registrationNo"
                secondaryField="vehicleModel"
                initialDisplay={vehicleLabel}
                placeholder="Search vehicles..."
                onChange={(id, entity) => {
                  setVehicleId(id ?? "");
                  setVehicleLabel(entity ? String(entity.registrationNo ?? entity.vehicleModel ?? "") : "");
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <WorkOrderTaxonomyPicker
            value={taxonomySelection}
            onChange={(value) =>
              setTaxonomySelection({
                categoryId: value.categoryId,
                typeId: value.typeId,
                issueId: value.issueId,
                pathLabel: value.pathLabel,
                isTriage: value.isTriage ?? value.pathLabel.includes("Triage")
              })
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
              <span className="font-medium">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={description.slice(0, 80)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">Priority</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as WorkOrderPriority)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {WORK_ORDER_PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {toTitleCase(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">Work type</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as WorkOrderType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {WORK_ORDER_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {toTitleCase(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {requiresAsset && !assetId ? (
            <p className="text-sm text-amber-800">This work type normally needs an asset. Select one in Context or continue if triage.</p>
          ) : null}
          {requiresVehicle && !vehicleId ? (
            <p className="text-sm text-amber-800">This category normally needs a vehicle. Select one in Context if available.</p>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm text-slate-600">
            Planning dates are optional at create time. Creating a work order leaves it Open with planning incomplete —
            it does not mark the job Planned.
          </p>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">Planned start (optional)</span>
            <input
              type="date"
              value={plannedStart}
              onChange={(event) => setPlannedStart(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <span className="text-xs text-slate-500">Independent from due date. Expected completion is set during planning.</span>
          </label>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div>
            <span className="font-medium">Target:</span>{" "}
            {assetLabel || vehicleLabel || "Not selected (can be set during planning)"}
          </div>
          <div>
            <span className="font-medium">Classification:</span> {taxonomySelection.pathLabel || "—"}
          </div>
          <div>
            <span className="font-medium">Work:</span> {title.trim() || description.slice(0, 80)}
          </div>
          <div>
            <span className="font-medium">Type / Priority:</span> {toTitleCase(type)} / {toTitleCase(priority)}
          </div>
          <div>
            <span className="font-medium">Due:</span> {dueDate || "Not set"}
            {plannedStart ? ` · Planned start: ${plannedStart}` : ""}
          </div>
          <div>
            <span className="font-medium">Initial status:</span> Open (planning incomplete)
          </div>
          {suggestion?.requiresEvidence ? <div className="text-amber-800">Evidence will be required.</div> : null}
          {suggestion?.gateOutBlockingRisk ? <div className="text-red-800">Gate-out block risk applies.</div> : null}
          {taxonomySelection.isTriage ? <div className="text-amber-800">This work order will enter the triage queue.</div> : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button
          type="button"
          disabled={step === 0 || submitting}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canContinue || submitting}
            onClick={() => setStep((current) => current + 1)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Create work order"}
          </button>
        )}
      </div>
    </div>
  );
}
