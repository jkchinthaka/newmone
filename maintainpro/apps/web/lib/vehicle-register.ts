import {
  FuelType,
  VehicleOwnershipType,
  VehicleType
} from "../../api/src/database/prisma-enums";

/**
 * These are the enums `scripts/phase15-patch-prisma-enums.mjs` writes into the
 * generated Prisma client. `CreateVehicleDto` validates type, fuelType, and
 * ownershipType with `@IsEnum` against the same values.
 */
export { FuelType, VehicleOwnershipType, VehicleType };

export const VEHICLE_TYPE_OPTIONS = Object.values(VehicleType);
export const FUEL_TYPE_OPTIONS = Object.values(FuelType);
export const OWNERSHIP_TYPE_OPTIONS = Object.values(VehicleOwnershipType);

export const VEHICLE_YEAR_MIN = 1990;

export function vehicleYearMax(now = new Date()): number {
  return now.getFullYear() + 1;
}

export type RegisterVehicleInput = {
  registrationNo: string;
  type: string;
  fuelType: string;
  make: string;
  vehicleModel: string;
  year: string;
  ownershipType: string;
  currentMileage: string;
  assetTag: string;
};

export function emptyRegisterVehicleInput(): RegisterVehicleInput {
  return {
    registrationNo: "",
    type: "",
    fuelType: "",
    make: "",
    vehicleModel: "",
    year: "",
    ownershipType: "",
    currentMileage: "",
    assetTag: ""
  };
}

export function buildRegisterVehiclePayload(input: RegisterVehicleInput, now = new Date()) {
  const maxYear = vehicleYearMax(now);
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < VEHICLE_YEAR_MIN || year > maxYear) {
    throw new Error(`Year must be from ${VEHICLE_YEAR_MIN} to ${maxYear}.`);
  }

  const registrationNo = input.registrationNo.trim().toUpperCase();
  const make = input.make.trim();
  const vehicleModel = input.vehicleModel.trim();
  const type = input.type.trim();
  const fuelType = input.fuelType.trim();
  if (!registrationNo || !make || !vehicleModel || !type || !fuelType) {
    throw new Error("Registration number, vehicle type, fuel type, make, and model are required.");
  }
  if (!VEHICLE_TYPE_OPTIONS.includes(type as VehicleType)) {
    throw new Error("Choose a vehicle type.");
  }
  if (!FUEL_TYPE_OPTIONS.includes(fuelType as FuelType)) {
    throw new Error("Choose a fuel type.");
  }

  const payload: {
    registrationNo: string;
    type: string;
    fuelType: string;
    make: string;
    vehicleModel: string;
    year: number;
    ownershipType?: string;
    currentMileage?: number;
    assetTag?: string;
  } = {
    registrationNo,
    type,
    fuelType,
    make,
    vehicleModel,
    year
  };

  const ownershipType = input.ownershipType.trim();
  if (ownershipType) {
    if (!OWNERSHIP_TYPE_OPTIONS.includes(ownershipType as VehicleOwnershipType)) {
      throw new Error("Choose an ownership type.");
    }
    payload.ownershipType = ownershipType;
  }

  const mileageText = input.currentMileage.trim();
  if (mileageText) {
    const currentMileage = Number(mileageText);
    if (!Number.isFinite(currentMileage) || currentMileage < 0) {
      throw new Error("Mileage must be 0 or more.");
    }
    payload.currentMileage = currentMileage;
  }

  const assetTag = input.assetTag.trim();
  if (assetTag) {
    payload.assetTag = assetTag;
  }

  return payload;
}

export function vehicleApiFieldErrors(error: unknown): Record<string, string> {
  if (!error || typeof error !== "object") return {};
  const fieldErrors = (
    error as {
      response?: { data?: { error?: { fieldErrors?: Record<string, string[] | string> } } };
    }
  ).response?.data?.error?.fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== "object") return {};

  const mapped: Record<string, string> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (Array.isArray(messages)) {
      const text = messages.map((message) => message.trim()).filter(Boolean).join(" ");
      if (text) mapped[field] = text;
    } else if (typeof messages === "string" && messages.trim()) {
      mapped[field] = messages.trim();
    }
  }
  return mapped;
}
