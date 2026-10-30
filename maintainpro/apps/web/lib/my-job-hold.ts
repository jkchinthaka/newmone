/**
 * My Jobs "Hold" choices. Codes are the API's HOLD_REASON_CODES
 * (apps/api/src/modules/work-orders/work-order-lifecycle.ts). The API always needs a
 * hold note of at least 3 characters (assertReasonProvided "Hold reason").
 */
export const MY_JOB_HOLD_CHOICES = [
  { code: "WAITING_PARTS", label: "Waiting for parts" },
  { code: "WAITING_APPROVAL", label: "Waiting for approval" },
  { code: "OTHER", label: "Other" }
] as const;

export type MyJobHoldCode = (typeof MY_JOB_HOLD_CHOICES)[number]["code"];

export const HOLD_NOTE_MIN_LENGTH = 3;

export function validateHoldNote(note: string): string | null {
  const trimmed = note.trim();
  if (!trimmed) return "Write a short note.";
  if (trimmed.length < HOLD_NOTE_MIN_LENGTH) return `Write at least ${HOLD_NOTE_MIN_LENGTH} letters.`;
  return null;
}

export function buildHoldPayload(code: MyJobHoldCode, note: string, expectedVersion: number) {
  return {
    holdReasonCode: code,
    delayReason: note.trim(),
    expectedVersion
  };
}

/** "Sent back: <reason>" for a rework job, or null when there is nothing to show. */
export function sentBackLabel(job: { status: string; verificationRejectionReason?: string | null }): string | null {
  if (job.status !== "REWORK_REQUIRED") return null;
  const reason = job.verificationRejectionReason?.trim();
  return reason ? `Sent back: ${reason}` : "Sent back by supervisor. Open the job to see why.";
}
