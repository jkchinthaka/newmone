"use client";

import { statusTone } from "@/lib/fg-mappers";

export function FgStatusBadge({ label }: { label: string }) {
  const tone = statusTone(label);
  const classes: Record<typeof tone, string> = {
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    danger: "bg-rose-50 text-rose-800 ring-rose-200",
    review: "bg-amber-50 text-amber-900 ring-amber-200",
    progress: "bg-sky-50 text-sky-800 ring-sky-200",
    neutral: "bg-slate-100 text-slate-700 ring-slate-200"
  };
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ${classes[tone]}`}
    >
      {label}
    </span>
  );
}
