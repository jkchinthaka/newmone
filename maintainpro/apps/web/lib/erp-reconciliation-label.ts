/** Pending outbox is not an ERP post. */
export function erpReconciliationLabel(status: string | null | undefined) {
  const normalized = (status ?? "PENDING").trim().toUpperCase();
  if (normalized === "POSTED" || normalized === "PROCESSED" || normalized === "ACKNOWLEDGED") {
    return "ERP posted";
  }
  return "ERP reconciliation pending";
}
