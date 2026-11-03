import type { WorkOrderEvidenceRequirements } from "./work-order-evidence";
import { isQrVerified } from "./work-order-evidence";

export type CompletionChecklistTab = "evidence" | "parts";

export type CompletionChecklistItem = {
  key: "storage" | "before" | "after" | "rejected" | "qr" | "parts" | "odometer";
  label: string;
  met: boolean;
  /** Plain words: what to do when the line is not met. */
  help: string;
  tab?: CompletionChecklistTab;
};

export type CompletionChecklistInput = {
  requirements: WorkOrderEvidenceRequirements | null;
  partLines: Array<{ issuedQuantity?: number | null }> | null;
  partsSummary: { unaccountedLines?: number | null } | null;
  isVehicle: boolean;
  odometer: string;
};

/**
 * The same checks the API runs on completion (evidence governance, QR, parts reconciliation,
 * vehicle odometer), shown up front so the technician is not told one error at a time.
 */
export function buildCompletionChecklist(input: CompletionChecklistInput): CompletionChecklistItem[] {
  const items: CompletionChecklistItem[] = [];
  const req = input.requirements;

  if (req && req.required && !req.waived) {
    if (req.storageUnavailableBlocking) {
      items.push({
        key: "storage",
        label: "Photo storage",
        met: false,
        help: "Photo storage is off. Ask your administrator."
      });
    } else {
      items.push({
        key: "before",
        label: "Before photo",
        met: req.hasBefore,
        help: "Open the photos tab and add a before photo.",
        tab: "evidence"
      });
      items.push({
        key: "after",
        label: "After photo",
        met: req.hasAfter,
        help: "Open the photos tab and add an after photo.",
        tab: "evidence"
      });
    }
  }

  if (req && req.rejectedCount > 0) {
    items.push({
      key: "rejected",
      label: "No rejected photos",
      met: false,
      help: "A photo was rejected. Ask your supervisor to review it again.",
      tab: "evidence"
    });
  }

  if (req?.qrRequired) {
    items.push({
      key: "qr",
      label: "QR scan",
      met: isQrVerified(req.qrVerificationStatus),
      help: "Open the photos tab and scan the QR tag.",
      tab: "evidence"
    });
  }

  const unaccounted = Number(input.partsSummary?.unaccountedLines ?? 0) || 0;
  const anyIssued = (input.partLines ?? []).some((line) => Number(line.issuedQuantity ?? 0) > 0);
  if (anyIssued || unaccounted > 0) {
    items.push({
      key: "parts",
      label: "Parts balanced",
      met: unaccounted === 0,
      help: "Open the Parts tab. Mark each issued part as used or returned.",
      tab: "parts"
    });
  }

  if (input.isVehicle) {
    const value = input.odometer.trim();
    const parsed = Number(value);
    items.push({
      key: "odometer",
      label: "Odometer",
      met: value !== "" && Number.isFinite(parsed) && parsed >= 0,
      help: "Enter the odometer reading below."
    });
  }

  return items;
}

/** Visible reason under the submit button, or null when everything is done. */
export function completionBlockReason(items: CompletionChecklistItem[]): string | null {
  const unmet = items.filter((item) => !item.met);
  if (unmet.length === 0) return null;
  const first = unmet[0];
  const more = unmet.length > 1 ? ` ${unmet.length - 1} more item${unmet.length === 2 ? "" : "s"} to do in the list above.` : "";
  return `Cannot submit yet. ${first.help}${more}`;
}

/**
 * Typed completion fields kept per work order while the page is open, so closing the
 * modal to add a photo does not wipe the note. Keyed by id; dropped when the job status
 * changes (submitted, sent back) so an old note never reappears on a new round.
 */
const completionDrafts = new Map<string, { status: string; values: Record<string, unknown> }>();

export function saveCompletionDraft(workOrderId: string, status: string, values: Record<string, unknown>) {
  if (!workOrderId) return;
  completionDrafts.set(workOrderId, { status, values: { ...values } });
}

export function readCompletionDraft<T extends Record<string, unknown>>(
  workOrderId: string,
  status: string
): T | null {
  const draft = completionDrafts.get(workOrderId);
  if (!draft) return null;
  if (draft.status !== status) {
    completionDrafts.delete(workOrderId);
    return null;
  }
  return { ...draft.values } as T;
}

export function clearCompletionDraft(workOrderId: string) {
  completionDrafts.delete(workOrderId);
}
