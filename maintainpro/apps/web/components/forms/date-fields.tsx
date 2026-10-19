"use client";

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Calendar, Clock, X } from "lucide-react";

import {
  calendarKeyTarget,
  calendarMonthGrid,
  colomboDateTimeToIso,
  colomboNowTime,
  colomboTodayYmd,
  dateOutsideRange,
  formatCalendarDate,
  formatClock,
  isoToColomboParts,
  monthLabel,
  parseTypedDate,
  parseTypedTime,
  quarterHourOptions
} from "@/lib/colombo-datetime";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type SharedDateProps = {
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
};

type DateFieldProps = SharedDateProps & {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  error?: string;
  minDateMessage?: string;
  maxDateMessage?: string;
  bare?: boolean;
};

export function DateField({ id, label, value, onChange, disabled = false, describedBy, error, minDate, maxDate, minDateMessage, maxDateMessage, bare = false }: DateFieldProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ? formatCalendarDate(value) : "");
  const [parseError, setParseError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value ? formatCalendarDate(value) : "");
  }, [value]);

  function commit(raw: string) {
    if (!raw.trim()) {
      onChange("");
      setParseError("");
      return;
    }
    const parsed = parseTypedDate(raw);
    if (!parsed) {
      setParseError("Use dd MMM yyyy, 16/10/2026, 16-10-2026, or 2026-10-16.");
      return;
    }
    setDraft(formatCalendarDate(parsed));
    if (dateOutsideRange(parsed, minDate, maxDate)) {
      setParseError(
        minDate && parsed < minDate
          ? minDateMessage || "That date is before the earliest allowed date."
          : maxDateMessage || "That date is after the latest allowed date."
      );
      return;
    }
    onChange(parsed);
    setDraft(formatCalendarDate(parsed));
    setParseError("");
  }

  function close() {
    setOpen(false);
    inputRef.current?.focus();
  }

  const message = parseError || error || "";

  return (
    <div ref={rootRef} className="relative min-w-0 space-y-1 text-sm text-slate-700">
      <label className={bare ? "sr-only" : "font-medium"} htmlFor={fieldId}>
        {label}
      </label>
      <div className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2">
        <Calendar size={18} className="shrink-0 text-slate-500" aria-hidden />
        <input
          ref={inputRef}
          id={fieldId}
          value={draft}
          disabled={disabled}
          placeholder="dd MMM yyyy"
          aria-describedby={message ? `${fieldId}-error` : describedBy}
          aria-invalid={message ? true : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setParseError("");
          }}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
            }
            if (event.key === "Escape" && open) {
              event.preventDefault();
              close();
            }
          }}
          onClick={() => setOpen(true)}
          className="min-w-0 flex-1 bg-transparent py-2 outline-none disabled:text-slate-400"
        />
        {value ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            disabled={disabled}
            onClick={() => {
              onChange("");
              setDraft("");
              setParseError("");
              inputRef.current?.focus();
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-500"
          >
            <X size={16} aria-hidden />
          </button>
        ) : null}
      </div>
      {message ? (
        <p id={`${fieldId}-error`} className="text-xs text-rose-700" role="alert">
          {message}
        </p>
      ) : null}
      {open && !disabled ? (
        <CalendarPopover
          value={value}
          minDate={minDate}
          maxDate={maxDate}
          anchorRef={rootRef}
          onSelect={(next) => {
            onChange(next);
            setDraft(formatCalendarDate(next));
            setParseError("");
            close();
          }}
          onClear={() => {
            onChange("");
            setDraft("");
            setParseError("");
            close();
          }}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function CalendarPopover({
  value,
  minDate,
  maxDate,
  anchorRef,
  onSelect,
  onClear,
  onClose,
  showNow = false,
  onNow
}: {
  value: string;
  minDate?: string;
  maxDate?: string;
  anchorRef: RefObject<HTMLDivElement | null>;
  onSelect: (value: string) => void;
  onClear: () => void;
  onClose: () => void;
  showNow?: boolean;
  onNow?: () => void;
}) {
  const today = colomboTodayYmd();
  const initial = value || today;
  const [cursor, setCursor] = useState({ year: Number(initial.slice(0, 4)), month: Number(initial.slice(5, 7)) - 1 });
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [focusValue, setFocusValue] = useState(initial);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, width: 320, maxHeight: 480 });
  const cells = useMemo(() => calendarMonthGrid(cursor.year, cursor.month), [cursor.year, cursor.month]);
  const titleId = useId();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    function place() {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = Math.min(320, window.innerWidth - 16);
      const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
      const below = window.innerHeight - anchor.bottom - 8;
      const above = anchor.top - 8;
      const placeAbove = below < 420 && above > below;
      const maxHeight = Math.max(220, Math.min(480, placeAbove ? above : below));
      const top = placeAbove ? Math.max(8, anchor.top - maxHeight - 4) : anchor.bottom + 4;
      setBox({ top, left, width, maxHeight });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchorRef, view]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dialogRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [anchorRef, onClose]);

  useEffect(() => {
    if (view !== "days") return;
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-calendar-focus='true']")?.focus();
  }, [focusValue, view]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (view !== "days") return;
    const next = calendarKeyTarget(focusValue, event.key);
    if (!next) return;
    event.preventDefault();
    if (next === "close") onClose();
    else if (next === "select") {
      if (!dateOutsideRange(focusValue, minDate, maxDate)) onSelect(focusValue);
    } else {
      setFocusValue(next);
      setCursor({ year: Number(next.slice(0, 4)), month: Number(next.slice(5, 7)) - 1 });
    }
  }

  const panel = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className={`z-[90] overflow-auto border border-slate-200 bg-white p-3 shadow-lg ${narrow ? "fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl" : "fixed rounded-xl"}`}
      style={narrow ? undefined : { top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border" aria-label={view === "years" ? "Previous years" : view === "months" ? "Previous year" : "Previous month"} onClick={() => setCursor((current) => {
          if (view === "years") return { ...current, year: current.year - 12 };
          if (view === "months") return { ...current, year: current.year - 1 };
          return { year: current.month === 0 ? current.year - 1 : current.year, month: current.month === 0 ? 11 : current.month - 1 };
        })}>
          ‹
        </button>
        <button id={titleId} type="button" className="min-h-11 rounded px-3 text-sm font-semibold" onClick={() => setView((current) => (current === "days" ? "months" : "years"))}>
          {view === "years" ? `${cursor.year - 6} – ${cursor.year + 5}` : monthLabel(cursor.year, cursor.month)}
        </button>
        <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border" aria-label={view === "years" ? "Next years" : view === "months" ? "Next year" : "Next month"} onClick={() => setCursor((current) => {
          if (view === "years") return { ...current, year: current.year + 12 };
          if (view === "months") return { ...current, year: current.year + 1 };
          return { year: current.month === 11 ? current.year + 1 : current.year, month: current.month === 11 ? 0 : current.month + 1 };
        })}>
          ›
        </button>
      </div>
      {view === "days" ? (
        <div role="grid" aria-label={monthLabel(cursor.year, cursor.month)}>
          <div role="row" className="grid grid-cols-7 text-center text-xs text-slate-500">
            {WEEKDAYS.map((day) => (
              <span key={day} role="columnheader">{day}</span>
            ))}
          </div>
          <div role="row" className="grid grid-cols-7">
            {cells.map((cell, index) => {
              if (cell.day == null) return <span key={`empty-${index}`} />;
              const outside = dateOutsideRange(cell.value, minDate, maxDate);
              const selected = cell.value === value;
              const isToday = cell.value === today;
              return (
                <button
                  key={cell.value}
                  type="button"
                  role="gridcell"
                  data-calendar-focus={cell.value === focusValue ? "true" : undefined}
                  aria-selected={selected}
                  aria-current={isToday ? "date" : undefined}
                  aria-disabled={outside || undefined}
                  disabled={outside}
                  onClick={() => {
                    if (!outside) onSelect(cell.value);
                  }}
                  className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-sm disabled:cursor-not-allowed ${
                    outside
                      ? "bg-slate-100 text-slate-400"
                      : selected
                        ? "bg-brand-600 text-white"
                        : isToday
                          ? "font-semibold text-slate-900 ring-2 ring-brand-600"
                          : "text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {view === "months" ? (
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((name, index) => (
            <button key={name} type="button" className="min-h-11 rounded border text-sm" onClick={() => { setCursor((current) => ({ ...current, month: index })); setView("days"); }}>
              {name}
            </button>
          ))}
        </div>
      ) : null}
      {view === "years" ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, index) => cursor.year - 6 + index).map((year) => (
            <button key={year} type="button" className="min-h-11 rounded border text-sm" onClick={() => { setCursor((current) => ({ ...current, year })); setView("months"); }}>
              {year}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded border px-3 text-sm" onClick={() => onSelect(today)}>Today</button>
        <button type="button" className="min-h-11 rounded border px-3 text-sm" onClick={onClear}>Clear</button>
        {showNow && onNow ? (
          <button type="button" className="min-h-11 rounded border px-3 text-sm" onClick={onNow}>Now</button>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
}

type TimeFieldProps = SharedDateProps & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  bare?: boolean;
};

export function TimeField({ label, value, onChange, disabled = false, bare = false }: TimeFieldProps) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ? formatClock(...(value.split(":").map(Number) as [number, number])) : "");
  const [parseError, setParseError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = useMemo(() => quarterHourOptions(), []);

  useEffect(() => {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      setDraft("");
      return;
    }
    const [hours, minutes] = value.split(":").map(Number);
    setDraft(formatClock(hours, minutes));
  }, [value]);

  function commit(raw: string) {
    if (!raw.trim()) {
      onChange("");
      setParseError("");
      return;
    }
    const parsed = parseTypedTime(raw);
    if (!parsed) {
      setParseError("Use a time such as 2:30 PM or 14:30.");
      return;
    }
    const [hours, minutes] = parsed.split(":").map(Number);
    onChange(parsed);
    setDraft(formatClock(hours, minutes));
    setParseError("");
  }

  function close() {
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="relative min-w-0 space-y-1 text-sm text-slate-700">
      <label className={bare ? "sr-only" : "font-medium"} htmlFor={fieldId}>{label}</label>
      <div className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2">
        <Clock size={18} className="shrink-0 text-slate-500" aria-hidden />
        <input
          ref={inputRef}
          id={fieldId}
          value={draft}
          disabled={disabled}
          placeholder="hh:mm AM/PM"
          aria-invalid={parseError ? true : undefined}
          aria-describedby={parseError ? `${fieldId}-error` : undefined}
          onChange={(event) => { setDraft(event.target.value); setParseError(""); }}
          onFocus={() => setOpen(true)}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); commit(draft); close(); }
            if (event.key === "Escape") { event.preventDefault(); close(); }
          }}
          className="min-w-0 flex-1 bg-transparent py-2 outline-none"
        />
        {value ? (
          <button type="button" aria-label={`Clear ${label}`} className="inline-flex min-h-11 min-w-11 items-center justify-center" onClick={() => { onChange(""); setDraft(""); inputRef.current?.focus(); }}>
            <X size={16} aria-hidden />
          </button>
        ) : null}
      </div>
      {parseError ? <p id={`${fieldId}-error`} className="text-xs text-rose-700" role="alert">{parseError}</p> : null}
      {open && !disabled ? (
        <div role="listbox" aria-label={label} className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {options.map((option) => {
            const [hours, minutes] = option.split(":").map(Number);
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === value}
                className={`block min-h-11 w-full px-3 text-left text-sm ${option === value ? "bg-brand-600 text-white" : "hover:bg-slate-100"}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onChange(option); setDraft(formatClock(hours, minutes)); setParseError(""); close(); }}
              >
                {formatClock(hours, minutes)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type DateTimeFieldProps = SharedDateProps & {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  bare?: boolean;
};

export function DateTimeField({ label, value, onChange, disabled = false, minDate, maxDate, bare = false }: DateTimeFieldProps) {
  const parts = value ? isoToColomboParts(value) : null;
  const date = parts?.date ?? "";
  const time = parts?.time ?? "";

  function emit(nextDate: string, nextTime: string) {
    if (!nextDate || !nextTime) {
      onChange("");
      return;
    }
    onChange(colomboDateTimeToIso(nextDate, nextTime));
  }

  return (
    <fieldset className="min-w-0 space-y-2" disabled={disabled}>
      <legend className={bare ? "sr-only" : "text-sm font-medium text-slate-700"}>{label}</legend>
      <DateField label="Date" value={date} minDate={minDate} maxDate={maxDate} disabled={disabled} onChange={(next) => emit(next, time || "00:00")} />
      <TimeField label="Time" value={time} disabled={disabled} onChange={(next) => emit(date || colomboTodayYmd(), next)} />
      <button
        type="button"
        className="min-h-11 rounded border px-3 text-sm"
        onClick={() => onChange(new Date().toISOString())}
      >
        Now
      </button>
    </fieldset>
  );
}

type DateRangeFieldProps = SharedDateProps & {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

export function DateRangeField({ from, to, onFromChange, onToChange, disabled = false, minDate, maxDate }: DateRangeFieldProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <DateField label="From" value={from} onChange={onFromChange} disabled={disabled} minDate={minDate} maxDate={to || maxDate} />
      <DateField label="To" value={to} onChange={onToChange} disabled={disabled} minDate={from || minDate} maxDate={maxDate} />
    </div>
  );
}

export function colomboNowIso() {
  return colomboDateTimeToIso(colomboTodayYmd(), colomboNowTime());
}
