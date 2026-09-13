import { redirect } from "next/navigation";

/**
 * Phase 1: Workspace consolidated into role-aware Home (`/action-center`).
 * Underlying Action Center widgets remain the Home implementation.
 */
export default function WorkspaceRedirectPage() {
  redirect("/action-center");
}
