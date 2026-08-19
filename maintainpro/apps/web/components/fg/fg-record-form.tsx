"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FgVehicleSelector } from "@/components/fg/fg-vehicle-selector";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { saveFgRecord, submitFgRecord } from "@/lib/fg-api";
import { clearActionKey, fieldErrorsFor, stableActionKey } from "@/lib/fg-mappers";
import type { FgApiError, FgField, FgRecordDetail } from "@/lib/fg-types";

type Props = {
  detail: FgRecordDetail;
  onRefresh: () => void;
};

function focusFirstFgInvalid() {
  const invalid = document.querySelector<HTMLElement>("[data-fg-invalid='true']");
  if (!invalid) {
    return;
  }
  if (
    invalid instanceof HTMLInputElement ||
    invalid instanceof HTMLSelectElement ||
    invalid instanceof HTMLTextAreaElement
  ) {
    invalid.focus();
    return;
  }
  invalid.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
}

function collectFields(sections: FgRecordDetail["editor"]): FgField[] {
  const fields: FgField[] = [];
  for (const section of sections?.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (field.children?.length) {
        fields.push(...field.children);
      } else if (field.fieldName) {
        fields.push(field);
      }
    }
  }
  return fields;
}

export function FgRecordForm({ detail, onRefresh }: Props) {
  const router = useRouter();
  const editor = detail.editor;
  const initial = useMemo(() => {
    const next: Record<string, string> = {};
    for (const field of collectFields(editor)) {
      next[field.fieldName] = field.value ?? "";
      if (field.equipmentFieldName && field.equipmentValue) {
        next[field.equipmentFieldName] = field.equipmentValue;
      }
    }
    return next;
  }, [editor]);
  const [fields, setFields] = useState<Record<string, string>>(initial);
  const [pending, setPending] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState<string>("");
  const [apiError, setApiError] = useState<FgApiError | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const pendingHref = useRef<string | null>(null);

  useEffect(() => {
    setFields(initial);
    setApiError(null);
    setError("");
  }, [initial]);

  const dirty = JSON.stringify(fields) !== JSON.stringify(initial);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      pendingHref.current = href;
      setLeaveOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  if (!editor || detail.readOnly || !detail.actions.canEdit) {
    return null;
  }

  const completeness = editor.completeness;
  const remaining = Math.max(0, completeness.requiredItems - completeness.answeredRequiredItems);

  async function persist(mode: "save" | "submit") {
    if (pending) return;
    setPending(mode);
    setError("");
    setApiError(null);
    try {
      const saved = await saveFgRecord(detail.record.id, {
        expectedDraftVersion: editor!.expectedDraftVersion,
        fields
      });
      if (saved.error) {
        setApiError(saved.error);
        setError(saved.error.message);
        window.requestAnimationFrame(() => {
          focusFirstFgInvalid();
        });
        return;
      }
      if (mode === "submit") {
        const key = stableActionKey("submit", detail.record.id);
        const submitted = await submitFgRecord(detail.record.id, key);
        if (submitted.error) {
          setApiError(submitted.error);
          setError(submitted.error.message);
          window.requestAnimationFrame(() => {
            focusFirstFgInvalid();
          });
          return;
        }
        clearActionKey("submit", detail.record.id);
        toast.success("Record submitted");
      } else {
        toast.success("Draft saved");
      }
      onRefresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void persist("submit");
        }}
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Section progress</p>
          <p className="mt-1 text-sm text-slate-600">
            Completed fields {completeness.answeredItems} of {completeness.totalItems}. Remaining required fields:{" "}
            {remaining}.
          </p>
        </div>
        {editor.sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
            <div className="mt-4 grid gap-4">
              {(section.fields ?? []).map((field) => {
                if (field.children?.length) {
                  return (
                    <div key={field.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-800">{field.label}</p>
                      <div className="mt-3 grid gap-3">
                        {field.children.map((child) => (
                          <FieldControl
                            key={`${child.fieldName}-${child.sampleIndex}`}
                            field={child}
                            formCode={detail.record.formCode}
                            value={fields[child.fieldName] ?? ""}
                            error={fieldErrorsFor(apiError, child.fieldName)[0]}
                            disabled={pending !== null}
                            onChange={(next) => setFields((current) => ({ ...current, [child.fieldName]: next }))}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <FieldControl
                    key={field.fieldName}
                    field={field}
                    formCode={detail.record.formCode}
                    value={fields[field.fieldName] ?? ""}
                    error={fieldErrorsFor(apiError, field.fieldName)[0]}
                    disabled={pending !== null}
                    onChange={(next) => setFields((current) => ({ ...current, [field.fieldName]: next }))}
                  />
                );
              })}
            </div>
          </section>
        ))}
        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {error}
          </p>
        ) : null}
        <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700"
            disabled={pending !== null}
            onClick={() => void persist("save")}
          >
            {pending === "save" ? "Saving…" : "Save draft"}
          </button>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={pending !== null || !detail.actions.canSubmit}
          >
            {pending === "submit" ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={leaveOpen}
        title="Discard unsaved draft?"
        description="You have unsaved FG record changes. Leave this page and lose the draft, or stay and save first."
        confirmLabel="Leave page"
        cancelLabel="Stay"
        variant="destructive"
        onCancel={() => {
          pendingHref.current = null;
          setLeaveOpen(false);
        }}
        onConfirm={() => {
          const href = pendingHref.current;
          pendingHref.current = null;
          setLeaveOpen(false);
          if (href) {
            router.push(href as never);
          }
        }}
      />
    </>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  disabled,
  error,
  formCode
}: {
  field: FgField;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
  formCode?: string;
}) {
  const describedBy = error ? `${field.fieldName}-error` : field.helpText ? `${field.fieldName}-help` : undefined;
  const isChoice = field.responseType === "YES_NO" || field.responseType === "YES_NO_NA";
  if (field.isVehicleField) {
    return (
      <FgVehicleSelector
        value={value}
        disabled={disabled}
        error={error}
        formCode={formCode}
        onChange={(registration) => onChange(registration)}
      />
    );
  }
  return (
    <div>
      {isChoice ? (
        <fieldset
          className="min-w-0"
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          aria-required={field.required}
          data-fg-invalid={error ? "true" : undefined}
        >
          <legend className="mb-1 block text-sm font-medium text-slate-800">
            {field.label}
            {field.required ? <span className="ml-1 text-rose-600">*</span> : null}
          </legend>
          <div className="flex flex-wrap gap-2">
            {field.options.map((option) => (
              <label key={option.value} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm">
                <input
                  type="radio"
                  name={field.fieldName}
                  value={option.value}
                  checked={value === option.value}
                  disabled={disabled}
                  required={field.required}
                  onChange={() => onChange(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <>
          <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor={field.fieldName}>
            {field.label}
            {field.required ? <span className="ml-1 text-rose-600">*</span> : null}
          </label>
          {field.responseType === "SELECT" ? (
            <select
              id={field.fieldName}
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              value={value}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              data-fg-invalid={error ? "true" : undefined}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">Select</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={field.fieldName}
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              type={field.responseType === "NUMBER" ? "number" : "text"}
              value={value}
              disabled={disabled}
              required={field.required}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              data-fg-invalid={error ? "true" : undefined}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </>
      )}
      {field.helpText ? (
        <p id={`${field.fieldName}-help`} className="mt-1 text-xs text-slate-500">
          {field.helpText}
        </p>
      ) : null}
      {error ? (
        <p id={`${field.fieldName}-error`} className="mt-1 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
