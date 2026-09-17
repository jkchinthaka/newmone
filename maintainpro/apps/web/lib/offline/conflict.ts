/**
 * Offline sync conflict helpers for technician PWA.
 * Safe-merge vs conflict classification — never silently overwrite server state.
 */

export type OfflineConflictClass = "SAFE_MERGE" | "POTENTIAL_CONFLICT" | "CRITICAL";

const SAFE_ACTIONS = new Set(["NOTE_ADD", "PHOTO_ADD", "CHECKLIST_ITEM_SAVE"]);
const CONFLICT_ACTIONS = new Set([
  "WO_STATUS_TRANSITION",
  "METER_READING",
  "ASSIGNMENT_CHANGE",
  "WO_COMPLETE"
]);

export function classifyOfflineAction(actionType: string): OfflineConflictClass {
  if (SAFE_ACTIONS.has(actionType)) return "SAFE_MERGE";
  if (CONFLICT_ACTIONS.has(actionType)) return "POTENTIAL_CONFLICT";
  return "CRITICAL";
}

export type SyncConflict = {
  localActionId: string;
  actionType: string;
  classification: OfflineConflictClass;
  serverUpdatedAt?: string;
  localCreatedAt: string;
  message: string;
};

export function detectConflict(input: {
  actionType: string;
  localCreatedAt: string;
  serverUpdatedAt?: string | null;
}): SyncConflict | null {
  const classification = classifyOfflineAction(input.actionType);
  if (classification === "SAFE_MERGE") return null;
  if (!input.serverUpdatedAt) return null;
  const serverTs = new Date(input.serverUpdatedAt).getTime();
  const localTs = new Date(input.localCreatedAt).getTime();
  if (Number.isNaN(serverTs) || Number.isNaN(localTs)) return null;
  if (serverTs <= localTs) return null;
  return {
    localActionId: "",
    actionType: input.actionType,
    classification,
    serverUpdatedAt: input.serverUpdatedAt,
    localCreatedAt: input.localCreatedAt,
    message:
      classification === "CRITICAL"
        ? "Server changed after your offline edit — confirm before applying"
        : "Potential conflict with newer server state — review before sync"
  };
}
