import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createFormTitle,
  primaryCreateFields,
  resolveCreateJobDomain,
  suggestWorkOrderTitle
} from "../work-order-create-hci";

describe("work-order-create-hci domain correctness", () => {
  it("stamps MACHINERY even when no asset/vehicle is selected", () => {
    assert.equal(
      resolveCreateJobDomain({
        explicitJobDomain: "MACHINERY",
        assetId: null,
        vehicleId: null
      }),
      "MACHINERY"
    );
  });

  it("stamps SERVICE and VEHICLE explicitly", () => {
    assert.equal(resolveCreateJobDomain({ explicitJobDomain: "SERVICE" }), "SERVICE");
    assert.equal(resolveCreateJobDomain({ explicitJobDomain: "VEHICLE" }), "VEHICLE");
  });

  it("hides cross-domain fields on primary surfaces", () => {
    assert.equal(primaryCreateFields("MACHINERY").showVehicle, false);
    assert.equal(primaryCreateFields("MACHINERY").showAsset, true);
    assert.equal(primaryCreateFields("VEHICLE").showAsset, false);
    assert.equal(primaryCreateFields("VEHICLE").showVehicle, true);
    assert.equal(primaryCreateFields("SERVICE").showVehicle, false);
    assert.equal(primaryCreateFields("SERVICE").showAsset, false);
    assert.equal(primaryCreateFields("SERVICE").showLocation, true);
  });

  it("builds domain-specific modal titles", () => {
    assert.equal(createFormTitle("MACHINERY"), "Create Machinery Work Order");
    assert.equal(createFormTitle("VEHICLE"), "Create Vehicle Work Order");
    assert.equal(createFormTitle("SERVICE"), "Create Service Work Order");
  });

  it("suggests titles from description without inventing entity names", () => {
    const withEntity = suggestWorkOrderTitle({
      description: "bearing making loud noise",
      entityLabel: "Packing Machine 03"
    });
    assert.equal(withEntity, "Packing Machine 03 — bearing making loud noise");
    assert.equal(
      suggestWorkOrderTitle({ description: "Brake noise on morning route" }),
      "Brake noise on morning route"
    );
  });
});
