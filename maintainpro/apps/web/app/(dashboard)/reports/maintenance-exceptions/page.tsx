import { Suspense } from "react";

import { MaintenanceExceptionsPage } from "@/components/reports/maintenance-exceptions-page";

export default function MaintenanceExceptionsReportPage() {
  // useSearchParams (?type=) needs a Suspense boundary for static rendering.
  return (
    <Suspense fallback={null}>
      <MaintenanceExceptionsPage />
    </Suspense>
  );
}
