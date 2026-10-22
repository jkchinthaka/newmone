"use client";

import type { FormEvent } from "react";
import { Droplets, Flame, Gauge, QrCode, Search, Zap, type LucideIcon } from "lucide-react";

import { DateTimeField } from "@/components/forms/date-fields";
import { ErrorState, KpiCard, SectionCard, SkeletonCard, Spark, StatusBadge } from "@/components/ui/dashboard";
import { colomboTodayYmd } from "@/lib/colombo-datetime";
import { displayUnit, formatMeterQuantity, formatRecorded, groupReading, meterLine } from "@/lib/meter-readings-display";
import { readingAllowsFraction } from "@/lib/meter-reading-input";

import type { MeterRecord, ReadingRecord } from "./types";

function meterIcon(type?: string | null): LucideIcon {
  const kind = (type ?? "").trim().toUpperCase();
  if (kind === "ELECTRICITY") return Zap;
  if (kind === "WATER") return Droplets;
  if (kind === "GAS") return Flame;
  return Gauge;
}

export function RecordView({
  meter,
  history,
  historyState,
  historyError,
  onRetryHistory,
  value,
  onValueChange,
  fractionDigits,
  draftError,
  valueHintId,
  valueRef,
  usageText,
  usageTone,
  sinceLast,
  averageText,
  spark,
  readingCount,
  readingAt,
  onReadingAt,
  reset,
  onReset,
  resetReason,
  onResetReason,
  note,
  onNote,
  warning,
  message,
  error,
  saving,
  submitDisabled,
  onSubmit,
  onChangeMeter,
  onScanNext
}: {
  meter: MeterRecord;
  history: ReadingRecord[];
  historyState: "loading" | "ready" | "error";
  historyError: string;
  onRetryHistory: () => void;
  value: string;
  onValueChange: (value: string) => void;
  fractionDigits: number;
  draftError: string;
  valueHintId: string;
  valueRef: (node: HTMLInputElement | null) => void;
  usageText: string | null;
  usageTone: "normal" | "high" | null;
  sinceLast: string | null;
  averageText: string | null;
  spark: Array<{ value: number }> | null;
  readingCount: number | null;
  readingAt: string;
  onReadingAt: (value: string) => void;
  reset: boolean;
  onReset: (value: boolean) => void;
  resetReason: string;
  onResetReason: (value: string) => void;
  note: string;
  onNote: (value: string) => void;
  warning: string;
  message: string;
  error: string;
  saving: boolean;
  submitDisabled: boolean;
  onSubmit: (event: FormEvent) => void;
  onChangeMeter: () => void;
  onScanNext: () => void;
}) {
  const Icon = meterIcon(meter.type);
  const last = history[0];
  const line = meterLine(meter.description, meter.location);
  const unit = displayUnit(meter.unit);
  const previous = last ? formatMeterQuantity(last.readingValue, meter.unit) : historyState === "ready" ? "None" : null;
  const hint = draftError || (fractionDigits === 0 ? "Whole numbers only." : `Up to ${fractionDigits} decimal places.`);

  return (
    <div className="min-w-0 space-y-4">
      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {message}
        </p>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 min-[1024px]:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <section className="rounded-card border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-slate-900">{meter.meterNumber}</h2>
                  {line ? <p className="truncate text-sm text-slate-600">{line}</p> : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {meter.type ? <StatusBadge status={meter.type} /> : null}
                {meter.isActive === false ? <StatusBadge status="INACTIVE" /> : null}
              </div>
            </div>

            {historyState === "loading" ? (
              <div className="mt-4">
                <SkeletonCard />
              </div>
            ) : null}
            {historyState === "error" ? (
              <div className="mt-4">
                <ErrorState message={historyError} onRetry={onRetryHistory} />
              </div>
            ) : null}
            {historyState !== "loading" ? (
              <div className="mt-4 grid grid-cols-2 gap-2 min-[900px]:grid-cols-3">
                <KpiCard compact label="Previous reading" value={previous ?? "—"} />
                <KpiCard compact label="Recorded" value={last ? formatRecorded(last.readingDate) ?? "—" : historyState === "ready" ? "None" : "—"} />
                {averageText ? <KpiCard compact label="Avg per day" value={averageText} /> : null}
              </div>
            ) : null}
            {spark ? (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Last 7 readings</span>
                  <span>{unit ? `${unit} used` : "Used"}</span>
                </div>
                <Spark points={spark} />
              </div>
            ) : null}
          </section>

          <SectionCard title="Meter details" className="hidden min-[641px]:block">
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-y-2 text-sm">
              <dt className="text-slate-500">Asset</dt>
              <dd className="min-w-0 truncate font-medium text-slate-900">{meter.description?.trim() || "—"}</dd>
              <dt className="text-slate-500">Location</dt>
              <dd className="min-w-0 truncate font-medium text-slate-900">{meter.location?.trim() || "—"}</dd>
              <dt className="text-slate-500">Unit</dt>
              <dd className="font-medium text-slate-900">{unit || "—"}</dd>
              <dt className="text-slate-500">Readings</dt>
              <dd className="font-medium text-slate-900">{readingCount == null ? "—" : `${readingCount} saved`}</dd>
            </dl>
          </SectionCard>
        </div>

        <form className="min-w-0" onSubmit={onSubmit}>
          <SectionCard title="New reading" description="Type the number shown on the meter. Numbers only.">
            <div className="flex min-w-0 items-center gap-2 rounded-xl border-2 border-brand-500 bg-white px-3">
              <input
                ref={valueRef}
                id="reading-value"
                className="min-h-16 min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight text-slate-900 outline-none tabular-nums sm:text-4xl"
                inputMode={readingAllowsFraction(fractionDigits) ? "decimal" : "numeric"}
                autoComplete="off"
                enterKeyHint="done"
                aria-invalid={draftError ? "true" : "false"}
                aria-describedby={valueHintId}
                value={groupReading(value)}
                onChange={(event) => onValueChange(event.target.value.replace(/,/g, ""))}
                onPaste={(event) => {
                  event.preventDefault();
                  onValueChange(event.clipboardData.getData("text"));
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  const form = event.currentTarget.form;
                  const submitter = form?.querySelector<HTMLButtonElement>("button[type=submit]");
                  if (!form || !submitter || submitter.disabled) return;
                  event.preventDefault();
                  form.requestSubmit(submitter);
                }}
              />
              {unit ? <span className="max-w-[40%] shrink truncate rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{unit}</span> : null}
            </div>
            <p id={valueHintId} className={draftError ? "mt-2 text-sm text-rose-700" : "mt-2 text-sm text-slate-500"} role={draftError ? "alert" : undefined}>
              {hint}
            </p>

            {usageText || sinceLast ? (
              <div className={`mt-3 grid gap-2 ${usageText && sinceLast ? "grid-cols-2" : "grid-cols-1"}`}>
                {usageText ? (
                  <div className={`min-w-0 rounded-xl border px-3 py-2 ${usageTone === "high" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <p className="text-xs text-slate-600">Used since last</p>
                    <p className={`truncate text-lg font-semibold ${usageTone === "high" ? "text-amber-800" : "text-emerald-800"}`}>{usageText}</p>
                  </div>
                ) : null}
                {sinceLast ? <KpiCard compact label="Since last reading" value={sinceLast} /> : null}
              </div>
            ) : null}

            {warning ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
                {warning}
              </p>
            ) : null}

            <div className="mt-4">
              <DateTimeField label="Reading date & time" value={readingAt} maxDate={colomboTodayYmd()} onChange={onReadingAt} />
              <p className="text-xs text-slate-500">Cannot be in the future.</p>
              <input required value={readingAt} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={reset}
                aria-label="Meter was reset or replaced"
                className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 ${reset ? "bg-brand-600" : "bg-slate-300"}`}
                onClick={() => onReset(!reset)}
              >
                <span className={`h-5 w-5 rounded-full bg-white transition ${reset ? "translate-x-5" : ""}`} />
              </button>
              <p className="text-sm font-medium text-slate-800">
                Meter was reset or replaced <span className="font-normal text-slate-500">(asks for a reason)</span>
              </p>
            </div>
            {reset ? (
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-800" htmlFor="reset-reason">
                  Reset reason
                </label>
                <input
                  id="reset-reason"
                  className="mt-1 min-h-12 w-full min-w-0 rounded-xl border border-slate-300 px-3"
                  required
                  value={resetReason}
                  onChange={(event) => onResetReason(event.target.value)}
                />
                <p className="mt-1 text-sm text-slate-600">Required. Explain why this reading is lower than the previous one.</p>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-2">
                <label className="text-sm font-medium text-slate-800" htmlFor="reading-note">
                  Note
                </label>
                <span className="text-xs text-slate-500">Optional</span>
              </div>
              <textarea
                id="reading-note"
                className="mt-1 min-h-20 w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2"
                placeholder="e.g. Read at shift start"
                value={note}
                onChange={(event) => onNote(event.target.value)}
              />
            </div>

            {error ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                {error}
              </p>
            ) : null}

            <button
              className="mt-4 min-h-12 w-full rounded-xl bg-brand-600 px-4 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              disabled={submitDisabled}
              type="submit"
            >
              {saving ? "Saving reading..." : "Save reading"}
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">Saving twice will not create a duplicate.</p>
          </SectionCard>

          <div className="mt-3 grid grid-cols-2 gap-2 min-[641px]:hidden">
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold" type="button" onClick={onScanNext}>
              <QrCode aria-hidden className="h-4 w-4" />
              Scan next
            </button>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold" type="button" onClick={onChangeMeter}>
              <Search aria-hidden className="h-4 w-4" />
              Search
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
