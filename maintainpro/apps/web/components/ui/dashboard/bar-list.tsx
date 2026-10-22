import React from "react";
import Link from "next/link";

export function BarList({
  items
}: {
  items: Array<{ name: string; value: number; href?: string; ariaLabel?: string }>;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const body = (
          <>
            <div className="mb-1 flex justify-between text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">{item.name}</span>
              <span className="tabular-nums">{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.round((item.value / max) * 100)}%` }} />
            </div>
          </>
        );
        return (
          <li key={item.name}>
            {item.href ? (
              <Link
                href={item.href as never}
                aria-label={item.ariaLabel}
                className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
