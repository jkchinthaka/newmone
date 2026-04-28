"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";

type FieldType = "text" | "number" | "select" | "textarea";

interface InlineEditFieldProps<T extends string | number | null> {
  /** Current value to display when not editing. */
  value: T;
  /** Async save handler. Should resolve when the mutation succeeds or throw on failure. */
  onSave: (next: T) => Promise<void>;
  /** Optional label for screen readers / placeholder. */
  label?: string;
  /** Field type. Defaults to "text". */
  type?: FieldType;
  /** Options for `type="select"`. */
  options?: Array<{ value: string; label: string }>;
  /** Disable editing entirely (e.g. for non-privileged users). */
  disabled?: boolean;
  /** Render formatted display value (defaults to String(value)). */
  format?: (value: T) => string;
  /** Tailwind class overrides for the trigger element. */
  className?: string;
}

/**
 * Click-to-edit field. Saves on blur or Enter. Cancels on Escape.
 * The diff & audit trail are produced automatically by the API's Prisma middleware,
 * so callers only need to call the existing PATCH endpoint via `onSave`.
 */
export function InlineEditField<T extends string | number | null>(
  props: InlineEditFieldProps<T>
) {
  const { value, onSave, label, type = "text", options, disabled, format, className } = props;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value === null || value === undefined ? "" : String(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value === null || value === undefined ? "" : String(value));
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ("select" in inputRef.current && typeof inputRef.current.select === "function") {
        inputRef.current.select();
      }
    }
  }, [editing]);

  const display = format
    ? format(value)
    : value === null || value === undefined || value === ""
      ? "—"
      : String(value);

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setEditing(true)}
        aria-label={label ? `Edit ${label}` : "Edit"}
        className={
          className ??
          "group inline-flex items-center gap-1 rounded px-1 text-left text-sm text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        <span>{display}</span>
        {!disabled && (
          <Pencil className="h-3 w-3 opacity-0 transition group-hover:opacity-60" aria-hidden />
        )}
      </button>
    );
  }

  const commit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    let next: T;
    if (type === "number") {
      const n = draft === "" ? null : Number(draft);
      if (n !== null && Number.isNaN(n)) {
        setSaving(false);
        setError("Invalid number");
        return;
      }
      next = n as T;
    } else {
      next = (draft === "" ? null : draft) as T;
    }

    if (String(next ?? "") === String(value ?? "")) {
      setEditing(false);
      setSaving(false);
      return;
    }

    try {
      await onSave(next);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value === null || value === undefined ? "" : String(value));
    setEditing(false);
    setError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      {type === "select" ? (
        <select
          ref={(el) => {
            inputRef.current = el;
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          disabled={saving}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          aria-label={label}
        >
          {(options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          ref={(el) => {
            inputRef.current = el;
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          disabled={saving}
          rows={3}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          aria-label={label}
        />
      ) : (
        <input
          ref={(el) => {
            inputRef.current = el;
          }}
          type={type === "number" ? "number" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          disabled={saving}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          aria-label={label}
        />
      )}
      {saving && <Loader2 className="h-3 w-3 animate-spin text-slate-500" aria-hidden />}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}

export default InlineEditField;
