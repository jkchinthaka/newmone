import { Suspense } from "react";

import { QrIssueReportPage } from "@/components/qr/qr-issue-report-page";
import { InlineLoadingState } from "@/components/ui/page-state";

export default function QrReportIssueRoutePage() {
  return (
    <Suspense fallback={<InlineLoadingState label="Loading QR issue report…" />}>
      <QrIssueReportPage />
    </Suspense>
  );
}
