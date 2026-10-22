"use client";
import { useEffect, useState } from "react";
import { readAccessPreview, stopAccessPreview, type AccessPreview } from "@/lib/access-preview";

export function AccessPreviewBanner() {
  const [preview, setPreview] = useState<AccessPreview | null>(null);
  useEffect(() => { setPreview(readAccessPreview()); }, []);
  if (!preview) return null;
  return <div role="status" className="sticky top-0 z-[100] flex shrink-0 flex-wrap items-center justify-between gap-2 bg-amber-200 px-4 py-3 text-sm font-semibold text-amber-950">
    <span>Preview as {preview.label} — read-only. Changes are blocked.</span>
    <button type="button" onClick={stopAccessPreview} className="min-h-11 rounded border border-amber-800 px-3">Exit preview</button>
  </div>;
}
