"use client";

import { Suspense } from "react";

import { FleetWorkspace } from "@/components/fleet/fleet-workspace";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

export default function FleetPage() {
  return (
    <div className="ops-page">
      <PageBreadcrumbs />
      <Suspense fallback={<p className="text-sm text-slate-500">Loading fleet…</p>}>
        <FleetWorkspace />
      </Suspense>
    </div>
  );
}
