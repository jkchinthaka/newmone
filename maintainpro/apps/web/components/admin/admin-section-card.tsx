import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";

import type { AdminConsoleSection } from "@/lib/admin-console";

const statusStyles: Record<AdminConsoleSection["status"], string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "coming-soon": "border-slate-200 bg-slate-50 text-slate-700",
  "requires-api": "border-amber-200 bg-amber-50 text-amber-900"
};

type AdminSectionCardProps = {
  section: AdminConsoleSection;
};

export function AdminSectionCard({ section }: AdminSectionCardProps) {
  const canNavigate = section.status === "available" && section.href;

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyles[section.status]}`}
        >
          {section.statusLabel}
        </span>
      </div>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{section.description}</p>
      <div className="mt-4">
        {canNavigate ? (
          <Link
            href={section.href as Route}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Open module <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <p className="text-xs font-medium text-slate-500">
            {section.status === "requires-api" ? "Requires backend endpoint" : "Coming soon"}
          </p>
        )}
      </div>
    </article>
  );
}
