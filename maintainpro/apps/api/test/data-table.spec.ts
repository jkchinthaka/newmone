import {
  filterRowsBySearch,
  getPaginationMeta,
  paginateRows,
  sortRows,
  toggleSortDirection
} from "../../web/lib/client-table";

type SampleRow = {
  id: string;
  name: string;
  category: string;
  amount: number;
};

const SAMPLE_ROWS: SampleRow[] = [
  { id: "1", name: "Pump Seal", category: "Mechanical", amount: 42 },
  { id: "2", name: "Filter Kit", category: "Filters", amount: 18 },
  { id: "3", name: "Belt Drive", category: "Mechanical", amount: 75 }
];

describe("client-table helpers", () => {
  it("filters rows by search query", () => {
    const filtered = filterRowsBySearch(SAMPLE_ROWS, "filter", (row) =>
      `${row.name} ${row.category}`.toLowerCase()
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe("Filter Kit");
  });

  it("returns all rows when search query is empty", () => {
    expect(filterRowsBySearch(SAMPLE_ROWS, "   ", (row) => row.name)).toHaveLength(3);
  });

  it("sorts rows ascending and descending", () => {
    const asc = sortRows(SAMPLE_ROWS, "amount", "asc", (row, key) =>
      key === "amount" ? row.amount : row.name
    );
    const desc = sortRows(SAMPLE_ROWS, "amount", "desc", (row, key) =>
      key === "amount" ? row.amount : row.name
    );

    expect(asc.map((row) => row.amount)).toEqual([18, 42, 75]);
    expect(desc.map((row) => row.amount)).toEqual([75, 42, 18]);
  });

  it("paginates rows without changing total count metadata", () => {
    const pageOne = paginateRows(SAMPLE_ROWS, 1, 2);
    const pageTwo = paginateRows(SAMPLE_ROWS, 2, 2);
    const meta = getPaginationMeta(SAMPLE_ROWS.length, 2, 2);

    expect(pageOne).toHaveLength(2);
    expect(pageTwo).toHaveLength(1);
    expect(meta.totalPages).toBe(2);
    expect(meta.start).toBe(3);
    expect(meta.end).toBe(3);
  });

  it("toggles sort direction for the same column", () => {
    expect(toggleSortDirection("amount", "amount", "asc")).toBe("desc");
    expect(toggleSortDirection("name", "amount", "desc")).toBe("asc");
  });

  it("handles empty row sets safely", () => {
    expect(filterRowsBySearch([], "test", () => "")).toEqual([]);
    expect(sortRows([], "amount", "asc", () => 0)).toEqual([]);
    expect(paginateRows([], 1, 10)).toEqual([]);
    expect(getPaginationMeta(0, 1, 10)).toMatchObject({ totalPages: 1, start: 0, end: 0 });
  });
});
