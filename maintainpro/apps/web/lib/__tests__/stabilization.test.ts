import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requestMenuPosition } from "../request-row-menu";
import { designationChoices, employeesMatchingDesignation } from "../workforce-designations";

describe("request row menu", () => {
  it("does not place a menu for a hidden zero-size trigger", () => {
    assert.equal(requestMenuPosition({ width: 0, height: 0, bottom: 0, right: 0 }, 1440), null);
    assert.equal(requestMenuPosition(null, 1440), null);
  });

  it("anchors a visible trigger away from the top-left corner", () => {
    const position = requestMenuPosition({ width: 44, height: 44, bottom: 320, right: 900 }, 1440);
    assert.equal(position?.top, 324);
    assert.equal(position?.left, 660);
  });
});

describe("workforce designation filter", () => {
  const employees = [
    { id: "1", designation: "Technician" },
    { id: "2", designation: "ELECTRICIAN" },
    { id: "3", designation: null }
  ];

  it("loads choices from employee records", () => {
    assert.deepEqual(designationChoices(employees), ["ELECTRICIAN", "TECHNICIAN"]);
    assert.deepEqual(designationChoices([]), []);
  });

  it("filters staff and restores the list when cleared", () => {
    assert.deepEqual(employeesMatchingDesignation(employees, "technician").map((item) => item.id), ["1"]);
    assert.equal(employeesMatchingDesignation(employees, "").length, 3);
  });
});
