"use client";

import { usePathname } from "next/navigation";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { resolveBreadcrumbItems, type BreadcrumbItem } from "@/lib/breadcrumbs";

export type PageBreadcrumbsProps = {
  items?: BreadcrumbItem[];
  className?: string;
};

export function PageBreadcrumbs({ items, className = "mb-3" }: PageBreadcrumbsProps) {
  const pathname = usePathname();
  const resolved = resolveBreadcrumbItems(pathname, items);

  return <Breadcrumbs className={className} items={resolved} />;
}
