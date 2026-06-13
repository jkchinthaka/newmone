import { apiClient } from "./api-client";
import type { PublicFacilityDashboardSummary } from "./facility-dashboard-types";
import type {
  FacilityBuilding,
  FacilityFloor,
  FacilityProperty,
  FacilityRoom,
  FacilityRoomType
} from "./facilities";

export {
  FACILITY_CREATE_PAYLOAD_KEYS,
  facilityCreatePayloadIncludesTenantId
} from "./facilities";

type ApiEnvelope<T> = {
  data: T;
};

type ListParams = {
  includeInactive?: boolean;
  q?: string;
};

export async function listProperties(params: ListParams = {}): Promise<FacilityProperty[]> {
  const response = await apiClient.get<ApiEnvelope<FacilityProperty[]>>("/facilities/properties", {
    params: {
      includeInactive: params.includeInactive ? "true" : undefined,
      q: params.q?.trim() || undefined
    }
  });
  return response.data.data ?? [];
}

export async function createProperty(payload: {
  name: string;
  code: string;
  address?: string;
}): Promise<FacilityProperty> {
  const response = await apiClient.post<ApiEnvelope<FacilityProperty>>("/facilities/properties", payload);
  return response.data.data;
}

export async function updateProperty(
  propertyId: string,
  payload: Partial<{ name: string; code: string; address: string; isActive: boolean }>
): Promise<FacilityProperty> {
  const response = await apiClient.patch<ApiEnvelope<FacilityProperty>>(
    `/facilities/properties/${propertyId}`,
    payload
  );
  return response.data.data;
}

export async function listBuildings(
  params: ListParams & { propertyId?: string } = {}
): Promise<FacilityBuilding[]> {
  const response = await apiClient.get<ApiEnvelope<FacilityBuilding[]>>("/facilities/buildings", {
    params: {
      propertyId: params.propertyId,
      includeInactive: params.includeInactive ? "true" : undefined,
      q: params.q?.trim() || undefined
    }
  });
  return response.data.data ?? [];
}

export async function createBuilding(payload: {
  propertyId: string;
  name: string;
  code: string;
  description?: string;
}): Promise<FacilityBuilding> {
  const response = await apiClient.post<ApiEnvelope<FacilityBuilding>>("/facilities/buildings", payload);
  return response.data.data;
}

export async function updateBuilding(
  buildingId: string,
  payload: Partial<{ name: string; code: string; description: string; isActive: boolean }>
): Promise<FacilityBuilding> {
  const response = await apiClient.patch<ApiEnvelope<FacilityBuilding>>(
    `/facilities/buildings/${buildingId}`,
    payload
  );
  return response.data.data;
}

export async function listFloors(
  params: ListParams & { buildingId?: string } = {}
): Promise<FacilityFloor[]> {
  const response = await apiClient.get<ApiEnvelope<FacilityFloor[]>>("/facilities/floors", {
    params: {
      buildingId: params.buildingId,
      includeInactive: params.includeInactive ? "true" : undefined,
      q: params.q?.trim() || undefined
    }
  });
  return response.data.data ?? [];
}

export async function createFloor(payload: {
  buildingId: string;
  name: string;
  levelNumber?: number;
}): Promise<FacilityFloor> {
  const response = await apiClient.post<ApiEnvelope<FacilityFloor>>("/facilities/floors", payload);
  return response.data.data;
}

export async function updateFloor(
  floorId: string,
  payload: Partial<{ name: string; levelNumber: number; isActive: boolean }>
): Promise<FacilityFloor> {
  const response = await apiClient.patch<ApiEnvelope<FacilityFloor>>(`/facilities/floors/${floorId}`, payload);
  return response.data.data;
}

export async function listRooms(params: ListParams & { floorId?: string } = {}): Promise<FacilityRoom[]> {
  const response = await apiClient.get<ApiEnvelope<FacilityRoom[]>>("/facilities/rooms", {
    params: {
      floorId: params.floorId,
      includeInactive: params.includeInactive ? "true" : undefined,
      q: params.q?.trim() || undefined
    }
  });
  return response.data.data ?? [];
}

export async function createRoom(payload: {
  floorId: string;
  name: string;
  code?: string;
  roomType?: FacilityRoomType;
}): Promise<FacilityRoom> {
  const response = await apiClient.post<ApiEnvelope<FacilityRoom>>("/facilities/rooms", payload);
  return response.data.data;
}

export async function updateRoom(
  roomId: string,
  payload: Partial<{ name: string; code: string; roomType: FacilityRoomType; isActive: boolean }>
): Promise<FacilityRoom> {
  const response = await apiClient.patch<ApiEnvelope<FacilityRoom>>(`/facilities/rooms/${roomId}`, payload);
  return response.data.data;
}

export async function getProperty(propertyId: string): Promise<FacilityProperty> {
  const response = await apiClient.get<ApiEnvelope<FacilityProperty>>(`/facilities/properties/${propertyId}`);
  return response.data.data;
}

export async function getBuilding(buildingId: string): Promise<FacilityBuilding> {
  const response = await apiClient.get<ApiEnvelope<FacilityBuilding>>(`/facilities/buildings/${buildingId}`);
  return response.data.data;
}

export async function getFloor(floorId: string): Promise<FacilityFloor> {
  const response = await apiClient.get<ApiEnvelope<FacilityFloor>>(`/facilities/floors/${floorId}`);
  return response.data.data;
}

export async function getRoom(roomId: string): Promise<FacilityRoom> {
  const response = await apiClient.get<ApiEnvelope<FacilityRoom>>(`/facilities/rooms/${roomId}`);
  return response.data.data;
}

export async function getFacilityDashboardSummary(): Promise<PublicFacilityDashboardSummary> {
  const response = await apiClient.get<ApiEnvelope<PublicFacilityDashboardSummary>>("/facilities/dashboard");
  return response.data.data;
}
