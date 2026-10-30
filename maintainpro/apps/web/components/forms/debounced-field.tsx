"use client";

import { useEffect, useRef, useState } from "react";

export const DEBOUNCED_FIELD_DELAY_MS = 400;

/**
 * Text input that only commits after typing pauses, so a filter does not fire
 * one request per keystroke. The visible value updates immediately.
 */
export function DebouncedField({
  label,
  value,
  placeholder,
  onCommit,
  inputMode,
  className = "h-10 rounded-md border border-slate-300 px-2 text-sm",
  delayMs = DEBOUNCED_FIELD_DELAY_MS,
  type = "text"
}: {
  label: string;
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
  inputMode?: "decimal" | "text" | "search";
  className?: string;
  delayMs?: number;
  type?: "text" | "search";
}) {
  const [local, setLocal] = useState(value);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (local.trim() === valueRef.current) return;
      onCommitRef.current(local.trim());
    }, delayMs);
    return () => window.clearTimeout(handle);
  }, [local, delayMs]);

  return (
    <input
      aria-label={label}
      placeholder={placeholder}
      inputMode={inputMode}
      type={type}
      className={className}
      value={local}
      onChange={(event) => setLocal(event.target.value)}
    />
  );
}
