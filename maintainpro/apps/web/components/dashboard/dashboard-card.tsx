import type { ReactNode } from "react";

const toneClasses: Record<string, string> = {
  neutral: "border-slate-200 bg-white text-slate-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800"
};

type DashboardCardProps = {
  label: string;
  value: ReactNode;
  subLabel?: string;
  tone?: keyof typeof toneClasses;
  className?: string;
};

export function DashboardCard({
  label,
  value,
  subLabel,
  tone = "neutral",
  className = ""
}: DashboardCardProps) {
  return (
    <div
      className={`rounded-card border px-3 py-2 shadow-card ${toneClasses[tone] ?? toneClasses.neutral} ${className}`.trim()}
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {subLabel ? <p className="mt-1 text-xs opacity-80">{subLabel}</p> : null}
    </div>
  );
}
