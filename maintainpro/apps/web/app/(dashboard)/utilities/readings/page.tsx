"use client";

import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { RecordView } from "@/components/utilities/meter-readings/record-view";
import { SearchView } from "@/components/utilities/meter-readings/search-view";
import type { MeterRecord, ReadingRecord, RecentReadingRow } from "@/components/utilities/meter-readings/types";
import { QrScanner } from "@/components/qr/qr-scanner";
import { PageShell } from "@/components/ui/dashboard";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  HIGH_USAGE_COPY,
  averageDailyUse,
  formatMeterQuantity,
  formatRecorded,
  formatSignedUse,
  lastSevenSpark,
  lowerThanLastWarning,
  meterLine,
  myRecentReadings,
  readingListStatus,
  readingTimeInFuture,
  readingTimeNow,
  savedReadingMessage,
  sinceLastLabel,
  usagePreview
} from "@/lib/meter-readings-display";
import { acceptReadingDraft, meterFractionDigits, readingFieldError } from "@/lib/meter-reading-input";
import { useCurrentUser } from "@/lib/use-current-user";

const READING_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC"]);
const RECENT_KEY = "maintainpro:recent-meters";

function readRecent(): MeterRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as MeterRecord[];
    return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row.id === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function rememberMeter(meter: MeterRecord) {
  const next = [meter, ...readRecent().filter((row) => row.id !== meter.id)].slice(0, 5);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

function matches(meter: MeterRecord, needle: string) {
  return `${meter.id} ${meter.meterNumber} ${meter.location ?? ""} ${meter.description ?? ""}`.toLowerCase().includes(needle);
}

const METER_HISTORY_TAKE = 50;
const MY_READINGS_TAKE = 50;

function meterReadingCountLabel(count: number): string {
  return count >= METER_HISTORY_TAKE ? `${METER_HISTORY_TAKE}+ saved` : `${count} saved`;
}

export default function MeterReadingsPage() {
  const user = useCurrentUser();
  const allowed = READING_ROLES.has(user.role ?? "");
  const valueHintId = useId();
  const [query, setQuery] = useState("");
  const [appliedNeedle, setAppliedNeedle] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [allMeters, setAllMeters] = useState<MeterRecord[]>([]);
  const [myReadings, setMyReadings] = useState<ReadingRecord[]>([]);
  const [latestReadings, setLatestReadings] = useState<ReadingRecord[]>([]);
  const [metersState, setMetersState] = useState<"loading" | "ready" | "error">("loading");
  const [metersError, setMetersError] = useState("");
  const [readingsState, setReadingsState] = useState<"loading" | "ready" | "error">("loading");
  const [readingsError, setReadingsError] = useState("");
  const [recent, setRecent] = useState<MeterRecord[]>([]);
  const [selected, setSelected] = useState<MeterRecord | null>(null);
  const [history, setHistory] = useState<ReadingRecord[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("ready");
  const [historyError, setHistoryError] = useState("");
  const [value, setValue] = useState("");
  const [rejectedDraft, setRejectedDraft] = useState("");
  const [readingAt, setReadingAt] = useState(() => readingTimeNow());
  const [note, setNote] = useState("");
  const [reset, setReset] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [warning, setWarning] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const attemptKey = useRef<string | null>(null);
  const historyRequest = useRef("");
  const valueRef = useRef<HTMLInputElement | null>(null);
  const bindValue = useCallback((node: HTMLInputElement | null) => {
    valueRef.current = node;
  }, []);
  const selectedId = selected?.id ?? "";

  useEffect(() => {
    setRecent(readRecent());
    void loadMeters();
    void loadReadingList();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const handle = window.setTimeout(() => valueRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [selectedId]);

  const fractionDigits = meterFractionDigits(selected?.unit, selected?.type);
  const fieldError = value ? readingFieldError(value, fractionDigits) : "Enter the meter reading.";
  const draftError = rejectedDraft || (value ? fieldError ?? "" : "");
  const last = history[0];
  const preview = useMemo(
    () => usagePreview(value, fractionDigits, last, history),
    [fractionDigits, history, last, value]
  );
  const lowerWarning = lowerThanLastWarning(value, fractionDigits, last, selected?.unit);
  const latestByMeter = useMemo(() => {
    const map = new Map<string, ReadingRecord>();
    for (const row of [...latestReadings, ...myReadings].sort((left, right) => new Date(right.readingDate).getTime() - new Date(left.readingDate).getTime())) {
      if (!row.meterId || map.has(row.meterId)) continue;
      map.set(row.meterId, row);
    }
    return map;
  }, [latestReadings, myReadings]);
  const visibleMeters = useMemo(() => {
    const found = appliedNeedle ? allMeters.filter((meter) => matches(meter, appliedNeedle)) : allMeters;
    return [...found].sort((left, right) => {
      const leftTime = new Date(latestByMeter.get(left.id)?.readingDate ?? 0).getTime();
      const rightTime = new Date(latestByMeter.get(right.id)?.readingDate ?? 0).getTime();
      return rightTime - leftTime;
    });
  }, [allMeters, appliedNeedle, latestByMeter]);
  const recentRows = useMemo<RecentReadingRow[]>(() => {
    const known = [...myReadings, ...latestReadings];
    return myRecentReadings(myReadings, user.id ?? "").map((row) => {
      const meter = row.meter ?? allMeters.find((item) => item.id === row.meterId) ?? null;
      const amount = Number(row.consumption ?? NaN);
      const sameMeter = known
        .filter((item, index, rows) => item.meterId && item.meterId === row.meterId && rows.findIndex((other) => other.id === item.id) === index)
        .sort((left, right) => new Date(right.readingDate).getTime() - new Date(left.readingDate).getTime());
      return {
        id: row.id,
        meterNumber: meter?.meterNumber ?? "Meter",
        meterLine: meterLine(meter?.description, meter?.location),
        reading: formatMeterQuantity(row.readingValue, meter?.unit) ?? String(row.readingValue),
        used: Number.isFinite(amount) ? formatSignedUse(amount, meter?.unit) : null,
        recorded: formatRecorded(row.readingDate) ?? "",
        status: readingListStatus(row, sameMeter)
      };
    });
  }, [allMeters, latestReadings, myReadings, user.id]);

  async function loadMeters() {
    setMetersState("loading");
    setMetersError("");
    try {
      const response = await apiClient.get("/utilities/meters");
      setAllMeters((response.data?.data ?? []) as MeterRecord[]);
      setMetersState("ready");
    } catch (cause) {
      setMetersError(getApiErrorMessage(cause, "Meters could not be loaded."));
      setMetersState("error");
    }
  }

  async function loadReadingList() {
    setReadingsState("loading");
    setReadingsError("");
    try {
      // Bounded lists: the latest reading per meter, and this user's last 7 days (max 50).
      const [latestResponse, mineResponse] = await Promise.all([
        apiClient.get("/utilities/meters/latest-readings"),
        apiClient.get("/utilities/readings", { params: { mine: "true", days: 7, take: MY_READINGS_TAKE } })
      ]);
      setLatestReadings((latestResponse.data?.data ?? []) as ReadingRecord[]);
      setMyReadings((mineResponse.data?.data ?? []) as ReadingRecord[]);
      setReadingsState("ready");
    } catch (cause) {
      setReadingsError(getApiErrorMessage(cause, "Readings could not be loaded."));
      setReadingsState("error");
    }
  }

  async function search(event?: FormEvent, scanned?: string) {
    event?.preventDefault();
    setNotice("");
    const needle = (scanned ?? query).trim().toLowerCase();
    setAppliedNeedle(needle);
    if (scanned) setQuery(scanned);
    try {
      const response = await apiClient.get("/utilities/meters");
      const rows = (response.data?.data ?? []) as MeterRecord[];
      setAllMeters(rows);
      setMetersState("ready");
      const found = needle ? rows.filter((row) => matches(row, needle)) : rows;
      if (scanned && found.length === 1) await choose(found[0]);
      if (scanned && found.length === 0) setNotice("No meter in this tenant matched the scanned code.");
    } catch (cause) {
      setMetersError(getApiErrorMessage(cause, "Meters could not be loaded."));
      setMetersState("error");
    }
  }

  async function loadHistory(meter: MeterRecord, options?: { quiet?: boolean }) {
    historyRequest.current = meter.id;
    if (!options?.quiet) {
      setHistoryState("loading");
      setHistoryError("");
    }
    try {
      const response = await apiClient.get(`/utilities/meters/${meter.id}/readings`, { params: { take: METER_HISTORY_TAKE } });
      if (historyRequest.current !== meter.id) return;
      const rows = (response.data?.data ?? []) as ReadingRecord[];
      rows.sort((left, right) => new Date(right.readingDate).getTime() - new Date(left.readingDate).getTime());
      setHistory(rows);
      setHistoryState("ready");
    } catch (cause) {
      if (historyRequest.current !== meter.id) return;
      setHistory([]);
      setHistoryError(getApiErrorMessage(cause, "Meter readings could not be loaded."));
      setHistoryState("error");
    }
  }

  async function choose(meter: MeterRecord) {
    const fresh = allMeters.find((row) => row.id === meter.id) ?? meter;
    setSelected(fresh);
    setMessage("");
    setWarning("");
    setError("");
    setNotice("");
    setValue("");
    setRejectedDraft("");
    setNote("");
    setReset(false);
    setResetReason("");
    // A new meter is a new reading: the time starts at now, not when the page opened.
    setReadingAt(readingTimeNow());
    attemptKey.current = null;
    setRecent(rememberMeter(fresh));
    await loadHistory(fresh);
  }

  function onReadingChange(incoming: string) {
    const next = acceptReadingDraft(value, incoming.replace(/,/g, ""), fractionDigits);
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
    if (readingTimeInFuture(readingAt)) {
      setError("Reading time cannot be in the future.");
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
    const savedValue = value.trim();
    const savedAt = readingAt;
    try {
      const response = await apiClient.post(`/utilities/meters/${selected.id}/readings`, {
        readingDate: new Date(readingAt).toISOString(),
        readingValue: savedValue,
        notes: note,
        resetReason: reset ? resetReason.trim() : undefined,
        idempotencyKey
      });
      const saved = response.data?.data as { warning?: string | null };
      setWarning(saved?.warning ? HIGH_USAGE_COPY : "");
      setMessage(savedReadingMessage(selected.meterNumber, savedValue, selected.unit, savedAt));
      setValue("");
      setNote("");
      setReset(false);
      setResetReason("");
      setReadingAt(readingTimeNow());
      attemptKey.current = null;
      await loadHistory(selected, { quiet: true });
      void loadReadingList();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The reading could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return <PageShell title="Access required" subtitle="Your role cannot record meter readings.">{null}</PageShell>;
  }

  const average = averageDailyUse(history);
  const averageText = average == null ? null : formatMeterQuantity(average, selected?.unit);
  const spark = lastSevenSpark(history);

  return (
    <div className="min-w-0">
      {selected ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            <button className="font-medium text-brand-800" type="button" onClick={() => setSelected(null)}>
              Meter Readings
            </button>
            <span> / {selected.meterNumber}</span>
          </p>
        <PageShell
          title="Record reading"
          actions={
            <button className="hidden min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 min-[641px]:inline-flex" type="button" onClick={() => setSelected(null)}>
              Change meter
            </button>
          }
        >
          <RecordView
            meter={selected}
            history={history}
            historyState={historyState}
            historyError={historyError}
            onRetryHistory={() => void loadHistory(selected)}
            value={value}
            onValueChange={onReadingChange}
            fractionDigits={fractionDigits}
            draftError={draftError}
            valueHintId={valueHintId}
            valueRef={bindValue}
            usageText={preview ? formatSignedUse(preview.consumption, selected.unit) : null}
            usageTone={preview ? (preview.warning ? "high" : "normal") : null}
            sinceLast={last ? sinceLastLabel(last.readingDate) : null}
            averageText={averageText}
            spark={spark}
            readingCount={historyState === "ready" ? meterReadingCountLabel(history.length) : null}
            readingAt={readingAt}
            onReadingAt={setReadingAt}
            reset={reset}
            onReset={setReset}
            resetReason={resetReason}
            onResetReason={setResetReason}
            note={note}
            onNote={setNote}
            warning={preview?.warning || warning}
            lowerWarning={lowerWarning}
            message={message}
            error={error}
            saving={saving}
            submitDisabled={saving || historyState === "loading" || Boolean(fieldError)}
            onSubmit={(event) => void submit(event)}
            onChangeMeter={() => setSelected(null)}
            onScanNext={() => {
              setReadingAt(readingTimeNow());
              setScanOpen(true);
            }}
          />
        </PageShell>
        </div>
      ) : (
        <PageShell title="Meter Readings" subtitle="Record the number on the meter. Search, scan, or pick a recent meter.">
          <SearchView
            query={query}
            onQueryChange={setQuery}
            onSearch={(event) => void search(event)}
            onScan={() => setScanOpen(true)}
            recent={recent}
            onPick={(meter) => void choose(meter)}
            meters={visibleMeters}
            latestByMeter={latestByMeter}
            metersState={metersState}
            metersError={metersError}
            onRetryMeters={() => void loadMeters()}
            readings={recentRows}
            readingsState={readingsState}
            readingsError={readingsError}
            onRetryReadings={() => void loadReadingList()}
            notice={notice}
            filtered={Boolean(appliedNeedle)}
          />
        </PageShell>
      )}
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
    </div>
  );
}
