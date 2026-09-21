import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fitBoundsWhenReady, hasUsableMapContainerSize } from "../leaflet-map-ready";

describe("hasUsableMapContainerSize / fitBoundsWhenReady", () => {
  it("skips fitBounds when the container is 0×0", () => {
    let fitted = false;
    const map = {
      getSize: () => ({ x: 0, y: 0 }),
      getContainer: () => ({ clientWidth: 0, clientHeight: 0 }),
      invalidateSize: () => undefined,
      fitBounds: () => {
        fitted = true;
      }
    };

    assert.equal(hasUsableMapContainerSize(map), false);
    assert.equal(fitBoundsWhenReady(map, [[0, 0], [1, 1]], { padding: [8, 8] }), false);
    assert.equal(fitted, false);
  });

  it("invalidates and fits when size is ready", () => {
    const calls: string[] = [];
    const map = {
      getSize: () => ({ x: 640, y: 480 }),
      invalidateSize: () => {
        calls.push("invalidate");
      },
      fitBounds: () => {
        calls.push("fit");
      }
    };

    assert.equal(hasUsableMapContainerSize(map), true);
    assert.equal(fitBoundsWhenReady(map, [[0, 0], [1, 1]]), true);
    assert.deepEqual(calls, ["invalidate", "fit"]);
  });

  it("rethrows genuine fitBounds errors", () => {
    const map = {
      getSize: () => ({ x: 100, y: 100 }),
      fitBounds: () => {
        throw new Error("invalid LatLng");
      }
    };

    assert.throws(() => fitBoundsWhenReady(map, "bad-bounds"), /invalid LatLng/);
  });
});
