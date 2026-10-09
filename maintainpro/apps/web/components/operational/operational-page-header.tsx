import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** Compact header for operational lists. Controls sit on the same row as the title. */
export function OperationalPageHeader({ eyebrow = "Maintenance", title, description, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-800">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-brand-800">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
