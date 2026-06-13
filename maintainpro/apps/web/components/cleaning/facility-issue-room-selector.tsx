"use client";

import { useCallback, useEffect, useState } from "react";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  listBuildings,
  listFloors,
  listProperties,
  listRooms
} from "@/lib/facilities-api";
import type { FacilityBuilding, FacilityFloor, FacilityProperty, FacilityRoom } from "@/lib/facilities";
import {
  emptyRoomSelection,
  filterBuildingsByProperty,
  filterFloorsByBuilding,
  filterRoomsByFloor,
  type FacilityIssueRoomSelection
} from "@/lib/facility-issue-ui";

type FacilityIssueRoomSelectorProps = {
  value: Partial<FacilityIssueRoomSelection>;
  onChange: (value: Partial<FacilityIssueRoomSelection>) => void;
  onAvailabilityChange?: (state: { loaded: boolean; available: boolean; message: string | null }) => void;
  disabled?: boolean;
  idPrefix?: string;
};

export function FacilityIssueRoomSelector({
  value,
  onChange,
  onAvailabilityChange,
  disabled = false,
  idPrefix = "issue-room"
}: FacilityIssueRoomSelectorProps) {
  const [properties, setProperties] = useState<FacilityProperty[]>([]);
  const [buildings, setBuildings] = useState<FacilityBuilding[]>([]);
  const [floors, setFloors] = useState<FacilityFloor[]>([]);
  const [rooms, setRooms] = useState<FacilityRoom[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const notifyAvailability = useCallback(
    (loaded: boolean, available: boolean, message: string | null) => {
      onAvailabilityChange?.({ loaded, available, message });
    },
    [onAvailabilityChange]
  );

  useEffect(() => {
    let cancelled = false;

    const loadProperties = async () => {
      setLoadingProperties(true);
      setWarning(null);

      try {
        const rows = await listProperties();
        if (cancelled) {
          return;
        }

        setProperties(rows);
        const message =
          rows.length === 0
            ? "Facility hierarchy is not configured yet. You can still use the existing cleaning location."
            : null;
        setWarning(message);
        notifyAvailability(true, true, message);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setProperties([]);
        const message = getApiErrorMessage(
          error,
          "Facility hierarchy is unavailable. You can still use the existing cleaning location."
        );
        setWarning(message);
        notifyAvailability(true, false, message);
      } finally {
        if (!cancelled) {
          setLoadingProperties(false);
        }
      }
    };

    void loadProperties();

    return () => {
      cancelled = true;
    };
  }, [notifyAvailability]);

  useEffect(() => {
    if (!value.propertyId) {
      setBuildings([]);
      return;
    }

    let cancelled = false;
    setLoadingChildren(true);

    void listBuildings({ propertyId: value.propertyId })
      .then((rows) => {
        if (!cancelled) {
          setBuildings(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBuildings([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingChildren(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value.propertyId]);

  useEffect(() => {
    if (!value.buildingId) {
      setFloors([]);
      return;
    }

    let cancelled = false;
    setLoadingChildren(true);

    void listFloors({ buildingId: value.buildingId })
      .then((rows) => {
        if (!cancelled) {
          setFloors(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFloors([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingChildren(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value.buildingId]);

  useEffect(() => {
    if (!value.floorId) {
      setRooms([]);
      return;
    }

    let cancelled = false;
    setLoadingChildren(true);

    void listRooms({ floorId: value.floorId })
      .then((rows) => {
        if (!cancelled) {
          setRooms(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRooms([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingChildren(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value.floorId]);

  const propertyBuildings = filterBuildingsByProperty(buildings, value.propertyId ?? "");
  const buildingFloors = filterFloorsByBuilding(floors, value.buildingId ?? "");
  const floorRooms = filterRoomsByFloor(rooms, value.floorId ?? "");

  const selectClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100";

  if (loadingProperties) {
    return <p className="text-xs text-slate-500">Loading facility hierarchy…</p>;
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <div>
        <p className="text-sm font-medium text-slate-800">Link to facility room (optional)</p>
        <p className="text-xs text-slate-500">
          Choose property → building → floor → room, or leave blank and use the cleaning location above.
        </p>
      </div>

      {warning ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{warning}</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs">
          <span className="font-medium text-slate-700">Property</span>
          <select
            id={`${idPrefix}-property`}
            disabled={disabled || properties.length === 0}
            value={value.propertyId ?? ""}
            onChange={(event) =>
              onChange({
                propertyId: event.target.value,
                buildingId: "",
                floorId: "",
                roomId: ""
              })
            }
            className={`mt-1 ${selectClass}`}
          >
            <option value="">Select property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="font-medium text-slate-700">Building</span>
          <select
            id={`${idPrefix}-building`}
            disabled={disabled || !value.propertyId || loadingChildren}
            value={value.buildingId ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                buildingId: event.target.value,
                floorId: "",
                roomId: ""
              })
            }
            className={`mt-1 ${selectClass}`}
          >
            <option value="">Select building</option>
            {propertyBuildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="font-medium text-slate-700">Floor</span>
          <select
            id={`${idPrefix}-floor`}
            disabled={disabled || !value.buildingId || loadingChildren}
            value={value.floorId ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                floorId: event.target.value,
                roomId: ""
              })
            }
            className={`mt-1 ${selectClass}`}
          >
            <option value="">Select floor</option>
            {buildingFloors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="font-medium text-slate-700">Room</span>
          <select
            id={`${idPrefix}-room`}
            disabled={disabled || !value.floorId || loadingChildren}
            value={value.roomId ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                roomId: event.target.value
              })
            }
            className={`mt-1 ${selectClass}`}
          >
            <option value="">Select room</option>
            {floorRooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.code ? `${room.name} (${room.code})` : room.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {value.roomId ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(emptyRoomSelection())}
          className="text-xs font-medium text-brand-700 hover:text-brand-800"
        >
          Clear room link
        </button>
      ) : null}
    </div>
  );
}
