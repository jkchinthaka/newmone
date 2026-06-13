"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sunrise } from "lucide-react";

import { ErrorState, InlineLoadingState } from "@/components/ui/page-state";
import { fetchActionCenterSnapshot } from "@/lib/action-center-api";
import {
  buildMorningBriefingLines,
  morningBriefingSupported,
  resolveActionCenterVariant,
  type ActionCenterTone
} from "@/lib/action-center";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { DashboardSection } from "./dashboard-section";

const toneClasses: Record<ActionCenterTone, string> = {
  neutral: "text-slate-700 bg-slate-100",
  info: "text-sky-800 bg-sky-100",
  warning: "text-amber-900 bg-amber-100",
  danger: "text-red-800 bg-red-100",
  success: "text-emerald-800 bg-emerald-100"
};

export function MorningBriefing() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const variant = resolveActionCenterVariant(roleName);

  if (!morningBriefingSupported(variant)) {
    return null;
  }

  const query = useQuery({
    queryKey: ["morning-briefing", user.id, roleName],
    queryFn: () =>
      fetchActionCenterSnapshot({
        variant,
        roleName,
        userId: user.id
      }),
    refetchInterval: 60_000
  });

  return (
    <DashboardSection
      title="Morning briefing"
      description="A compact snapshot of what needs attention today from live operational data."
      action={
        <Link
          href={"/action-center" as Route}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          Open Action Center <ArrowRight size={14} aria-hidden="true" />
        </Link>
      }
    >
      {query.isLoading ? <InlineLoadingState label="Loading morning briefing…" /> : null}
      {query.isError ? (
        <ErrorState title="Could not load briefing" error={query.error} onRetry={() => query.refetch()} />
      ) : null}
      {query.data ? (
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50/80 to-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sunrise size={16} className="text-amber-600" aria-hidden="true" />
            Today&apos;s priorities
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Morning briefing priorities">
            {buildMorningBriefingLines(query.data).map((line) => (
              <li
                key={line.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="text-slate-600">{line.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClasses[line.tone ?? "neutral"]}`}
                >
                  {line.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </DashboardSection>
  );
}
