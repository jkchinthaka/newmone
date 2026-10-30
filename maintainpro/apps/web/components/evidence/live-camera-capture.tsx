"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, RotateCcw, SwitchCamera } from "lucide-react";

import { ButtonSpinner } from "@/components/ui/loading";
import { fitWithin } from "@/lib/work-order-photo-upload";

export type LiveCapture = { blob: Blob; previewUrl: string; fileName: string; mimeType: "image/jpeg" };

type Facing = "environment" | "user";

type LiveCameraCaptureProps = {
  /** Shown on the shutter button, e.g. "Take before photo". */
  captureLabel: string;
  /** Called with the confirmed photo. Return false (or throw) to keep the preview for a retry. */
  onUse: (capture: LiveCapture) => Promise<boolean | void> | boolean | void;
  useLabel?: string;
  disabled?: boolean;
  busy?: boolean;
};

/**
 * In-app camera only: the photo is taken from the live video, so a saved gallery picture or file
 * cannot be chosen. Back camera by default, with a switch to the front (selfie) camera.
 */
export function LiveCameraCapture({ captureLabel, onUse, useLabel = "Use this photo", disabled = false, busy = false }: LiveCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState<LiveCapture | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(
    async (nextFacing: Facing = facing) => {
      setError(null);
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("This device or browser cannot open the camera here. Use a phone or tablet, over the secure (https) site.");
        return;
      }
      setStarting(true);
      stop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setFacing(nextFacing);
        setActive(true);
      } catch (cause) {
        const name = (cause as { name?: string })?.name;
        setError(
          name === "NotAllowedError"
            ? "Camera permission was refused. Allow the camera for this site in the browser settings, then try again."
            : name === "NotFoundError"
              ? "No camera was found on this device."
              : "The camera could not be opened. Close other apps that use the camera and try again."
        );
      } finally {
        setStarting(false);
      }
    },
    [facing, stop]
  );

  useEffect(() => () => {
    stop();
  }, [stop]);

  useEffect(() => () => {
    if (capture?.previewUrl) URL.revokeObjectURL(capture.previewUrl);
  }, [capture]);

  async function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const size = fitWithin(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) {
      setError("The photo could not be taken. Try again.");
      return;
    }
    stop();
    setCapture({
      blob,
      previewUrl: URL.createObjectURL(blob),
      fileName: `photo-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`,
      mimeType: "image/jpeg"
    });
  }

  async function use() {
    if (!capture) return;
    const result = await onUse(capture);
    if (result !== false) setCapture(null);
  }

  return (
    <div className="space-y-3">
      {capture ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capture.previewUrl} alt="Photo just taken" className="max-h-72 w-full rounded-lg border border-slate-200 object-contain" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => void use()}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? <ButtonSpinner /> : null}
              {useLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCapture(null);
                void start();
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              <RotateCcw size={16} aria-hidden /> Retake
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className={`relative overflow-hidden rounded-lg bg-slate-900 ${active ? "" : "hidden"}`}>
            <video ref={videoRef} playsInline muted className="max-h-72 w-full object-contain" aria-label="Camera preview" />
          </div>
          {active ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={disabled}
                onClick={() => void shoot()}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Camera size={16} aria-hidden /> {captureLabel}
              </button>
              <button
                type="button"
                onClick={() => void start(facing === "environment" ? "user" : "environment")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700"
              >
                <SwitchCamera size={16} aria-hidden /> {facing === "environment" ? "Front camera" : "Back camera"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled || starting}
              onClick={() => void start()}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 px-4 text-sm font-semibold text-brand-800 disabled:opacity-60"
            >
              {starting ? <ButtonSpinner /> : <Camera size={18} aria-hidden />}
              Open camera
            </button>
          )}
          {error ? (
            <div role="alert" className="flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <span>{error}</span>
              <button type="button" onClick={() => void start()} className="inline-flex shrink-0 items-center gap-1 font-medium underline">
                <RefreshCw size={14} aria-hidden /> Try again
              </button>
            </div>
          ) : null}
          <p className="text-xs text-slate-500">Photos are taken live with the camera. Saved pictures and files cannot be used.</p>
        </div>
      )}
    </div>
  );
}
