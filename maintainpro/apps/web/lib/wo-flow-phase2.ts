export type FlowStepResult =
  | { ok: true }
  | { ok: false; stage: "approve" | "verify"; error: unknown }
  | { ok: false; stage: "assign" | "close"; error: unknown; kept: true };

/** Approve, then assign. A failed assign leaves the work order approved. */
export async function approveThenAssign<T>(actions: {
  approve: () => Promise<T>;
  assign: (approved: T) => Promise<unknown>;
}): Promise<FlowStepResult> {
  let approved: T;
  try {
    approved = await actions.approve();
  } catch (error) {
    return { ok: false, stage: "approve", error };
  }
  try {
    await actions.assign(approved);
  } catch (error) {
    return { ok: false, stage: "assign", error, kept: true };
  }
  return { ok: true };
}

/** Verify, then close. Send back stays a separate call. A failed close leaves the work order verified. */
export async function verifyThenClose<T>(actions: {
  verify: () => Promise<T>;
  close: (verified: T) => Promise<unknown>;
}): Promise<FlowStepResult> {
  let verified: T;
  try {
    verified = await actions.verify();
  } catch (error) {
    return { ok: false, stage: "verify", error };
  }
  try {
    await actions.close(verified);
  } catch (error) {
    return { ok: false, stage: "close", error, kept: true };
  }
  return { ok: true };
}
