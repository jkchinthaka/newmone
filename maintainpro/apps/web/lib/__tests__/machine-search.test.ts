import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MACHINE_SEARCH_DEBOUNCE_MS,
  isCurrentMachineSearch,
  isCurrentSearch,
  machineForPrefill,
  machineQueryRepresentsSelection,
  normalizeMachineQuery,
  readMachineHits,
  shouldSearchMachines
} from "../machine-search";

describe("machine search", () => {
  it("debounces live search and starts after the first character", () => {
    assert.equal(MACHINE_SEARCH_DEBOUNCE_MS >= 250 && MACHINE_SEARCH_DEBOUNCE_MS <= 350, true);
    assert.equal(shouldSearchMachines(""), false);
    assert.equal(shouldSearchMachines("   "), false);
    assert.equal(shouldSearchMachines(" A "), true);
    assert.equal(normalizeMachineQuery("  SN-2026-00458  "), "SN-2026-00458");
  });

  it("ignores stale responses from rapid typing", () => {
    assert.equal(isCurrentMachineSearch(1, 3), false);
    assert.equal(isCurrentMachineSearch(3, 3), true);
    assert.equal(isCurrentSearch(2, 4), false);
    assert.equal(isCurrentSearch(4, 4), true);
  });

  it("clears a selection when the text no longer matches it", () => {
    assert.equal(machineQueryRepresentsSelection("AST-00254", "AST-00254"), true);
    assert.equal(machineQueryRepresentsSelection(" AST-00254 ", "AST-00254"), true);
    assert.equal(machineQueryRepresentsSelection("AST-002", "AST-00254"), false);
    assert.equal(machineQueryRepresentsSelection("", "AST-00254"), false);
  });

  it("reads lookup rows and does not auto-select a typed serial", () => {
    const hits = readMachineHits({
      data: [
        {
          id: "asset-1",
          assetTag: "AST-00254",
          name: "Industrial Water Pump",
          serialNumber: "SN-2026-00458"
        }
      ]
    });
    assert.equal(hits.length, 1);
    assert.equal(machineForPrefill(hits, "SN-2026-00458", false), null);
    assert.equal(machineForPrefill(hits, "AST-00254")?.id, "asset-1");
    assert.equal(machineForPrefill(hits, "SN-2026-00458", true)?.id, "asset-1");
    assert.equal(machineForPrefill(hits, "asset-1")?.name, "Industrial Water Pump");
  });

  it("does not treat an error payload as zero matches", () => {
    assert.deepEqual(readMachineHits({ message: "Forbidden" }), []);
    assert.deepEqual(readMachineHits(null), []);
  });
});
