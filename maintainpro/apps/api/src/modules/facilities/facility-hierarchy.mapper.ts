import { FacilityRoomType } from "@prisma/client";

export type PublicPropertyResponse = {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicBuildingResponse = {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicFloorResponse = {
  id: string;
  tenantId: string;
  buildingId: string;
  name: string;
  levelNumber: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicRoomResponse = {
  id: string;
  tenantId: string;
  floorId: string;
  name: string;
  code: string | null;
  roomType: FacilityRoomType | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type TimestampedEntity = {
  createdAt: Date;
  updatedAt: Date;
};

export function toPublicPropertyResponse(
  row: TimestampedEntity & {
    id: string;
    tenantId: string;
    name: string;
    code: string;
    address: string | null;
    isActive: boolean;
  }
): PublicPropertyResponse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    code: row.code,
    address: row.address,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toPublicBuildingResponse(
  row: TimestampedEntity & {
    id: string;
    tenantId: string;
    propertyId: string;
    name: string;
    code: string;
    description: string | null;
    isActive: boolean;
  }
): PublicBuildingResponse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    propertyId: row.propertyId,
    name: row.name,
    code: row.code,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toPublicFloorResponse(
  row: TimestampedEntity & {
    id: string;
    tenantId: string;
    buildingId: string;
    name: string;
    levelNumber: number | null;
    isActive: boolean;
  }
): PublicFloorResponse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    buildingId: row.buildingId,
    name: row.name,
    levelNumber: row.levelNumber,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toPublicRoomResponse(
  row: TimestampedEntity & {
    id: string;
    tenantId: string;
    floorId: string;
    name: string;
    code: string | null;
    roomType: FacilityRoomType | null;
    isActive: boolean;
  }
): PublicRoomResponse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    floorId: row.floorId,
    name: row.name,
    code: row.code,
    roomType: row.roomType,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export const FACILITY_HIERARCHY_SENSITIVE_FIELDS = [
  "tenant",
  "property",
  "building",
  "floor",
  "rooms",
  "floors",
  "buildings",
  "passwordHash",
  "token"
] as const;

export function publicFacilityResponseHasSensitiveFields(payload: Record<string, unknown>): boolean {
  return FACILITY_HIERARCHY_SENSITIVE_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(payload, field)
  );
}
