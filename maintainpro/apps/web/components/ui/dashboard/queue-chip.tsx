import type { ReactNode } from "react";

import { cn } from "./cn";

export function QueueChip({
  children,
  active = false,
  className
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium",
        active
          ? "border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-900 dark:text-brand-50"
          : "border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200",
        className
      )}
    >
      {children}
    </span>
  );
}
