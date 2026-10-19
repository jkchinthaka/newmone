import { isUpstreamUnavailableError } from "@/lib/upstream-status";

export const JOB_CHANGED_MESSAGE = "This job was changed by someone else — refreshed";

export type JobActionOutcome = "conflict" | "unavailable" | "error";

/** 409 = someone else changed the job; refetch and stay. Unreachable server = offer Retry. */
export function classifyJobActionError(error: unknown): JobActionOutcome {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 409) return "conflict";
  if (isUpstreamUnavailableError(error)) return "unavailable";
  return "error";
}
