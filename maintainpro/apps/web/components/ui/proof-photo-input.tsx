"use client";

import { Camera, X } from "lucide-react";
import { useId } from "react";

/**
 * Photo proof for a record (fuel receipt, meter, GRN). Opens the phone camera; a saved photo
 * from the gallery or a PDF also works. The server decides whether it is required.
 */
export function ProofPhotoInput({
  label,
  hint,
  file,
  onChange,
  disabled
}: {
  label: string;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {file ? (
        <span className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-emerald-900">
          <span className="truncate">{file.name}</span>
          <button type="button" aria-label="Remove photo" disabled={disabled} onClick={() => onChange(null)} className="inline-flex h-8 w-8 items-center justify-center rounded">
            <X size={16} aria-hidden />
          </button>
        </span>
      ) : (
        <label
          htmlFor={id}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 text-slate-700 hover:border-brand-400"
        >
          <Camera size={16} aria-hidden /> Take or choose a photo
        </label>
      )}
      <input
        id={id}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </div>
  );
}
