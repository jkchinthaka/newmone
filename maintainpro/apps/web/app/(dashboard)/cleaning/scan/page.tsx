"use client";

import { QrCode, ScanLine, Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { apiClient } from "@/lib/api-client";

type AuthUser = {
  firstName: string;
  lastName: string;
  role?: {
    name?: string;
  } | null;
};

type ScanResult = {
  id: string;
  scannedAt: string;
  location: {
    name: string;
  };
  cleaner: {
    firstName: string;
    lastName: string;
  };
  scheduleStatus?: string;
  geoValidated?: boolean;
};

type ChecklistItem = {
  label: string;
  checked: boolean;
  note?: string;
  required?: boolean;
};

type ActiveVisit = {
  id: string;
  scannedAt: string;
  startedAt?: string;
  location: {
    name: string;
    requirePhotoEvidence?: boolean;
  };
  checklist?: {
    items: ChecklistItem[];
  } | null;
};

function parseUrlList(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function CleaningScanPage() {
  const searchParams = useSearchParams();
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void | Promise<void>;
  } | null>(null);
  const autoProcessedCodeRef = useRef<string | null>(null);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"QUICK" | "FULL">("QUICK");

  const [beforePhotoText, setBeforePhotoText] = useState("");
  const [afterPhotoText, setAfterPhotoText] = useState("");
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [visitNotes, setVisitNotes] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const codeFromUrl = searchParams.get("code") ?? "";

  const isCleaner = useMemo(() => authUser?.role?.name === "CLEANER", [authUser]);

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) {
      return;
    }

    try {
      await scannerRef.current.stop();
    } catch {
      // scanner may already be stopped
    }

    try {
      await scannerRef.current.clear();
    } catch {
      // scanner may already be cleared
    }

    scannerRef.current = null;
  }, []);

  const normalizeQrValue = useCallback((rawValue: string) => {
    const trimmed = rawValue.trim();

    try {
      const parsed = new URL(trimmed);
      return parsed.searchParams.get("code")?.trim() || trimmed;
    } catch {
      return trimmed;
    }
  }, []);

  const getDeviceId = useCallback(() => {
    const key = "maintainpro-cleaning-device";
    const existing = window.localStorage.getItem(key);
    if (existing) {
      return existing;
    }

    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `device-${Math.random().toString(36).slice(2, 12)}`;

    window.localStorage.setItem(key, generated);
    return generated;
  }, []);

  const getGeo = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return {};
    }

    return new Promise<{ latitude?: number; longitude?: number }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }),
        () => resolve({}),
        {
          maximumAge: 20_000,
          timeout: 6_000,
          enableHighAccuracy: false
        }
      );
    });
  }, []);

  const buildScanMeta = useCallback(async () => {
    const geo = await getGeo();
    return {
      clientScannedAt: new Date().toISOString(),
      deviceId: getDeviceId(),
      ...geo
    };
  }, [getDeviceId, getGeo]);

  const submitQuickScan = useCallback(
    async (rawValue: string) => {
      const qrCode = normalizeQrValue(rawValue);

      if (!qrCode) {
        setError("QR code is empty or invalid.");
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        const meta = await buildScanMeta();
        const response = await apiClient.post("/cleaning/scan", {
          qrCode,
          ...meta
        });

        setResult(response.data?.data ?? null);
        setActiveVisit(null);
        setChecklist([]);
        setVisitNotes("");
        setManualCode("");
      } catch (err) {
        const typedError = err as { response?: { data?: { message?: string | string[] } } };
        const message = typedError?.response?.data?.message;
        setResult(null);
        setError(Array.isArray(message) ? message.join(", ") : message ?? "Quick scan failed.");
      } finally {
        setSubmitting(false);
      }
    },
    [buildScanMeta, normalizeQrValue]
  );

  const startFullVisit = useCallback(
    async (rawValue: string) => {
      const qrCode = normalizeQrValue(rawValue);

      if (!qrCode) {
        setError("QR code is empty or invalid.");
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        const meta = await buildScanMeta();
        const response = await apiClient.post("/cleaning/visits/scan", {
          qrCode,
          beforePhotos: parseUrlList(beforePhotoText),
          ...meta
        });

        const visit = response.data?.data as ActiveVisit;
        const visitItems = (visit?.checklist?.items ?? []).map((item) => ({
          label: item.label,
          checked: Boolean(item.checked),
          required: Boolean(item.required),
          note: item.note ?? ""
        }));

        setActiveVisit(visit);
        setChecklist(visitItems);
        setResult(null);
        setAfterPhotoText("");
      } catch (err) {
        const typedError = err as { response?: { data?: { message?: string | string[] } } };
        const message = typedError?.response?.data?.message;
        setError(Array.isArray(message) ? message.join(", ") : message ?? "Could not start full visit.");
      } finally {
        setSubmitting(false);
      }
    },
    [beforePhotoText, buildScanMeta, normalizeQrValue]
  );

  const submitFullVisit = useCallback(async () => {
    if (!activeVisit) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`/cleaning/visits/${activeVisit.id}/submit`, {
        checklist,
        notes: visitNotes || undefined,
        afterPhotos: parseUrlList(afterPhotoText)
      });

      setActiveVisit(null);
      setChecklist([]);
      setVisitNotes("");
      setAfterPhotoText("");
      setBeforePhotoText("");
      setManualCode("");
      setResult(null);
    } catch (err) {
      const typedError = err as { response?: { data?: { message?: string | string[] } } };
      const message = typedError?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(", ") : message ?? "Visit submission failed.");
    } finally {
      setSubmitting(false);
    }
  }, [activeVisit, afterPhotoText, checklist, visitNotes]);

  const onQrDetected = useCallback(
    async (decodedText: string) => {
      await stopScanner();
      setScannerOpen(false);

      if (mode === "QUICK") {
        await submitQuickScan(decodedText);
      } else {
        await startFullVisit(decodedText);
      }
    },
    [mode, startFullVisit, stopScanner, submitQuickScan]
  );

  const startScanner = useCallback(async () => {
    setCameraBusy(true);
    setError(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("cleaning-qr-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 }
        },
        async (decodedText) => {
          await onQrDetected(decodedText);
        },
        () => {
          // ignore frame-level decode errors
        }
      );

      setScannerOpen(true);
    } catch {
      await stopScanner();
      setError("Unable to access the camera. You can still paste the QR code manually.");
    } finally {
      setCameraBusy(false);
    }
  }, [onQrDetected, stopScanner]);

  useEffect(() => {
    apiClient
      .get("/auth/me")
      .then((response) => {
        setAuthUser(response.data?.data ?? null);
      })
      .catch(() => {
        setAuthUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!activeVisit) {
      setElapsedSeconds(0);
      return;
    }

    const started = new Date(activeVisit.startedAt ?? activeVisit.scannedAt).getTime();
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
      setElapsedSeconds(seconds);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeVisit]);

  useEffect(() => {
    if (!codeFromUrl || authLoading || !isCleaner || submitting) {
      return;
    }

    if (autoProcessedCodeRef.current === codeFromUrl) {
      return;
    }

    autoProcessedCodeRef.current = codeFromUrl;

    if (mode === "QUICK") {
      void submitQuickScan(codeFromUrl);
    } else {
      void startFullVisit(codeFromUrl);
    }
  }, [authLoading, codeFromUrl, isCleaner, mode, startFullVisit, submitting, submitQuickScan]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  if (authLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Checking cleaner access...
      </div>
    );
  }

  if (!isCleaner) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        This page is reserved for logged-in cleaners. Use a cleaner account to scan and log visits.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
          Smart Visit System
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Proof-based cleaning verification</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Choose quick scan for rapid logging, or full visit mode for checklist completion,
          before/after photos, and duration tracking.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("QUICK")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            mode === "QUICK"
              ? "bg-slate-900 text-white"
              : "border border-slate-300 bg-white text-slate-700"
          }`}
        >
          Quick Scan
        </button>
        <button
          type="button"
          onClick={() => setMode("FULL")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            mode === "FULL"
              ? "bg-slate-900 text-white"
              : "border border-slate-300 bg-white text-slate-700"
          }`}
        >
          Full Visit Flow
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
              <ScanLine size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {mode === "QUICK" ? "Quick QR Validation" : "Start Full Cleaning Visit"}
              </h2>
              <p className="text-sm text-slate-600">
                {mode === "QUICK"
                  ? "Timestamp, geofence and device checks are applied automatically."
                  : "Begin a guided visit with checklist and photo evidence."}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <div id="cleaning-qr-reader" className={`${scannerOpen ? "block" : "hidden"} overflow-hidden rounded-xl`} />

            {!scannerOpen ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center gap-4 rounded-xl bg-white text-center">
                <div className="rounded-full bg-slate-100 p-4 text-slate-500">
                  <QrCode size={40} />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">Ready to scan</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Point your camera at the washroom QR tag.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void startScanner()}
                  disabled={cameraBusy || submitting}
                  className="rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {cameraBusy ? "Opening camera..." : mode === "QUICK" ? "Scan & Validate" : "Scan & Start Visit"}
                </button>
              </div>
            ) : (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void stopScanner();
                    setScannerOpen(false);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Stop Scanner
                </button>
              </div>
            )}
          </div>

          {mode === "FULL" ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">Before photos (S3 or cloud URLs, one per line)</p>
              <textarea
                value={beforePhotoText}
                onChange={(event) => setBeforePhotoText(event.target.value)}
                rows={3}
                placeholder="https://cdn.example.com/before-1.jpg"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">Manual fallback</p>
            <p className="mt-1 text-xs text-slate-500">
              Paste a QR value or scan URL if camera scanning is unavailable.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="Paste QR value or https://.../cleaning/scan?code=..."
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
              <button
                type="button"
                onClick={() => (mode === "QUICK" ? void submitQuickScan(manualCode) : void startFullVisit(manualCode))}
                disabled={submitting || !manualCode.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting
                  ? "Submitting..."
                  : mode === "QUICK"
                    ? "Run Quick Scan"
                    : "Start Full Visit"}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {codeFromUrl ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 shadow-sm">
              QR link detected in URL. Processing automatically.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          ) : null}

          {mode === "QUICK" ? (
            result ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <p className="text-lg font-semibold text-emerald-900">Quick scan logged</p>
                <p className="mt-2 text-sm text-emerald-800">
                  {result.location.name} marked as cleaned by {result.cleaner.firstName} {result.cleaner.lastName}.
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  {new Date(result.scannedAt).toLocaleString()} · Schedule {result.scheduleStatus ?? "ON_TIME"} · Geofence {result.geoValidated ? "validated" : "not configured"}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
                Successful quick scans will appear here with validation status.
              </div>
            )
          ) : activeVisit ? (
            <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Active Visit</p>
                  <p className="text-xs text-slate-600">{activeVisit.location.name}</p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  <Timer size={14} /> {formatElapsed(elapsedSeconds)}
                </div>
              </div>

              <div className="space-y-2 rounded-xl bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</p>
                {checklist.length === 0 ? (
                  <p className="text-sm text-slate-500">No checklist is configured for this location.</p>
                ) : (
                  checklist.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="rounded-lg border border-slate-200 p-2">
                      <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(event) => {
                            setChecklist((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, checked: event.target.checked }
                                  : entry
                              )
                            );
                          }}
                        />
                        <span>
                          {item.label}
                          {item.required ? " *" : ""}
                        </span>
                      </label>
                      <input
                        value={item.note ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setChecklist((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, note: value } : entry
                            )
                          );
                        }}
                        placeholder="Optional note"
                        className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-xl bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  After photos (required when enabled)
                </p>
                <textarea
                  value={afterPhotoText}
                  onChange={(event) => setAfterPhotoText(event.target.value)}
                  rows={3}
                  placeholder="https://cdn.example.com/after-1.jpg"
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />

                <textarea
                  value={visitNotes}
                  onChange={(event) => setVisitNotes(event.target.value)}
                  rows={2}
                  placeholder="Visit notes for supervisor"
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />

                <button
                  type="button"
                  onClick={() => void submitFullVisit()}
                  disabled={submitting}
                  className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Visit for Sign-off"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              Start a full visit to complete checklist items and upload proof photos.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
