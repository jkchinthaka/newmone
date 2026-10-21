"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  buildRegisterVehiclePayload,
  emptyRegisterVehicleInput,
  FUEL_TYPE_OPTIONS,
  OWNERSHIP_TYPE_OPTIONS,
  RegisterVehicleInput,
  VEHICLE_TYPE_OPTIONS,
  VEHICLE_YEAR_MIN,
  vehicleApiFieldErrors,
  vehicleYearMax
} from "@/lib/vehicle-register";

function labelFor(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const fieldClass = "mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm";

export default function RegisterVehiclePage() {
  const user = useCurrentUser();
  const savingRef = useRef(false);
  const [form, setForm] = useState<RegisterVehicleInput>(emptyRegisterVehicleInput);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState("");
  const [ready, setReady] = useState(false);
  const yearMax = vehicleYearMax();

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <h1 className="page-title">Register vehicle</h1>
      </main>
    );
  }

  if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
    return <p className="p-4">Access required</p>;
  }

  function update(field: keyof RegisterVehicleInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyRegisterVehicleInput());
    setFieldErrors({});
    setError("");
    setCreatedId("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current || createdId) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const payload = buildRegisterVehiclePayload(form);
      const response = await apiClient.post("/vehicles", payload);
      setCreatedId(response.data?.data?.id ?? "");
    } catch (cause) {
      const fields = vehicleApiFieldErrors(cause);
      setFieldErrors(fields);
      setError(
        cause instanceof Error && !("response" in cause)
          ? cause.message
          : getApiErrorMessage(cause, "The vehicle could not be registered.")
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Register vehicle" }]} />
      <div>
        <h1 className="page-title">Register vehicle</h1>
        <p className="mt-1 text-sm text-slate-600">Add a vehicle to this company.</p>
      </div>
      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2"
        onSubmit={submit}
      >
        <Field
          id="registration"
          label="Registration number"
          hint="e.g. CP ABC-1234"
          error={fieldErrors.registrationNo}
          required
        >
          <input
            id="registration"
            className={fieldClass}
            required
            autoComplete="off"
            aria-invalid={Boolean(fieldErrors.registrationNo)}
            value={form.registrationNo}
            onChange={(event) => update("registrationNo", event.target.value)}
          />
        </Field>
        <Field id="type" label="Vehicle type" hint="Select the body type" error={fieldErrors.type} required>
          <select
            id="type"
            className={fieldClass}
            required
            aria-invalid={Boolean(fieldErrors.type)}
            value={form.type}
            onChange={(event) => update("type", event.target.value)}
          >
            <option value="">Select vehicle type</option>
            {VEHICLE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {labelFor(option)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="fuel" label="Fuel type" hint="Select the fuel" error={fieldErrors.fuelType} required>
          <select
            id="fuel"
            className={fieldClass}
            required
            aria-invalid={Boolean(fieldErrors.fuelType)}
            value={form.fuelType}
            onChange={(event) => update("fuelType", event.target.value)}
          >
            <option value="">Select fuel type</option>
            {FUEL_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {labelFor(option)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="make" label="Make" hint="e.g. Tata" error={fieldErrors.make} required>
          <input
            id="make"
            className={fieldClass}
            required
            value={form.make}
            aria-invalid={Boolean(fieldErrors.make)}
            onChange={(event) => update("make", event.target.value)}
          />
        </Field>
        <Field id="model" label="Model" hint="e.g. Ace" error={fieldErrors.vehicleModel} required>
          <input
            id="model"
            className={fieldClass}
            required
            value={form.vehicleModel}
            aria-invalid={Boolean(fieldErrors.vehicleModel)}
            onChange={(event) => update("vehicleModel", event.target.value)}
          />
        </Field>
        <Field
          id="year"
          label="Year"
          hint={`${VEHICLE_YEAR_MIN} to ${yearMax}`}
          error={fieldErrors.year}
          required
        >
          <input
            id="year"
            className={fieldClass}
            required
            type="number"
            min={VEHICLE_YEAR_MIN}
            max={yearMax}
            step={1}
            value={form.year}
            aria-invalid={Boolean(fieldErrors.year)}
            onChange={(event) => update("year", event.target.value)}
          />
        </Field>
        <details className="md:col-span-2 rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">More details (optional)</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field id="ownership" label="Ownership" hint="Leave blank if unknown" error={fieldErrors.ownershipType}>
              <select
                id="ownership"
                className={fieldClass}
                value={form.ownershipType}
                aria-invalid={Boolean(fieldErrors.ownershipType)}
                onChange={(event) => update("ownershipType", event.target.value)}
              >
                <option value="">Not set</option>
                {OWNERSHIP_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {labelFor(option)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="mileage" label="Current mileage (km)" hint="0 or more" error={fieldErrors.currentMileage}>
              <input
                id="mileage"
                className={fieldClass}
                type="number"
                min={0}
                step="any"
                value={form.currentMileage}
                aria-invalid={Boolean(fieldErrors.currentMileage)}
                onChange={(event) => update("currentMileage", event.target.value)}
              />
            </Field>
            <Field id="asset-tag" label="Asset tag" hint="Optional" error={fieldErrors.assetTag}>
              <input
                id="asset-tag"
                className={fieldClass}
                value={form.assetTag}
                aria-invalid={Boolean(fieldErrors.assetTag)}
                onChange={(event) => update("assetTag", event.target.value)}
              />
            </Field>
          </div>
        </details>
        {error && Object.keys(fieldErrors).length === 0 ? (
          <p className="md:col-span-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60 md:col-span-2"
          disabled={saving || Boolean(createdId)}
          type="submit"
        >
          {saving ? "Registering..." : "Register vehicle"}
        </button>
      </form>
      {createdId ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p role="status">Vehicle registered.</p>
          <Link className="text-sm font-medium text-brand-700 hover:underline" href={`/vehicles/${createdId}` as never}>
            Open vehicle
          </Link>
          <button className="block text-sm font-medium text-slate-700 underline" type="button" onClick={resetForm}>
            Register another
          </button>
        </div>
      ) : null}
    </main>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  required,
  children
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500" htmlFor={id}>
        {label}
        {required ? <span className="text-rose-700"> *</span> : null}
      </label>
      {children}
      <p className="mt-1 text-xs text-slate-500" id={`${id}-hint`}>
        {hint}
      </p>
      {error ? (
        <p className="mt-1 text-sm text-rose-700" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
