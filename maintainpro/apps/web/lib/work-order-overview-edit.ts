export type OverviewDraft = {
  title: string;
  description: string;
  dueDate: string;
  expectedCompletionDate: string;
  estimatedCost: string;
  estimatedHours: string;
};

export type OverviewSaveDecision = {
  showSave: boolean;
  enabled: boolean;
  label: string;
  reason: string | null;
};

export function overviewDraftDirty(current: OverviewDraft, baseline: OverviewDraft): boolean {
  return (Object.keys(baseline) as Array<keyof OverviewDraft>).some((key) => current[key] !== baseline[key]);
}

/** Overview save is separate from assignment, parts, and the other section actions. */
export function overviewSaveDecision(input: {
  mode: "create" | "view" | "edit";
  tab: string;
  dirty: boolean;
  title: string;
  description: string;
  submitting: boolean;
}): OverviewSaveDecision {
  if (input.mode === "create") {
    const ready = input.title.trim().length > 0 && input.description.trim().length > 0;
    return {
      showSave: true,
      enabled: ready && !input.submitting,
      label: input.submitting ? "Creating..." : "Create",
      reason: ready ? null : "Title and description are required."
    };
  }

  if (input.tab !== "overview") {
    return {
      showSave: false,
      enabled: false,
      label: "Save changes",
      reason: "This section saves its own changes. Overview is not saved from here."
    };
  }

  if (input.mode !== "edit") {
    return { showSave: false, enabled: false, label: "Save changes", reason: null };
  }

  if (input.submitting) {
    return { showSave: true, enabled: false, label: "Saving...", reason: null };
  }

  if (!input.dirty) {
    return { showSave: true, enabled: false, label: "Save changes", reason: "No changes to save." };
  }

  if (!input.title.trim() || !input.description.trim()) {
    return { showSave: true, enabled: false, label: "Save changes", reason: "Title and description are required." };
  }

  return { showSave: true, enabled: true, label: "Save changes", reason: null };
}
