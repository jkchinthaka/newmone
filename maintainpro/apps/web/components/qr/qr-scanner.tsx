"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CameraOff, Loader2, QrCode, X } from "lucide-react";

type QrScannerProps = {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
  /** Optional heading shown above the camera viewport */
  title?: string;
  /** Manual entry label for environments without camera support */
  manualLabel?: string;
};

/**
 * Shared web QR scanner for asset tags / work verification.
 * Lazy-loads html5-qrcode; releases the camera on close/unmount.
 * Does not invent a second QR format — callers interpret the raw/normalized string.
 */
export function QrScanner({
  open,
  onClose,
  onScan,
  title = "Scan QR code",
  manualLabel = "Or enter asset / tag code"
}: QrScannerProps) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void | Promise<void>;
  } | null>(null);
  const handledRef = useRef(false);

  const [cameraBusy, setCameraBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [unsupported, setUnsupported] = useState(false);

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) {
      return;
    }
    try {
      await scannerRef.current.stop();
    } catch {
      // already stopped
    }
    try {
      await scannerRef.current.clear();
    } catch {
      // already cleared
    }
    scannerRef.current = null;
  }, []);

  const normalizeQrValue = useCallback((rawValue: string) => {
    const trimmed = rawValue.trim();
    try {
      const parsed = new URL(trimmed);
      return (
        parsed.searchParams.get("code")?.trim() ||
        parsed.searchParams.get("assetId")?.trim() ||
        parsed.searchParams.get("tag")?.trim() ||
        trimmed
      );
    } catch {
      return trimmed;
    }
  }, []);

  const emitScan = useCallback(
    (raw: string) => {
      if (handledRef.current) {
        return;
      }
      const value = normalizeQrValue(raw);
      if (!value) {
        setError("QR code is empty or invalid.");
        return;
      }
      handledRef.current = true;
      void stopScanner().then(() => onScan(value));
    },
    [normalizeQrValue, onScan, stopScanner]
  );

  useEffect(() => {
    if (!open) {
      handledRef.current = false;
      setError(null);
      setUnsupported(false);
      void stopScanner();
      return;
    }

    let cancelled = false;
    handledRef.current = false;

    async function start() {
      setCameraBusy(true);
      setError(null);

      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setUnsupported(true);
        setError("This browser does not support camera access. Use manual entry.");
        setCameraBusy(false);
        return;
      }

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) {
          return;
        }

        const scanner = new Html5Qrcode(`qr-scanner-${regionId}`);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (decoded) => emitScan(decoded),
          () => undefined
        );
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        const message = err instanceof Error ? err.message : "Camera could not start.";
        if (name === "NotAllowedError" || /permission/i.test(message)) {
          setError("Camera permission denied. Allow camera access or enter the code manually.");
        } else if (name === "NotFoundError") {
          setError("No camera found on this device. Enter the code manually.");
        } else {
          setUnsupported(true);
          setError(message);
        }
        await stopScanner();
      } finally {
        if (!cancelled) {
          setCameraBusy(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [emitScan, open, regionId, stopScanner]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`qr-title-${regionId}`}
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id={`qr-title-${regionId}`} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            <p className="mt-1 text-xs text-slate-600">Camera is used only while this scanner is open.</p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
            aria-label="Close scanner"
            onClick={() => {
              void stopScanner().then(onClose);
            }}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div
          id={`qr-scanner-${regionId}`}
          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950"
        />

        {cameraBusy ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="animate-spin" size={16} aria-hidden />
            Starting camera…
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
            {unsupported ? <CameraOff size={16} className="mt-0.5 shrink-0" aria-hidden /> : <QrCode size={16} className="mt-0.5 shrink-0" aria-hidden />}
            <span>{error}</span>
          </p>
        ) : null}

        <label className="mt-4 block text-sm font-medium text-slate-800" htmlFor={`qr-manual-${regionId}`}>
          {manualLabel}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id={`qr-manual-${regionId}`}
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            className="min-h-11 w-full flex-1 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="Asset tag or QR payload"
            autoComplete="off"
          />
          <button
            type="button"
            className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            onClick={() => emitScan(manualCode)}
          >
            Use code
          </button>
        </div>
      </div>
    </div>
  );
}
