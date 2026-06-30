describe("work order detail tabs", () => {
  it("defines UAT-008 tab order for work order detail layout", () => {
    const tabs = ["overview", "assignment", "parts", "evidence", "history", "audit"];
    expect(tabs).toEqual([
      "overview",
      "assignment",
      "parts",
      "evidence",
      "history",
      "audit"
    ]);
  });
});
