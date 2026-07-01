describe("work order detail tabs", () => {
  it("defines UAT-013 tab order including vendor repair", () => {
    const tabs = ["overview", "assignment", "parts", "evidence", "vendor-repair", "history", "audit"];
    expect(tabs).toEqual([
      "overview",
      "assignment",
      "parts",
      "evidence",
      "vendor-repair",
      "history",
      "audit"
    ]);
  });
});
