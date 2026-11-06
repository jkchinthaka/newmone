import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canManageJobTasks, formatTaskTime, taskProgressLabel } from "../work-order-tasks";

describe("work-order-tasks helpers", () => {
  it("formats time", () => {
    assert.equal(formatTaskTime(null), "—");
    assert.equal(formatTaskTime(45), "45 min");
    assert.equal(formatTaskTime(60), "1 h");
    assert.equal(formatTaskTime(135), "2 h 15 min");
  });
  it("progress label", () => {
    assert.equal(taskProgressLabel({ done: 0, total: 0 }), "No tasks");
    assert.equal(taskProgressLabel({ done: 2, total: 4 }), "2/4 done");
  });
  it("manager roles", () => {
    assert.equal(canManageJobTasks("MANAGER"), true);
    assert.equal(canManageJobTasks("TECHNICIAN"), false);
    assert.equal(canManageJobTasks(undefined), false);
  });
});
