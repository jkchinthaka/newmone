import {
  buildLocationPath,
  formatLocationPathLabel,
  normalizeLocationCode,
  wouldCreateHierarchyCycle
} from "../src/modules/organization/location-hierarchy";

describe("location hierarchy integrity", () => {
  it("normalizes location codes", () => {
    expect(normalizeLocationCode(" fac 01 ")).toBe("FAC-01");
  });

  it("blocks self-parenting", () => {
    expect(
      wouldCreateHierarchyCycle({
        locationId: "a",
        newParentId: "a",
        parentById: new Map([["a", null]])
      })
    ).toBe(true);
  });

  it("blocks descendant cycles", () => {
    const parentById = new Map<string, string | null>([
      ["building", null],
      ["floor", "building"],
      ["room", "floor"]
    ]);

    expect(
      wouldCreateHierarchyCycle({
        locationId: "building",
        newParentId: "room",
        parentById
      })
    ).toBe(true);

    expect(
      wouldCreateHierarchyCycle({
        locationId: "room",
        newParentId: "building",
        parentById
      })
    ).toBe(false);
  });

  it("builds breadcrumb paths from parent links", () => {
    const byId = new Map([
      ["b", { id: "b", code: "B1", name: "Building", type: "BUILDING", parentId: null }],
      ["f", { id: "f", code: "F1", name: "Floor", type: "FLOOR", parentId: "b" }],
      ["r", { id: "r", code: "R1", name: "Room", type: "ROOM", parentId: "f" }]
    ]);
    const path = buildLocationPath("r", byId);
    expect(path.map((n: { name: string }) => n.name)).toEqual(["Building", "Floor", "Room"]);
    expect(formatLocationPathLabel(path)).toBe("Building / Floor / Room");
  });
});
