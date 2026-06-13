export type FacilityProperty = {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FacilityBuilding = {
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

export type FacilityFloor = {
  id: string;
  tenantId: string;
  buildingId: string;
  name: string;
  levelNumber: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FacilityRoomType =
  | "OFFICE"
  | "RESTROOM"
  | "PLANT_ROOM"
  | "CORRIDOR"
  | "LOBBY"
  | "STORAGE"
  | "MEETING_ROOM"
  | "OTHER";

export type FacilityRoom = {
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

export const FACILITY_ROOM_TYPE_OPTIONS: readonly { value: FacilityRoomType; label: string }[] = [
  { value: "OFFICE", label: "Office" },
  { value: "RESTROOM", label: "Restroom" },
  { value: "PLANT_ROOM", label: "Plant room" },
  { value: "CORRIDOR", label: "Corridor" },
  { value: "LOBBY", label: "Lobby" },
  { value: "STORAGE", label: "Storage" },
  { value: "MEETING_ROOM", label: "Meeting room" },
  { value: "OTHER", label: "Other" }
];

export type FacilityHierarchyLevel = "property" | "building" | "floor" | "room";

export type FacilitySelection = {
  property: FacilityProperty | null;
  building: FacilityBuilding | null;
  floor: FacilityFloor | null;
};

export const FACILITY_VIEW_FALLBACK_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR",
  "SUPERVISOR",
  "VIEWER"
] as const;

export const FACILITY_MANAGE_FALLBACK_ROLES = ["SUPER_ADMIN", "ADMIN", "FACILITY_MANAGER"] as const;

export function canViewFacilities(roleName: string | null, permissions: readonly string[]): boolean {
  if (permissions.includes("facilities.view")) {
    return true;
  }

  const role = roleName?.trim().toUpperCase();
  return role != null && (FACILITY_VIEW_FALLBACK_ROLES as readonly string[]).includes(role);
}

export function canManageFacilities(roleName: string | null, permissions: readonly string[]): boolean {
  if (permissions.includes("facilities.manage")) {
    return true;
  }

  const role = roleName?.trim().toUpperCase();
  return role != null && (FACILITY_MANAGE_FALLBACK_ROLES as readonly string[]).includes(role);
}

export function getFacilityLevelLabel(level: FacilityHierarchyLevel): string {
  switch (level) {
    case "property":
      return "Properties";
    case "building":
      return "Buildings";
    case "floor":
      return "Floors";
    case "room":
      return "Rooms";
    default:
      return "Facilities";
  }
}

export function formatFacilityRoomType(value: FacilityRoomType | null | undefined): string {
  if (!value) {
    return "—";
  }

  return FACILITY_ROOM_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value.replace(/_/g, " ");
}

export const FACILITY_CREATE_PAYLOAD_KEYS = [
  "name",
  "code",
  "address",
  "description",
  "propertyId",
  "buildingId",
  "floorId",
  "levelNumber",
  "roomType",
  "isActive"
] as const;

export function facilityCreatePayloadIncludesTenantId(payload: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(payload, "tenantId");
}
