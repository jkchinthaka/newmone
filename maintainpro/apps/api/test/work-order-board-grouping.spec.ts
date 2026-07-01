import {
  groupWorkOrdersByBoardTab,
  isWorkOrderInProgressTabStatus,
  isWorkOrderOpenTabStatus
} from "../src/common/utils/work-order-board-tabs";

describe("Work order board tab grouping", () => {
  it("treats only OPEN as open-tab status", () => {
    expect(isWorkOrderOpenTabStatus("OPEN")).toBe(true);
    expect(isWorkOrderOpenTabStatus("IN_PROGRESS")).toBe(false);
    expect(isWorkOrderOpenTabStatus("ON_HOLD")).toBe(false);
    expect(isWorkOrderOpenTabStatus("COMPLETED")).toBe(false);
  });

  it("treats IN_PROGRESS, ON_HOLD, TECHNICIAN_COMPLETED, and REWORK_REQUIRED as in-progress tab statuses", () => {
    expect(isWorkOrderInProgressTabStatus("IN_PROGRESS")).toBe(true);
    expect(isWorkOrderInProgressTabStatus("ON_HOLD")).toBe(true);
    expect(isWorkOrderInProgressTabStatus("TECHNICIAN_COMPLETED")).toBe(true);
    expect(isWorkOrderInProgressTabStatus("REWORK_REQUIRED")).toBe(true);
    expect(isWorkOrderInProgressTabStatus("OPEN")).toBe(false);
  });

  it("moves started work orders out of the open tab and into in progress", () => {
    const rows = [
      { id: "wo-open", status: "OPEN" },
      { id: "wo-started", status: "IN_PROGRESS" }
    ];

    const grouped = groupWorkOrdersByBoardTab(rows);

    expect(grouped.open.map((row) => row.id)).toEqual(["wo-open"]);
    expect(grouped.inProgress.map((row) => row.id)).toEqual(["wo-started"]);
    expect(grouped.open.some((row) => row.id === "wo-started")).toBe(false);
    expect(grouped.inProgress.some((row) => row.id === "wo-started")).toBe(true);
  });
});
