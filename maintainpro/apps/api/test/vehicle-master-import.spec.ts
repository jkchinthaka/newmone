import { FuelType, VehicleStatus, VehicleType } from "@prisma/client";

import { normalizeRegistrationNo, registrationSearchPattern } from "../src/common/utils/vehicle-registration";
import {
  evaluateVehicleEligibilityForNewFgRecord,
  fgFormAllowedVehicleTypes
} from "../src/modules/vehicles/vehicle-eligibility";
import {
  mapFuelTypeSafe,
  mapStatusSafe,
  mapVehicleMasterRow,
  mapVehicleTypeSafe
} from "../src/modules/vehicles/vehicle-master-import";

describe("vehicle registration normalize", () => {
  it("normalizes display variants to the same search key", () => {
    expect(normalizeRegistrationNo("WP-BFJ-9183")).toBe("WPBFJ9183");
    expect(normalizeRegistrationNo("WP BFJ 9183")).toBe("WPBFJ9183");
    expect(normalizeRegistrationNo("wpbfj9183")).toBe("WPBFJ9183");
  });

  it("builds a flexible registration search pattern", () => {
    const pattern = registrationSearchPattern("WP B");
    expect(pattern).toContain("W");
    expect(pattern).toContain("P");
    expect(pattern).toContain("B");
  });
});

describe("vehicle master import mapping", () => {
  it("does not map Inactive to AVAILABLE", () => {
    expect(mapStatusSafe("Inactive").status).toBe(VehicleStatus.OUT_OF_SERVICE);
    expect(mapStatusSafe("Available").status).toBe(VehicleStatus.AVAILABLE);
    expect(mapStatusSafe("In Use").status).toBe(VehicleStatus.IN_USE);
    expect(mapStatusSafe("Disposed").status).toBe(VehicleStatus.DISPOSED);
  });

  it("does not invent DIESEL for unknown fuel", () => {
    const blank = mapFuelTypeSafe("");
    expect(blank.fuelType).toBe(FuelType.UNKNOWN);
    expect(blank.warning?.code).toBe("UNKNOWN_FUEL");
    expect(mapFuelTypeSafe("PETROL").fuelType).toBe(FuelType.PETROL);
    expect(mapFuelTypeSafe("DIESEL").fuelType).toBe(FuelType.DIESEL);
  });

  it("maps equipment types without forcing TRUCK", () => {
    expect(mapVehicleTypeSafe("MOTORCYCLE")).toBe(VehicleType.MOTORCYCLE);
    expect(mapVehicleTypeSafe("HEAVY_EQUIPMENT")).toBe(VehicleType.HEAVY_EQUIPMENT);
    expect(mapVehicleTypeSafe("TRUCK")).toBe(VehicleType.TRUCK);
  });

  it("preserves source fields in customFields and derives year safely", () => {
    const mapped = mapVehicleMasterRow(
      {
        RegistrationNo: "WP-BFJ-9183",
        SourceVehicleId: "168343000000000",
        Make: "Suzuki",
        VehicleModel: "GN-125H",
        Status: "AVAILABLE",
        FuelType: "PETROL",
        VehicleType: "MOTORCYCLE",
        YearSource: "PURCHASE_DATE_FALLBACK",
        PurchaseYearDerived: 2017,
        ManufactureYear: null,
        Transmission: "Manual",
        MortgageAmount: 1000,
        InsuranceCompanyName: "AIA",
        CheckOutDate: "2024-01-01",
        RegistrationClass: "REGISTRATION_LIKE"
      },
      5
    );
    expect(mapped.registrationNo).toBe("WP-BFJ-9183");
    expect(mapped.normalizedRegistration).toBe("WPBFJ9183");
    expect(mapped.year).toBe(2017);
    expect((mapped.customFields.import as { yearSource: string }).yearSource).toContain("PURCHASE");
    expect((mapped.customFields.specifications as { transmission: string }).transmission).toBe("Manual");
    expect((mapped.customFields.finance as { mortgage: { amount: number } }).mortgage.amount).toBe(1000);
    expect(
      (mapped.customFields.complianceImport as { insurance: { companyName: string } }).insurance.companyName
    ).toBe("AIA");
    expect(mapped.issues.some((i) => i.code === "GATE_HISTORY_DEFERRED")).toBe(true);
    expect(mapped.issues.some((i) => i.code === "MISSING_YEAR")).toBe(true);
  });
});

describe("FG vehicle eligibility", () => {
  it("allows AVAILABLE and IN_USE, blocks OUT_OF_SERVICE and DISPOSED", () => {
    expect(evaluateVehicleEligibilityForNewFgRecord({ status: "AVAILABLE" }).selectable).toBe(true);
    expect(evaluateVehicleEligibilityForNewFgRecord({ status: "IN_USE" }).selectable).toBe(true);
    expect(evaluateVehicleEligibilityForNewFgRecord({ status: "OUT_OF_SERVICE" }).selectable).toBe(false);
    expect(evaluateVehicleEligibilityForNewFgRecord({ status: "DISPOSED" }).selectable).toBe(false);
    expect(evaluateVehicleEligibilityForNewFgRecord({ status: "UNDER_MAINTENANCE" }).selectable).toBe(false);
  });

  it("does not treat ACTIVE as the MaintainPro status", () => {
    const result = evaluateVehicleEligibilityForNewFgRecord({ status: "ACTIVE" });
    expect(result.selectable).toBe(false);
  });

  it("restricts CL30 to TRUCK", () => {
    expect(fgFormAllowedVehicleTypes("NMS/PPU/CL/30")).toEqual(["TRUCK"]);
    expect(
      evaluateVehicleEligibilityForNewFgRecord(
        { status: "AVAILABLE", type: "MOTORCYCLE" },
        { allowedTypes: fgFormAllowedVehicleTypes("NMS/PPU/CL/30") }
      ).unavailableReason
    ).toBe("TYPE_NOT_ALLOWED_FOR_FORM");
    expect(
      evaluateVehicleEligibilityForNewFgRecord(
        { status: "AVAILABLE", type: "TRUCK" },
        { allowedTypes: fgFormAllowedVehicleTypes("NMS/PPU/CL/30") }
      ).selectable
    ).toBe(true);
  });
});
