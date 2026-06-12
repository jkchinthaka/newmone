import type { ReactNode } from "react";

type DashboardSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DashboardSection({
  title,
  description,
  action,
  children,
  className = ""
}: DashboardSectionProps) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`.trim()}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
