"use client";

import Link from "next/link";
import type { Route } from "next";
import { ChevronRight } from "lucide-react";

import { truncateBreadcrumbLabel, type BreadcrumbItem } from "@/lib/breadcrumbs";

export type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={`max-w-full ${className}`.trim()}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-slate-500 sm:text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const label = truncateBreadcrumbLabel(item.label);

          return (
            <li key={`${item.label}-${index}`} className="inline-flex min-w-0 max-w-full items-center gap-1">
              {index > 0 ? (
                <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              ) : null}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="truncate font-medium text-slate-800"
                  title={item.label}
                >
                  {label}
                </span>
              ) : (
                <Link
                  href={item.href as Route}
                  className="truncate rounded-sm text-slate-600 transition hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  title={item.label}
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
