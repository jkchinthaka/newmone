/**
 * "Is it fixed?" step on a reported issue. Shown once the supervisor has checked the job and
 * the reporter (or a reviewer on their behalf) has not answered yet.
 */
export type ConfirmationWorkOrder = {
  status?: string | null;
  requesterConfirmationStatus?: string | null;
  requesterConfirmationOutcome?: string | null;
} | null | undefined;

export function awaitingRequesterConfirmation(workOrder: ConfirmationWorkOrder): boolean {
  return workOrder?.status === "VERIFIED" && workOrder.requesterConfirmationStatus === "PENDING";
}

export function canAnswerConfirmation(input: { workOrder: ConfirmationWorkOrder; isOwner: boolean; canReview: boolean }): boolean {
  return awaitingRequesterConfirmation(input.workOrder) && (input.isOwner || input.canReview);
}

/** Problems that stop sending the answer. "Not fixed" needs a short note for the technician. */
export function confirmationIssues(fixed: boolean, note: string): string | null {
  if (fixed) return null;
  return note.trim().length >= 5 ? null : "Tell the technician what is still wrong (at least 5 characters).";
}

export function confirmationAnsweredLabel(workOrder: ConfirmationWorkOrder): string | null {
  if (workOrder?.requesterConfirmationOutcome === "RESOLVED") return "You confirmed it is fixed.";
  if (workOrder?.requesterConfirmationOutcome === "UNRESOLVED") return "You said it is not fixed. The job went back for more work.";
  return null;
}
