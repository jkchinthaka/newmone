/** Same rules as packages/shared-types/src/work-order-schedule.ts. Keep the messages identical. */
export const EXPECTED_COMPLETION_AFTER_DUE = "Expected completion cannot be after the due date";

export function utcCalendarDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function expectedCompletionIsAfterDue(due: Date, expected: Date): boolean {
  return due.getTime() < expected.getTime();
}

export function scheduleOrderMessage(laterLabel: string, earlierLabel: string): string {
  if (laterLabel === "Due date" && earlierLabel === "expected completion") {
    return EXPECTED_COMPLETION_AFTER_DUE;
  }
  return `${laterLabel} must not be earlier than ${earlierLabel}`;
}

export function schedulePastMessage(label: string): string {
  return `${label} cannot be in the past`;
}

export function createScheduleIssues(input: {
  dueDate?: string;
  expectedCompletionDate?: string;
  today: string;
}): { dueDate?: string; expectedCompletionDate?: string } {
  const issues: { dueDate?: string; expectedCompletionDate?: string } = {};
  if (input.dueDate && input.dueDate < input.today) {
    issues.dueDate = schedulePastMessage("Due date");
  }
  if (input.expectedCompletionDate && input.expectedCompletionDate < input.today) {
    issues.expectedCompletionDate = schedulePastMessage("Expected completion");
  }
  if (
    !issues.dueDate &&
    !issues.expectedCompletionDate &&
    input.dueDate &&
    input.expectedCompletionDate &&
    input.expectedCompletionDate > input.dueDate
  ) {
    issues.expectedCompletionDate = EXPECTED_COMPLETION_AFTER_DUE;
  }
  return issues;
}
