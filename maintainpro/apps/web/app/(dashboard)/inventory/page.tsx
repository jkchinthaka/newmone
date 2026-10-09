"use client";

import { Suspense } from "react";

import { InventoryControlPage } from "@/components/inventory/inventory-control-page";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

export default function InventoryPage() {
  return (
    <div className="ops-page">
      <PageBreadcrumbs />
      <Suspense fallback={<p className="text-sm text-slate-500">Loading inventory…</p>}>
        <InventoryControlPage />
      </Suspense>
    </div>
  );
}
