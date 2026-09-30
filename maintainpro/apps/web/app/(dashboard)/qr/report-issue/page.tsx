import { redirect } from "next/navigation";

import { buildQrReportIssueRedirect } from "@/lib/qr-report-redirect";

/**
 * Legacy facility QR report entry — Phase 5 canonical reporting is /requests/new.
 * Only internal asset/vehicle/location context is forwarded. Redirect parameters are dropped.
 */
export default function QrReportIssueRedirectPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  redirect(buildQrReportIssueRedirect(searchParams));
}
