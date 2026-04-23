"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, X } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  supportingText?: string;
  icon?: ReactNode;
  trend?: {
    direction: "up" | "down" | "flat";
    value: string;
  };
};

export function StatCard({ label, value, supportingText, icon, trend }: StatCardProps) {
  const trendTone =
    trend?.direction === "up"
      ? "text-rose-600"
      : trend?.direction === "down"
        ? "text-emerald-600"
        : "text-slate-500";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        {icon ? <div className="rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</div> : null}
      </div>

      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>

      <div className="mt-2 flex items-center gap-2 text-xs">
        {trend ? (
          <span className={`inline-flex items-center gap-1 font-semibold ${trendTone}`}>
            {trend.direction === "up" ? <ArrowUpRight size={13} /> : null}
            {trend.direction === "down" ? <ArrowDownRight size={13} /> : null}
            {trend.direction === "flat" ? <Minus size={13} /> : null}
            {trend.value}
          </span>
        ) : null}
        {supportingText ? <span className="text-slate-500">{supportingText}</span> : null}
      </div>
    </article>
  );
}

type StatusBadgeProps = {
  label: string;
  toneClass: string;
};

export function StatusBadge({ label, toneClass }: StatusBadgeProps) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneClass}`}>{label}</span>;
}

type ModalShellProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  widthClass?: string;
};

export function ModalShell({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
  widthClass = "max-w-2xl"
}: ModalShellProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
      <div className={`w-full ${widthClass} rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4">{children}</div>

        {footer ? <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

type DataTableProps = {
  children: ReactNode;
  minWidthClass?: string;
};

export function DataTable({ children, minWidthClass = "min-w-[900px]" }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className={`${minWidthClass} w-full text-left text-sm`}>{children}</table>
      </div>
    </div>
  );
}

export function LoadingPanel({ className = "h-40" }: { className?: string }) {
  return <div className={`${className} animate-pulse rounded-2xl bg-slate-200`} />;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h4 className="text-base font-semibold text-slate-800">{title}</h4>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}
