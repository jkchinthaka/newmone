import {
  getAccessibleLabel,
  joinAriaDescribedBy,
  toAriaExpanded,
  toBreadcrumbAriaCurrent,
  toNavAriaCurrent,
  toSortAriaSort
} from "../../web/lib/accessibility";

describe("accessibility helpers", () => {
  it("maps navigation active state to aria-current page", () => {
    expect(toNavAriaCurrent(true)).toBe("page");
    expect(toNavAriaCurrent(false)).toBeUndefined();
  });

  it("maps mobile menu open state to aria-expanded", () => {
    expect(toAriaExpanded(true)).toBe("true");
    expect(toAriaExpanded(false)).toBe("false");
  });

  it("maps breadcrumb last item to aria-current page", () => {
    expect(toBreadcrumbAriaCurrent(true)).toBe("page");
    expect(toBreadcrumbAriaCurrent(false)).toBeUndefined();
  });

  it("maps sort direction to aria-sort values", () => {
    expect(toSortAriaSort(false, "asc")).toBe("none");
    expect(toSortAriaSort(true, "asc")).toBe("ascending");
    expect(toSortAriaSort(true, "desc")).toBe("descending");
  });

  it("provides full accessible labels when visible text is truncated", () => {
    const full = "Asset registry export for northern region maintenance team";
    const visible = `${full.slice(0, 47)}…`;

    expect(getAccessibleLabel(visible, full)).toBe(full);
    expect(getAccessibleLabel("Dashboard", "Dashboard")).toBeUndefined();
  });

  it("joins aria-describedby ids safely", () => {
    expect(joinAriaDescribedBy("desc-1", undefined, "error-1")).toBe("desc-1 error-1");
    expect(joinAriaDescribedBy(undefined, "")).toBeUndefined();
  });
});
