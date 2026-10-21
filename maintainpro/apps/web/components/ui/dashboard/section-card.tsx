import React, { type ReactNode } from "react";

import { cn } from "./cn";

export function SectionCard({
  title,
  description,
  action,
  children,
  className
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-card border border-slate-200 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-900", className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
