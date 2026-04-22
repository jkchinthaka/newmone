"use client";

import { QrCode, ScanLine } from "lucide-react";
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
  scannedAt: string;
  location: {
    name: string;
  };
  cleaner: {
    firstName: string;
    lastName: string;
  };
};

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

  const submitScan = useCallback(
    async (rawValue: string) => {
      const qrCode = normalizeQrValue(rawValue);

      if (!qrCode) {
        setError("QR code is empty or invalid.");
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        const response = await apiClient.post("/cleaning/scan", { qrCode });
        setResult(response.data?.data ?? null);
        setManualCode("");
      } catch (err) {
        const typedError = err as { response?: { data?: { message?: string | string[] } } };
        const message = typedError?.response?.data?.message;
        setResult(null);
        setError(Array.isArray(message) ? message.join(", ") : message ?? "Scan failed.");
      } finally {
        setSubmitting(false);
      }
    },
    [normalizeQrValue]
  );

  const startScanner = useCallback(async () => {
    setCameraBusy(true);
    setError(null);
    setResult(null);

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
          await stopScanner();
          setScannerOpen(false);
          await submitScan(decodedText);
        },
        () => {
          // ignore frame-level decode failures
        }
      );

      setScannerOpen(true);
    } catch {
      await stopScanner();
      setError("Unable to access the camera. You can still paste the QR code manually.");
    } finally {
      setCameraBusy(false);
    }
  }, [stopScanner, submitScan]);

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
    if (!codeFromUrl || authLoading || !isCleaner || submitting) {
      return;
    }

    if (autoProcessedCodeRef.current === codeFromUrl) {
      return;
    }

    autoProcessedCodeRef.current = codeFromUrl;
    void submitScan(codeFromUrl);
  }, [authLoading, codeFromUrl, isCleaner, submitting, submitScan]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  if (authLoading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Checking cleaner access...</div>;
  }

  if (!isCleaner) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        This page is reserved for logged-in cleaners. Use a cleaner account to scan and log washroom visits.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
          Cleaner QR Scan
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Log a washroom cleaning visit</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Scan the QR code mounted inside the washroom. The system records the location, your user account, and the server timestamp automatically.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
              <ScanLine size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Scan QR Code</h2>
              <p className="text-sm text-slate-600">Use the device camera or paste a QR value/URL.</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <div id="cleaning-qr-reader" className={`${scannerOpen ? "block" : "hidden"} overflow-hidden rounded-xl`} />

            {!scannerOpen ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-xl bg-white text-center">
                <div className="rounded-full bg-slate-100 p-4 text-slate-500">
                  <QrCode size={40} />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">Ready to scan</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Point your camera at the QR code inside the washroom.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void startScanner()}
                  disabled={cameraBusy || submitting}
                  className="rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {cameraBusy ? "Opening camera..." : "Scan QR"}
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

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">Manual fallback</p>
            <p className="mt-1 text-xs text-slate-500">
              Paste the QR code value or the full scan URL if the camera is unavailable.
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
                onClick={() => void submitScan(manualCode)}
                disabled={submitting || !manualCode.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Log Visit"}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {codeFromUrl ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 shadow-sm">
              QR link detected in URL. The code is being validated automatically.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-600 px-3 py-1 text-lg font-bold text-white">✓</div>
                <div>
                  <p className="text-lg font-semibold text-emerald-900">Cleaning visit logged</p>
                  <p className="mt-2 text-sm text-emerald-800">
                    {result.location.name} marked as cleaned at {new Date(result.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} by {result.cleaner.firstName} {result.cleaner.lastName}.
                  </p>
                  <p className="mt-2 text-xs text-emerald-700">
                    Server timestamp: {new Date(result.scannedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              Successful scans will appear here with the exact time and location confirmation.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}