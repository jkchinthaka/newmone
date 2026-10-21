import type { ReactNode } from "react";

import { cn } from "./cn";

export function SectionCard({
  title,
  action,
  children,
  className
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-card border border-slate-200 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-900", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
