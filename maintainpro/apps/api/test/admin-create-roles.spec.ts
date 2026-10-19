import "reflect-metadata";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { AssetsController } from "../src/modules/assets/assets.controller";
import { AssetTagImportController } from "../src/modules/assets/asset-tag-import.controller";
import { UtilitiesController } from "../src/modules/utilities/utilities.controller";
import { VehiclesController } from "../src/modules/vehicles/vehicles.controller";

function roles(method: object) {
  return Reflect.getMetadata(ROLES_KEY, method) as string[] | undefined;
}

describe("admin creation role locks", () => {
  it("limits new asset and vehicle creation to super admins and admins", () => {
    expect(roles(AssetsController.prototype.create)).toEqual(["SUPER_ADMIN", "ADMIN"]);
    expect(roles(AssetsController.prototype.bulkImport)).toEqual(["SUPER_ADMIN", "ADMIN"]);
    expect(roles(VehiclesController.prototype.create)).toEqual(["SUPER_ADMIN", "ADMIN"]);
    expect(Reflect.getMetadata(ROLES_KEY, AssetTagImportController)).toEqual(["SUPER_ADMIN", "ADMIN"]);
  });

  it("lets field technicians record readings without meter administration", () => {
    expect(roles(UtilitiesController.prototype.addReading)).toEqual(expect.arrayContaining(["TECHNICIAN", "MECHANIC"]));
    expect(roles(UtilitiesController.prototype.createMeter)).not.toEqual(expect.arrayContaining(["TECHNICIAN"]));
  });
});
