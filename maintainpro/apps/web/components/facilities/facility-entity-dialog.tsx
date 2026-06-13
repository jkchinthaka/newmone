"use client";

import { useEffect, useId } from "react";
import { Loader2 } from "lucide-react";

import { FACILITY_ROOM_TYPE_OPTIONS, type FacilityHierarchyLevel, type FacilityRoomType } from "@/lib/facilities";

export type FacilityEntityFormValues = {
  name: string;
  code: string;
  address: string;
  description: string;
  levelNumber: string;
  roomType: FacilityRoomType | "";
};

export const EMPTY_FACILITY_FORM: FacilityEntityFormValues = {
  name: "",
  code: "",
  address: "",
  description: "",
  levelNumber: "",
  roomType: ""
};

type FacilityEntityDialogProps = {
  open: boolean;
  level: FacilityHierarchyLevel;
  mode: "create" | "edit";
  values: FacilityEntityFormValues;
  submitting?: boolean;
  onChange: (values: FacilityEntityFormValues) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function FacilityEntityDialog({
  open,
  level,
  mode,
  values,
  submitting = false,
  onChange,
  onSubmit,
  onClose
}: FacilityEntityDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting, onClose]);

  if (!open) {
    return null;
  }

  const title =
    mode === "create"
      ? `Create ${level === "property" ? "property" : level}`
      : `Edit ${level === "property" ? "property" : level}`;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0"
        onClick={submitting ? undefined : onClose}
        disabled={submitting}
      />
      <form
        className="relative z-[1] w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Hierarchy records are tenant-scoped. Deactivate records instead of deleting them.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Name</span>
            <input
              required
              value={values.name}
              onChange={(event) => onChange({ ...values, name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          {(level === "property" || level === "building" || level === "room") && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Code{level === "room" ? " (optional)" : ""}</span>
              <input
                required={level !== "room"}
                value={values.code}
                onChange={(event) => onChange({ ...values, code: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              />
            </label>
          )}

          {level === "property" && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Address (optional)</span>
              <input
                value={values.address}
                onChange={(event) => onChange({ ...values, address: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}

          {level === "building" && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Description (optional)</span>
              <textarea
                value={values.description}
                onChange={(event) => onChange({ ...values, description: event.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}

          {level === "floor" && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Level number (optional)</span>
              <input
                inputMode="numeric"
                value={values.levelNumber}
                onChange={(event) => onChange({ ...values, levelNumber: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}

          {level === "room" && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Room type (optional)</span>
              <select
                value={values.roomType}
                onChange={(event) =>
                  onChange({ ...values, roomType: event.target.value as FacilityRoomType | "" })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select type</option>
                {FACILITY_ROOM_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {mode === "create" ? "Create" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
