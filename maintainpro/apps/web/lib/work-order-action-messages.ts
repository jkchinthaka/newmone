const RULES: Array<[RegExp, string]> = [
  [/approve this work order before assigning/i, "Approve this job before assigning a technician."],
  [/can only be assigned from planned/i, "Plan this job, or approve it, before assigning a technician."],
  [/requires manager approval before execution/i, "Approve this job before starting the job."],
  [/only technician-completed work orders can be supervisor verified/i, "The technician must finish the job before you can verify it."],
  [/supervisor verification requires manager or admin/i, "Only a manager or admin can verify this job."],
  [/completing technician cannot verify/i, "You cannot verify a job you completed."],
  [/before photo|after photo|missing evidence|evidence required/i, "Add the before and after photos before this step."],
  [/expectedVersion is required|updated by someone else/i, "This job changed. Refresh and try again."]
];

export function humanWorkOrderActionMessage(message: string): string {
  const text = message.trim();
  if (!text) return "Something went wrong. Please try again.";
  for (const [pattern, plain] of RULES) {
    if (pattern.test(text)) return plain;
  }
  return text;
}
