import React from "react";

import { statusBadgePresentation, STATUS_TONE_CLASS } from "@/lib/dashboard-status";

import { cn } from "./cn";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const presentation = statusBadgePresentation(status);
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE_CLASS[presentation.tone], className)}>
      {presentation.label}
    </span>
  );
}
