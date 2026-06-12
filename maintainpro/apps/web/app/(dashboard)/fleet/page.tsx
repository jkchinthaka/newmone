import dynamic from "next/dynamic";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

const FleetMap = dynamic(() => import("@/components/charts/fleet-map").then((mod) => mod.FleetMap), {
  ssr: false
});

export default function FleetPage() {
  return (
    <div className="space-y-3">
      <PageBreadcrumbs />
      <div className="-mx-4 -mb-4 sm:-mx-6 sm:-mb-6">
        <FleetMap />
      </div>
    </div>
  );
}
