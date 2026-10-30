import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { moveTargets, placesRowsFromSheet } from "../places-import";

describe("sites and locations Excel", () => {
  it("reads template and common column names and keeps Excel row numbers", () => {
    const parsed = placesRowsFromSheet([
      ["Site code *", "Site name *", "Site type", "Location code", "Location name", "Location type", "Parent location code"],
      ["MP", "Main Plant", "Factory", "BH-01", "Boiler house", "Building", ""],
      ["", "", "", "", "", "", ""],
      ["MP", "Main Plant", "", "BH-01-R1", "Pump room", "Room", "BH-01"]
    ]);
    assert.deepEqual(parsed.missingColumns, []);
    assert.deepEqual(parsed.rows, [
      { row: 2, siteCode: "MP", siteName: "Main Plant", siteType: "Factory", locationCode: "BH-01", locationName: "Boiler house", locationType: "Building" },
      { row: 4, siteCode: "MP", siteName: "Main Plant", locationCode: "BH-01-R1", locationName: "Pump room", locationType: "Room", parentLocationCode: "BH-01" }
    ]);
    assert.deepEqual(placesRowsFromSheet([["Location", "Area code"], ["x", "y"]]).missingColumns, ["Site code", "Site name"]);
  });

  it("offers every other active location as a new parent, never the location itself or anything inside it", () => {
    const node = (id: string, children: unknown[] = [], isActive = true) => ({ id, code: id.toUpperCase(), name: id, type: "AREA" as const, parentId: null, isActive, children: children as never });
    const targets = moveTargets([node("a", [node("a1", [node("a1x")]), node("a2")]), node("b", [], false), node("c")], "a1");
    assert.deepEqual(
      targets.map((target) => [target.id, target.depth]),
      [
        ["a", 0],
        ["a2", 1],
        ["c", 0]
      ]
    );
  });
});
