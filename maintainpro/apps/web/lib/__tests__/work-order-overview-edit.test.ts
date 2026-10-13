import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { overviewDraftDirty, overviewSaveDecision } from "../work-order-overview-edit";

const draft = {
  title: "Belt",
  description: "Replace belt",
  dueDate: "2026-10-01",
  expectedCompletionDate: "2026-10-01",
  estimatedCost: "10",
  estimatedHours: "2"
};

describe("work order overview editing", () => {
  it("keeps save hidden until the user edits overview", () => {
    const decision = overviewSaveDecision({
      mode: "view",
      tab: "overview",
      dirty: false,
      title: draft.title,
      description: draft.description,
      submitting: false
    });
    assert.equal(decision.showSave, false);
  });

  it("enables save only for a valid change", () => {
    assert.equal(overviewDraftDirty({ ...draft, title: "Belt alignment" }, draft), true);
    const ready = overviewSaveDecision({
      mode: "edit",
      tab: "overview",
      dirty: true,
      title: "Belt alignment",
      description: draft.description,
      submitting: false
    });
    assert.equal(ready.enabled, true);
    const unchanged = overviewSaveDecision({
      mode: "edit",
      tab: "overview",
      dirty: false,
      title: draft.title,
      description: draft.description,
      submitting: false
    });
    assert.equal(unchanged.enabled, false);
    assert.match(unchanged.reason ?? "", /No changes/);
  });

  it("does not offer overview save from another section", () => {
    const decision = overviewSaveDecision({
      mode: "edit",
      tab: "assignment",
      dirty: true,
      title: draft.title,
      description: draft.description,
      submitting: false
    });
    assert.equal(decision.showSave, false);
    assert.match(decision.reason ?? "", /own changes/);
  });
});
