import React from "react";
import type { LucideIcon } from "lucide-react";

import type { StatusTone } from "@/lib/dashboard-status";
import { STATUS_TONE_CLASS } from "@/lib/dashboard-status";

import { cn } from "./cn";

export type DashboardKpiCardProps = {
  label: string;
  value: string;
  icon?: LucideIcon;
  delta?: string;
  tone?: StatusTone;
};

export function KpiCard({ label, value, icon: Icon, delta, tone = "neutral", compact = false, className }: DashboardKpiCardProps & { compact?: boolean; className?: string }) {
  return (
    <article className={cn("rounded-card border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-slate-900", compact ? "p-3" : "p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
        {Icon ? (
          <span className={cn("rounded-md p-1.5", STATUS_TONE_CLASS[tone])}>
            <Icon aria-hidden className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className={cn("font-semibold tracking-tight text-slate-900 dark:text-slate-50", compact ? "mt-2 text-xl" : "mt-3 text-2xl")}>{value}</p>
      {delta ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{delta}</p> : null}
    </article>
  );
}
