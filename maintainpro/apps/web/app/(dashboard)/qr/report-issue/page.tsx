import { redirect } from "next/navigation";

/**
 * Legacy facility QR report entry — Phase 5 canonical reporting is /requests/new.
 * Preserve deep-link query so assetTag / assetId / qr scanners keep working.
 */
export default function QrReportIssueRedirectPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === "string" && value) qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  redirect(`/requests/new${suffix}`);
}
