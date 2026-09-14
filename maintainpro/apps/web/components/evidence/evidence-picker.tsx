"use client";

import { useId, useMemo, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";

export type EvidencePickerFile = {
  file: File;
  previewUrl: string | null;
};

type EvidencePickerProps = {
  accept?: string;
  maxBytes?: number;
  disabled?: boolean;
  capture?: boolean;
  helperText?: string;
  onFileChange: (selection: EvidencePickerFile | null) => void;
  onInvalid?: (message: string) => void;
};

/**
 * Mobile-friendly evidence selection with preview and remove-before-upload.
 * Does not upload — parent performs API calls so server validation stays authoritative.
 */
export function EvidencePicker({
  accept = "image/jpeg,image/png,image/webp,image/heic,application/pdf",
  maxBytes = 15 * 1024 * 1024,
  disabled = false,
  capture = true,
  helperText,
  onFileChange,
  onInvalid
}: EvidencePickerProps) {
  const inputId = useId();
  const [selection, setSelection] = useState<EvidencePickerFile | null>(null);

  const sizeLabel = useMemo(() => {
    if (!selection) {
      return null;
    }
    const mb = selection.file.size / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(selection.file.size / 1024))} KB`;
  }, [selection]);

  function clearSelection() {
    if (selection?.previewUrl) {
      URL.revokeObjectURL(selection.previewUrl);
    }
    setSelection(null);
    onFileChange(null);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (file.size > maxBytes) {
      onInvalid?.(`File is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.`);
      return;
    }

    if (accept && accept !== "*/*") {
      const allowed = accept.split(",").map((part) => part.trim());
      const ok = allowed.some((pattern) => {
        if (pattern.endsWith("/*")) {
          return file.type.startsWith(pattern.replace("/*", "/"));
        }
        return file.type === pattern || file.name.toLowerCase().endsWith(pattern.replace(".", ""));
      });
      if (!ok && file.type) {
        onInvalid?.("Unsupported file type for maintenance evidence.");
        return;
      }
    }

    if (selection?.previewUrl) {
      URL.revokeObjectURL(selection.previewUrl);
    }

    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    const next = { file, previewUrl };
    setSelection(next);
    onFileChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label
          htmlFor={inputId}
          className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 ${
            disabled ? "pointer-events-none opacity-50" : "hover:bg-slate-50"
          }`}
        >
          <Upload size={16} aria-hidden />
          Choose file
        </label>
        {capture ? (
          <label
            htmlFor={`${inputId}-camera`}
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white ${
              disabled ? "pointer-events-none opacity-50" : "hover:bg-brand-700"
            }`}
          >
            <ImagePlus size={16} aria-hidden />
            Take photo
          </label>
        ) : null}
        <input
          id={inputId}
          type="file"
          className="sr-only"
          accept={accept}
          disabled={disabled}
          onChange={handleChange}
        />
        {capture ? (
          <input
            id={`${inputId}-camera`}
            type="file"
            className="sr-only"
            accept="image/*"
            capture="environment"
            disabled={disabled}
            onChange={handleChange}
          />
        ) : null}
      </div>

      {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}

      {selection ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{selection.file.name}</p>
              <p className="text-xs text-slate-600">
                {selection.file.type || "unknown type"}
                {sizeLabel ? ` · ${sizeLabel}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700"
              aria-label="Remove selected evidence"
              onClick={clearSelection}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
          {selection.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img
              src={selection.previewUrl}
              alt="Selected evidence preview"
              className="mt-3 max-h-56 w-full rounded-lg object-contain bg-white"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
