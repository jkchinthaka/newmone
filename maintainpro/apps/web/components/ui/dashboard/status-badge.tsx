import React from "react";

import { statusBadgePresentation, STATUS_TONE_CLASS, type StatusTone } from "@/lib/dashboard-status";

import { cn } from "./cn";

export function StatusBadge({
  status,
  label,
  tone,
  className
}: {
  status: string;
  label?: string;
  tone?: StatusTone;
  className?: string;
}) {
  const presentation = statusBadgePresentation(status);
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-black/10", STATUS_TONE_CLASS[tone ?? presentation.tone], className)}>
      {label ?? presentation.label}
    </span>
  );
}
