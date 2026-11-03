import React from "react";

export function SkeletonCard() {
  return (
    <div aria-hidden className="animate-pulse motion-reduce:animate-none rounded-card border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="h-3 w-24 rounded bg-brand-100 dark:bg-slate-700" />
      <div className="mt-4 h-7 w-16 rounded bg-brand-100 dark:bg-slate-700" />
    </div>
  );
}
