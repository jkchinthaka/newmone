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

export function KpiCard({ label, value, icon: Icon, delta, tone = "neutral" }: DashboardKpiCardProps) {
  return (
    <article className="rounded-card border border-slate-200 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
        {Icon ? (
          <span className={cn("rounded-md p-1.5", STATUS_TONE_CLASS[tone])}>
            <Icon aria-hidden className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{value}</p>
      {delta ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{delta}</p> : null}
    </article>
  );
}
