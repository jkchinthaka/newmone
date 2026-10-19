"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { DateTimeField } from "@/components/forms/date-fields";
import { QrScanner } from "@/components/qr/qr-scanner";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  acceptReadingDraft,
  comparableConsumptions,
  consumptionWarning,
  meterFractionDigits,
  readingAllowsFraction,
  readingFieldError
} from "@/lib/meter-reading-input";
import { useCurrentUser } from "@/lib/use-current-user";

const READING_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC"]);
const RECENT_KEY = "maintainpro:recent-meters";

type Meter = {
  id: string;
  meterNumber: string;
  location?: string | null;
  description?: string | null;
  type?: string;
  unit?: string | null;
  isActive?: boolean;
};
type Reading = {
  id: string;
  readingValue: number | string;
  readingDate: string;
  notes?: string | null;
  consumption?: number | string | null;
};

function colomboNow() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
  return parts.replace(" ", "T");
}

function recorder(notes?: string | null) {
  return notes?.match(/\[by:([^\]]+)\]/)?.[1] ?? "Not recorded";
}

function readRecent(): Meter[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as Meter[];
    return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row.id === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function rememberMeter(meter: Meter) {
  const next = [meter, ...readRecent().filter((row) => row.id !== meter.id)].slice(0, 5);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export default function MeterReadingsPage() {
  const user = useCurrentUser();
  const allowed = READING_ROLES.has(user.role ?? "");
  const valueHintId = useId();
  const [query, setQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [recent, setRecent] = useState<Meter[]>([]);
  const [selected, setSelected] = useState<Meter | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [value, setValue] = useState("");
  const [rejectedDraft, setRejectedDraft] = useState("");
  const [readingAt, setReadingAt] = useState(colomboNow);
  const [note, setNote] = useState("");
  const [reset, setReset] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [warning, setWarning] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const attemptKey = useRef<string | null>(null);
  const valueRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  const last = history[0];
  const fractionDigits = meterFractionDigits(selected?.unit, selected?.type);
  const fieldError = value ? readingFieldError(value, fractionDigits) : "Enter the meter reading.";
  const draftError = rejectedDraft || (value ? fieldError : "");
  const preview = useMemo(() => {
    if (!selected || fieldError || !last) return null;
    const next = Number(value);
    const previous = Number(last.readingValue);
    if (!Number.isFinite(next) || !Number.isFinite(previous) || next < previous) return null;
    return consumptionWarning(next - previous, comparableConsumptions(history));
  }, [fieldError, history, last, selected, value]);
  const mine = useMemo(
    () => history.filter((row) => String(row.notes ?? "").includes(`[by:${user.id ?? ""}]`)),
    [history, user.id]
  );

  async function search(event?: FormEvent, scanned?: string) {
    event?.preventDefault();
    setError("");
    const response = await apiClient.get("/utilities/meters");
    const rows = (response.data?.data ?? []) as Meter[];
    const needle = (scanned ?? query).trim().toLowerCase();
    const found = needle
      ? rows.filter((row) =>
          `${row.id} ${row.meterNumber} ${row.location ?? ""} ${row.description ?? ""}`.toLowerCase().includes(needle)
        )
      : rows;
    setMeters(found);
    if (scanned && found.length === 1) await choose(found[0]);
    if (scanned && found.length === 0) setError("No meter in this tenant matched the scanned code.");
  }

  async function loadHistory(meter: Meter) {
    const response = await apiClient.get(`/utilities/meters/${meter.id}/readings`);
    setHistory((response.data?.data ?? []) as Reading[]);
  }

  async function choose(meter: Meter) {
    setSelected(meter);
    setMessage("");
    setWarning("");
    setValue("");
    setRejectedDraft("");
    setReset(false);
    setResetReason("");
    attemptKey.current = null;
    setRecent(rememberMeter(meter));
    await loadHistory(meter);
    valueRef.current?.focus();
  }

  function onReadingChange(incoming: string) {
    const next = acceptReadingDraft(value, incoming, fractionDigits);
    setValue(next.value);
    setRejectedDraft(next.rejected ? "Only numbers are allowed in the reading." : "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || saving || fieldError || !value.trim()) return;
    if (reset && resetReason.trim().length < 3) {
      setError("Enter a reason for the meter reset or replacement.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    const signature = `${selected.id}|${readingAt}|${value}|${reset}|${resetReason.trim()}`;
    if (!attemptKey.current?.startsWith(`${signature}|`)) {
      attemptKey.current = `${signature}|${crypto.randomUUID()}`;
    }
    const idempotencyKey = attemptKey.current.slice(signature.length + 1);
    try {
      const response = await apiClient.post(`/utilities/meters/${selected.id}/readings`, {
        readingDate: new Date(readingAt).toISOString(),
        readingValue: value.trim(),
        notes: note,
        resetReason: reset ? resetReason.trim() : undefined,
        idempotencyKey
      });
      const saved = response.data?.data as { warning?: string | null; consumption?: number | null };
      setWarning(saved?.warning ?? "");
      setMessage(saved?.consumption == null ? "Reading saved." : `Reading saved. Consumption ${saved.consumption}.`);
      setValue("");
      setNote("");
      setReset(false);
      setResetReason("");
      attemptKey.current = null;
      await loadHistory(selected);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The reading could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-lg p-4">
        <h1 className="text-2xl font-semibold text-slate-900">Access required</h1>
        <p className="mt-2 text-sm text-slate-600">Your role cannot record meter readings.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-3 sm:p-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Meter Readings</h1>
        <p className="mt-1 text-sm text-slate-600">Record the number on the meter. Search, scan, or pick a recent meter.</p>
      </header>

      <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={(event) => void search(event)}>
        <label className="sr-only" htmlFor="meter-search">
          Search by meter number, name, or location
        </label>
        <input
          id="meter-search"
          className="min-h-12 min-w-0 rounded-xl border border-slate-300 px-3 text-base"
          placeholder="Meter number, name, or location"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="min-h-12 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white" type="submit">
          Search
        </button>
        <button className="min-h-12 rounded-xl border border-slate-300 px-4 text-sm font-semibold" type="button" onClick={() => setScanOpen(true)}>
          Scan QR
        </button>
      </form>
      <QrScanner
        open={scanOpen}
        title="Scan meter QR"
        manualLabel="Or enter the meter number"
        onClose={() => setScanOpen(false)}
        onScan={(code) => {
          setQuery(code);
          setScanOpen(false);
          void search(undefined, code);
        }}
      />

      {recent.length > 0 ? (
        <section aria-label="Recently used meters">
          <h2 className="text-sm font-semibold text-slate-700">Recently used</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recent.map((meter) => (
              <li key={meter.id}>
                <button className="min-h-11 rounded-full border border-slate-300 px-3 text-sm" type="button" onClick={() => void choose(meter)}>
                  {meter.meterNumber}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="space-y-2">
        {meters.map((meter) => (
          <li key={meter.id}>
            <button className="min-h-12 w-full rounded-xl border border-slate-200 px-3 py-2 text-left" type="button" onClick={() => void choose(meter)}>
              <span className="font-medium">{meter.meterNumber}</span>
              <span className="mt-0.5 block text-sm text-slate-600">{meter.location || "No location"}</span>
            </button>
          </li>
        ))}
      </ul>

      {selected ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Selected meter">
          <h2 className="text-lg font-semibold">{selected.meterNumber}</h2>
          <p className="text-sm text-slate-600">
            {selected.location || "No location"} · {selected.unit || "No unit"} · {selected.isActive === false ? "Inactive" : "Active"}
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Previous reading</dt>
              <dd className="font-medium">{last ? String(last.readingValue) : "None"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Date and time</dt>
              <dd className="font-medium">{last ? new Date(last.readingDate).toLocaleString() : "None"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Recorded by</dt>
              <dd className="font-medium">{recorder(last?.notes)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Unit and status</dt>
              <dd className="font-medium">
                {selected.unit || "No unit"} · {selected.isActive === false ? "Inactive" : "Active"}
              </dd>
            </div>
          </dl>
        </section>
      ) : (
        <p className="text-sm text-slate-600">Select a meter to record a reading.</p>
      )}

      {selected ? (
        <form className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" onSubmit={(event) => void submit(event)}>
          <h2 className="text-lg font-semibold">New Reading</h2>
          <label className="block text-sm font-medium" htmlFor="reading-value">
            Reading
          </label>
          <input
            ref={valueRef}
            id="reading-value"
            className="min-h-14 w-full rounded-xl border border-slate-300 px-3 text-2xl"
            inputMode={readingAllowsFraction(fractionDigits) ? "decimal" : "numeric"}
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={draftError ? "true" : "false"}
            aria-describedby={valueHintId}
            value={value}
            onChange={(event) => onReadingChange(event.target.value)}
            onPaste={(event) => {
              event.preventDefault();
              onReadingChange(event.clipboardData.getData("text"));
            }}
          />
          <p id={valueHintId} className={draftError ? "text-sm text-rose-700" : "text-sm text-slate-500"} role={draftError ? "alert" : undefined}>
            {draftError ||
              (fractionDigits === 0 ? "Whole numbers only." : `Up to ${fractionDigits} decimal places.`)}
          </p>
          <DateTimeField label="Date and time" value={readingAt} onChange={setReadingAt} />
          <input required value={readingAt} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
          <label className="block text-sm font-medium" htmlFor="reading-note">
            Note
          </label>
          <textarea id="reading-note" className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2" value={note} onChange={(event) => setNote(event.target.value)} />
          <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
            <input className="h-5 w-5" type="checkbox" checked={reset} onChange={(event) => setReset(event.target.checked)} />
            Meter reset or replacement
          </label>
          {reset ? (
            <div>
              <label className="block text-sm font-medium" htmlFor="reset-reason">
                Reset reason
              </label>
              <input
                id="reset-reason"
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3"
                required
                value={resetReason}
                onChange={(event) => setResetReason(event.target.value)}
              />
              <p className="mt-1 text-sm text-slate-600">Required. Explain why this reading is lower than the previous one.</p>
            </div>
          ) : null}
          {preview ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
              {preview}
            </p>
          ) : null}
          {warning ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
              {warning}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="min-h-12 w-full rounded-xl bg-slate-900 px-4 text-base font-semibold text-white disabled:opacity-60"
            disabled={saving || Boolean(fieldError)}
            type="submit"
          >
            {saving ? "Saving reading..." : "Save Reading"}
          </button>
        </form>
      ) : null}

      <section>
        <h2 className="font-semibold text-slate-900">My recent readings</h2>
        {mine.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">No readings recorded by you for this meter yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {mine.map((row) => (
              <li key={row.id}>
                {String(row.readingValue)} · {new Date(row.readingDate).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
