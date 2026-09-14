import type { ReactNode } from "react";

export type MobileRecordField = {
  label: string;
  value: ReactNode;
};

type MobileRecordCardProps = {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  fields: readonly MobileRecordField[];
  actions?: ReactNode;
};

/**
 * Card representation for wide operational rows on narrow screens.
 * Prefer this over squeezing dense desktop tables onto phones.
 */
export function MobileRecordCard({ title, subtitle, badge, fields, actions }: MobileRecordCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-brand-700">{title}</p>
          {subtitle ? <p className="mt-1 font-medium text-slate-900">{subtitle}</p> : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      {fields.length > 0 ? (
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="text-xs text-slate-500">{field.label}</dt>
              <dd className="break-words font-medium text-slate-800">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actions ? <div className="mt-4 flex flex-col gap-2">{actions}</div> : null}
    </article>
  );
}

type ResponsiveDataListProps = {
  children: ReactNode;
  className?: string;
};

/** Wrapper for mobile-only card lists paired with desktop tables. */
export function ResponsiveDataList({ children, className }: ResponsiveDataListProps) {
  return <div className={className ?? "space-y-3 p-3 md:hidden"}>{children}</div>;
}
