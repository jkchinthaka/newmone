import React, { type ReactNode } from "react";

import { cn } from "./cn";

export function PageShell({
  title,
  subtitle,
  actions,
  filters,
  children,
  className
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-700">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      {children}
    </div>
  );
}
