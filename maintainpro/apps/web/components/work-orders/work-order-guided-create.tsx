"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

import { EntityPicker } from "@/components/ui/entity-picker";
import type { JobDomain } from "@/lib/job-domain";
import { JOB_DOMAIN_LABELS } from "@/lib/job-domain";
import {
  createFormTitle,
  primaryCreateFields,
  suggestWorkOrderTitle
} from "@/lib/work-order-create-hci";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

import { toTitleCase } from "./helpers";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_TYPES,
  type WorkOrderPriority,
  type WorkOrderType
} from "./types";

type JobCategoryOption = {
  id: string;
  code: string;
  name: string;
  jobDomain: string;
  level: string;
  active: boolean;
};

export type GuidedCreateValues = {
  title: string;
  description: string;
  priority: WorkOrderPriority;
  type: WorkOrderType;
  dueDate?: string;
  expectedCompletionDate?: string;
  assetId?: string;
  vehicleId?: string;
  functionalLocationId?: string;
  /** Always stamped from the domain lane / picker — never rely on inference alone. */
  jobDomain: JobDomain;
  /** VEHICLE direct create — current odometer at request time. */
  currentOdometer?: number;
  /** Master-data MaintenanceJobCategory (Service / Problem Category). */
  jobCategoryId?: string;
};

type Props = {
  submitting: boolean;
  /** Known when opened from /maintenance/jobs/{machinery|service|vehicle}. */
  jobDomain?: JobDomain;
  onSubmit: (values: GuidedCreateValues) => void;
  onCancel?: () => void;
};

/**
 * Single-screen Direct Create with progressive disclosure.
 * Category values come from MaintenanceJobCategory master data — not triage suggestion UI.
 */
export function WorkOrderGuidedCreate({ submitting, jobDomain: lockedDomain, onSubmit, onCancel }: Props) {
  const formId = useId();
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const [pickedDomain, setPickedDomain] = useState<JobDomain | null>(lockedDomain ?? null);
  const domain = lockedDomain ?? pickedDomain;

  const [description, setDescription] = useState("");
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [priority, setPriority] = useState<WorkOrderPriority>("MEDIUM");
  const [type, setType] = useState<WorkOrderType>("CORRECTIVE");
  const [dueDate, setDueDate] = useState("");
  const [expectedCompletionDate, setExpectedCompletionDate] = useState("");
  const [assetId, setAssetId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [functionalLocationId, setFunctionalLocationId] = useState("");
  const [assetLabel, setAssetLabel] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [jobCategoryId, setJobCategoryId] = useState("");
  const [currentOdometer, setCurrentOdometer] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lockedDomain) {
      setPickedDomain(lockedDomain);
    }
  }, [lockedDomain]);

  useEffect(() => {
    if (!domain) return;
    setAssetId("");
    setVehicleId("");
    setFunctionalLocationId("");
    setAssetLabel("");
    setVehicleLabel("");
    setLocationLabel("");
    setJobCategoryId("");
    setFieldErrors({});
  }, [domain]);

  const categoriesQuery = useQuery({
    queryKey: withTenantScope(["work-orders", "job-categories", domain ?? "none"]),
    enabled: Boolean(domain),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiClient.get<{ data: JobCategoryOption[] }>("/work-orders/job-categories", {
        params: { jobDomain: domain, level: "SUB" }
      });
      return res.data.data ?? [];
    }
  });

  const fields = domain ? primaryCreateFields(domain) : null;
  const entityLabel = assetLabel || vehicleLabel || locationLabel || "";
  const autoTitle = suggestWorkOrderTitle({ description, entityLabel });
  const effectiveTitle = (titleOverride ?? autoTitle).trim();
  const categories = categoriesQuery.data ?? [];

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!domain) {
      next.domain = "Select what kind of work this is.";
    }
    if (description.trim().length < 4) {
      next.description = "Describe the problem in a few words.";
    }
    if (!effectiveTitle) {
      next.title = "A title is required.";
    }
    if (domain === "MACHINERY" && !assetId) {
      next.assetId = "Select a machine / asset.";
    }
    if (domain === "VEHICLE" && !vehicleId) {
      next.vehicleId = "Select a vehicle.";
    }
    if (domain === "SERVICE" && !functionalLocationId) {
      next.functionalLocationId = "Select a location / facility.";
    }
    if (domain === "SERVICE" && !jobCategoryId) {
      next.jobCategoryId = "Select a service category.";
    }
    if (domain === "VEHICLE") {
      const reading = Number(currentOdometer);
      if (!currentOdometer.trim() || !Number.isFinite(reading) || reading < 0) {
        next.currentOdometer = "Enter the current odometer reading.";
      }
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (submitting) return;
    if (!validate() || !domain) {
      descriptionRef.current?.focus();
      return;
    }

    onSubmit({
      title: effectiveTitle,
      description: description.trim(),
      priority,
      type: domain === "SERVICE" ? type || "CORRECTIVE" : type,
      dueDate: dueDate || undefined,
      expectedCompletionDate: expectedCompletionDate || undefined,
      assetId: assetId || undefined,
      vehicleId: vehicleId || undefined,
      functionalLocationId: functionalLocationId || undefined,
      jobDomain: domain,
      jobCategoryId: jobCategoryId || undefined,
      currentOdometer:
        domain === "VEHICLE" && currentOdometer.trim()
          ? Number(currentOdometer)
          : undefined
    });
  };

  if (!domain) {
    return (
      <div className="space-y-5" role="group" aria-labelledby={`${formId}-kind`}>
        <div>
          <h3 id={`${formId}-kind`} className="text-base font-semibold text-slate-900">
            What kind of work?
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Choose a domain once. The create form will match that lane.
          </p>
          {fieldErrors.domain ? (
            <p className="mt-2 text-sm text-rose-700" role="alert">
              {fieldErrors.domain}
            </p>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["MACHINERY", "SERVICE", "VEHICLE"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setPickedDomain(option);
                setFieldErrors((current) => {
                  const { domain: _removed, ...rest } = current;
                  return rest;
                });
              }}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {option === "SERVICE" ? "Facility / Service" : JOB_DOMAIN_LABELS[option]}
            </button>
          ))}
        </div>
        {onCancel ? (
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const categoryLabel = domain === "SERVICE" ? "Service Category" : "Problem Category";
  const renderCategorySelect = () => (
    <label className="block space-y-1 text-sm text-slate-700">
      <span className="font-medium">
        {categoryLabel}
        {domain === "SERVICE" ? <span className="text-rose-600"> *</span> : null}
      </span>
      <select
        value={jobCategoryId}
        onChange={(event) => setJobCategoryId(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
        required={domain === "SERVICE"}
        disabled={categoriesQuery.isLoading}
        aria-invalid={Boolean(fieldErrors.jobCategoryId)}
        aria-busy={categoriesQuery.isLoading}
      >
        <option value="">
          {categoriesQuery.isLoading
            ? "Loading categories…"
            : domain === "SERVICE"
              ? "Select service category…"
              : "Select problem category…"}
        </option>
        {categories.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {categoriesQuery.isError ? (
        <p className="text-sm text-rose-700" role="alert">
          {getApiErrorMessage(categoriesQuery.error, "Unable to load categories")}
        </p>
      ) : null}
      {!categoriesQuery.isLoading && !categoriesQuery.isError && categories.length === 0 ? (
        <p className="text-xs text-slate-500">
          No active categories configured. Ask an administrator to seed Job Categories.
        </p>
      ) : null}
      {fieldErrors.jobCategoryId ? (
        <p className="text-sm text-rose-700" role="alert">
          {fieldErrors.jobCategoryId}
        </p>
      ) : null}
    </label>
  );

  return (
    <form
      className="space-y-4"
      aria-labelledby={`${formId}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div>
        <h3 id={`${formId}-title`} className="text-base font-semibold text-slate-900">
          {createFormTitle(domain)}
        </h3>
        {!lockedDomain ? (
          <button
            type="button"
            className="mt-1 text-xs font-medium text-brand-700 hover:underline"
            onClick={() => setPickedDomain(null)}
          >
            Change work kind
          </button>
        ) : null}
      </div>

      {fields?.showAsset ? (
        <div className="space-y-1">
          <span className="text-sm font-medium text-slate-700">
            {fields.assetLabel} <span className="text-rose-600">*</span>
          </span>
          <EntityPicker
            endpoint="/assets"
            searchParam="search"
            pageSizeParam="limit"
            pageSize={20}
            value={assetId || null}
            displayField="name"
            secondaryField="assetTag"
            initialDisplay={assetLabel}
            placeholder="Search machine..."
            required
            onChange={(id, entity) => {
              setAssetId(id ?? "");
              const tag = entity ? String(entity.assetTag ?? "") : "";
              const name = entity ? String(entity.name ?? "") : "";
              setAssetLabel([tag, name].filter(Boolean).join(" — ") || name);
            }}
          />
          {fieldErrors.assetId ? (
            <p className="text-sm text-rose-700" role="alert">
              {fieldErrors.assetId}
            </p>
          ) : null}
        </div>
      ) : null}

      {fields?.showVehicle ? (
        <div className="space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Vehicle <span className="text-rose-600">*</span>
          </span>
          <EntityPicker
            endpoint="/vehicles"
            value={vehicleId || null}
            displayField="registrationNo"
            secondaryField="vehicleModel"
            initialDisplay={vehicleLabel}
            placeholder="Search vehicle..."
            required
            onChange={(id, entity) => {
              setVehicleId(id ?? "");
              const reg = entity ? String(entity.registrationNo ?? "") : "";
              const model = entity ? String(entity.vehicleModel ?? entity.make ?? "") : "";
              setVehicleLabel([reg, model].filter(Boolean).join(" — ") || reg);
            }}
          />
          {fieldErrors.vehicleId ? (
            <p className="text-sm text-rose-700" role="alert">
              {fieldErrors.vehicleId}
            </p>
          ) : null}
          <label className="block space-y-1 text-sm text-slate-700">
            <span className="font-medium">
              Current odometer <span className="text-rose-600">*</span>
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={currentOdometer}
              onChange={(event) => setCurrentOdometer(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="e.g. 126520"
              required
            />
            {fieldErrors.currentOdometer ? (
              <p className="text-sm text-rose-700" role="alert">
                {fieldErrors.currentOdometer}
              </p>
            ) : null}
          </label>
        </div>
      ) : null}

      {fields?.showLocation ? (
        <div className="space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Location / Facility <span className="text-rose-600">*</span>
          </span>
          <EntityPicker
            endpoint="/organization/locations"
            value={functionalLocationId || null}
            displayField="name"
            secondaryField="code"
            initialDisplay={locationLabel}
            placeholder="Select location..."
            required
            onChange={(id, entity) => {
              setFunctionalLocationId(id ?? "");
              setLocationLabel(entity ? String(entity.name ?? entity.code ?? "") : "");
            }}
          />
          {fieldErrors.functionalLocationId ? (
            <p className="text-sm text-rose-700" role="alert">
              {fieldErrors.functionalLocationId}
            </p>
          ) : null}
        </div>
      ) : null}

      {fields?.showServiceCategory ? renderCategorySelect() : null}

      <label className="block space-y-1 text-sm text-slate-700">
        <span className="font-medium">
          {fields?.problemLabel ?? "Problem / Work Required"} <span className="text-rose-600">*</span>
        </span>
        <textarea
          ref={descriptionRef}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          required
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={fieldErrors.description ? `${formId}-desc-error` : undefined}
          placeholder="Describe the problem..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
        />
        {fieldErrors.description ? (
          <p id={`${formId}-desc-error`} className="text-sm text-rose-700" role="alert">
            {fieldErrors.description}
          </p>
        ) : null}
      </label>

      <div className={`grid gap-4 ${fields?.showWorkType ? "sm:grid-cols-2" : ""}`}>
        <label className="block space-y-1 text-sm text-slate-700">
          <span className="font-medium">Priority</span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as WorkOrderPriority)}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {WORK_ORDER_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {toTitleCase(item)}
              </option>
            ))}
          </select>
        </label>
        {fields?.showWorkType ? (
          <label className="block space-y-1 text-sm text-slate-700">
            <span className="font-medium">Work Type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as WorkOrderType)}
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {WORK_ORDER_TYPES.map((item) => (
                <option key={item} value={item}>
                  {toTitleCase(item)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div>
        <button
          type="button"
          aria-expanded={showMore}
          onClick={() => setShowMore((current) => !current)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          {showMore ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
          More options
        </button>
        {showMore ? (
          <div className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            {domain === "MACHINERY" || domain === "VEHICLE" ? renderCategorySelect() : null}
            <label className="block space-y-1 text-sm text-slate-700">
              <span className="font-medium">Title</span>
              <input
                value={titleOverride ?? autoTitle}
                onChange={(event) => setTitleOverride(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <span className="text-xs text-slate-500">
                Auto-filled from the problem description. Edit only if needed.
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm text-slate-700">
                <span className="font-medium">Due date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block space-y-1 text-sm text-slate-700">
                <span className="font-medium">Expected completion</span>
                <input
                  type="date"
                  value={expectedCompletionDate}
                  onChange={(event) => setExpectedCompletionDate(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
            {domain === "SERVICE" ? (
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Linked asset (optional)</span>
                <EntityPicker
                  endpoint="/assets"
                  searchParam="search"
                  pageSizeParam="limit"
                  pageSize={20}
                  value={assetId || null}
                  displayField="name"
                  secondaryField="assetTag"
                  initialDisplay={assetLabel}
                  placeholder="Search asset..."
                  onChange={(id, entity) => {
                    setAssetId(id ?? "");
                    setAssetLabel(entity ? String(entity.name ?? "") : "");
                  }}
                />
              </div>
            ) : null}
            <p className="text-xs text-slate-500">
              Technician assignment, planned start, parts, permits, and vendor repair are handled in
              Planning after the work order is created as Open.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        {onCancel ? (
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="min-h-11 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              Creating…
            </span>
          ) : (
            "Create Work Order"
          )}
        </button>
      </div>
    </form>
  );
}
