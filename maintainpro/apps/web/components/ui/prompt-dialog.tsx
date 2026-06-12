"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { validatePromptInput } from "@/lib/prompt-validation";

export { validatePromptInput } from "@/lib/prompt-validation";

export type PromptDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  required?: boolean;
  requiredMessage?: string;
  validate?: (value: string) => string | null;
  isSubmitting?: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

export function PromptDialog({
  open,
  title,
  description,
  label,
  placeholder,
  defaultValue = "",
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  required = true,
  requiredMessage,
  validate,
  isSubmitting = false,
  onSubmit,
  onCancel
}: PromptDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValue(defaultValue);
    setError(null);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, defaultValue, isSubmitting, onCancel]);

  if (!open) {
    return null;
  }

  function handleSubmit() {
    const validationError = validatePromptInput(value, { required, requiredMessage, validate });
    if (validationError) {
      setError(validationError);
      return;
    }

    onSubmit(value.trim());
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0"
        onClick={isSubmitting ? undefined : onCancel}
        disabled={isSubmitting}
      />
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        role="dialog"
      >
        <h2 className="text-lg font-semibold text-slate-900" id={titleId}>
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-slate-600" id={descriptionId}>
            {description}
          </p>
        ) : null}
        <div className="mt-4 space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor={`${titleId}-input`}>
            {label}
          </label>
          <input
            ref={inputRef}
            id={`${titleId}-input`}
            type="text"
            value={value}
            placeholder={placeholder}
            disabled={isSubmitting}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) {
                setError(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSubmit();
              }
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
          />
          {error ? (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type PromptDialogOptions = Omit<PromptDialogProps, "open" | "onSubmit" | "onCancel">;
