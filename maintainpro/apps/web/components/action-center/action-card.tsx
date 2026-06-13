import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";

import type { ActionCenterItem, ActionCenterTone } from "@/lib/action-center";

const toneStyles: Record<ActionCenterTone, string> = {
  neutral: "border-slate-200 bg-white",
  info: "border-sky-200 bg-sky-50/60",
  warning: "border-amber-200 bg-amber-50/70",
  danger: "border-red-200 bg-red-50/70",
  success: "border-emerald-200 bg-emerald-50/70"
};

const metricToneStyles: Record<ActionCenterTone, string> = {
  neutral: "text-slate-700 bg-slate-100",
  info: "text-sky-800 bg-sky-100",
  warning: "text-amber-900 bg-amber-100",
  danger: "text-red-800 bg-red-100",
  success: "text-emerald-800 bg-emerald-100"
};

type ActionCardProps = {
  item: ActionCenterItem;
};

export function ActionCard({ item }: ActionCardProps) {
  const tone = item.tone ?? "neutral";

  return (
    <Link
      href={item.href as Route}
      className={`group block rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${toneStyles[tone]}`}
      aria-label={`${item.title}. ${item.description}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-900">{item.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
          {item.statusLabel ? (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.statusLabel}</p>
          ) : null}
        </div>
        <ArrowRight size={16} className="mt-0.5 shrink-0 text-slate-400 group-hover:text-brand-700" aria-hidden="true" />
      </div>
      {item.metricLabel && item.metricValue ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{item.metricLabel}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${metricToneStyles[tone]}`}
            aria-label={`${item.metricLabel}: ${item.metricValue}`}
          >
            {item.metricValue}
          </span>
        </div>
      ) : null}
    </Link>
  );
}
