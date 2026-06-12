import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { toSafeDisplayMessage } from "@/lib/safe-display-message";

export function showActionSuccess(message: string) {
  toast.success(toSafeDisplayMessage(message, "Action completed successfully."));
}

export function showActionError(error: unknown, fallback: string) {
  toast.error(getApiErrorMessage(error, fallback));
}
