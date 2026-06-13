export type FacilityLocationMatchConfidence = "exact" | "likely" | "ambiguous" | "none";

export type CleaningLocationMatchInput = {
  id: string;
  tenantId: string | null;
  name: string;
  area: string;
  building: string | null;
  floor: string | null;
};

export type RoomHierarchyMatchInput = {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  floor: {
    name: string;
    levelNumber: number | null;
    building: {
      name: string;
      code: string;
    };
  };
};

export type FacilityLocationMatchCandidate = {
  roomId: string;
  roomLabel: string;
  confidence: Exclude<FacilityLocationMatchConfidence, "none" | "ambiguous">;
  reason: string;
};

export type FacilityLocationMatchReportRow = {
  cleaningLocationId: string;
  cleaningLocation: {
    name: string;
    area: string;
    building: string | null;
    floor: string | null;
  };
  candidateRoomId: string | null;
  candidateRoomLabel: string | null;
  confidence: FacilityLocationMatchConfidence;
  reason: string;
  warnings: string[];
};

export function normalizeMatchToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function tokenMatches(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = normalizeMatchToken(left);
  const normalizedRight = normalizeMatchToken(right);
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}

function buildingMatches(
  cleaningLocation: CleaningLocationMatchInput,
  room: RoomHierarchyMatchInput
): boolean {
  if (!cleaningLocation.building) {
    return true;
  }

  return (
    tokenMatches(cleaningLocation.building, room.floor.building.name) ||
    tokenMatches(cleaningLocation.building, room.floor.building.code)
  );
}

function floorMatches(cleaningLocation: CleaningLocationMatchInput, room: RoomHierarchyMatchInput): boolean {
  if (!cleaningLocation.floor) {
    return true;
  }

  return (
    tokenMatches(cleaningLocation.floor, room.floor.name) ||
    tokenMatches(cleaningLocation.floor, room.floor.levelNumber?.toString())
  );
}

function roomNameMatches(cleaningLocation: CleaningLocationMatchInput, room: RoomHierarchyMatchInput): boolean {
  return (
    tokenMatches(cleaningLocation.name, room.name) ||
    tokenMatches(cleaningLocation.area, room.name) ||
    tokenMatches(cleaningLocation.name, room.code) ||
    tokenMatches(cleaningLocation.area, room.code)
  );
}

function scoreCandidate(
  cleaningLocation: CleaningLocationMatchInput,
  room: RoomHierarchyMatchInput
): FacilityLocationMatchCandidate | null {
  if (cleaningLocation.tenantId && cleaningLocation.tenantId !== room.tenantId) {
    return null;
  }

  if (!roomNameMatches(cleaningLocation, room)) {
    return null;
  }

  const buildingOk = buildingMatches(cleaningLocation, room);
  const floorOk = floorMatches(cleaningLocation, room);
  const roomLabel = `${room.floor.building.name} / ${room.floor.name} / ${room.name}`;

  if (buildingOk && floorOk) {
    return {
      roomId: room.id,
      roomLabel,
      confidence: "exact",
      reason: "Room name/area matches with building and floor alignment"
    };
  }

  if (buildingOk || floorOk) {
    return {
      roomId: room.id,
      roomLabel,
      confidence: "likely",
      reason: buildingOk
        ? "Room name/area matches building but floor is missing or differs"
        : "Room name/area matches floor but building is missing or differs"
    };
  }

  return {
    roomId: room.id,
    roomLabel,
    confidence: "likely",
    reason: "Room name/area matches but building/floor metadata is incomplete on one side"
  };
}

export function matchCleaningLocationToRooms(
  cleaningLocation: CleaningLocationMatchInput,
  rooms: readonly RoomHierarchyMatchInput[]
): FacilityLocationMatchReportRow {
  if (!cleaningLocation.tenantId) {
    return {
      cleaningLocationId: cleaningLocation.id,
      cleaningLocation: {
        name: cleaningLocation.name,
        area: cleaningLocation.area,
        building: cleaningLocation.building,
        floor: cleaningLocation.floor
      },
      candidateRoomId: null,
      candidateRoomLabel: null,
      confidence: "none",
      reason: "Cleaning location is missing tenantId; cross-tenant matching is blocked",
      warnings: ["Assign tenantId before attempting room backfill"]
    };
  }

  const tenantRooms = rooms.filter((room) => room.tenantId === cleaningLocation.tenantId);
  const candidates = tenantRooms
    .map((room) => scoreCandidate(cleaningLocation, room))
    .filter((candidate): candidate is FacilityLocationMatchCandidate => Boolean(candidate));

  const warnings: string[] = [];
  if (tenantRooms.length === 0) {
    warnings.push("No rooms exist for this tenant");
  }

  if (candidates.length === 0) {
    return {
      cleaningLocationId: cleaningLocation.id,
      cleaningLocation: {
        name: cleaningLocation.name,
        area: cleaningLocation.area,
        building: cleaningLocation.building,
        floor: cleaningLocation.floor
      },
      candidateRoomId: null,
      candidateRoomLabel: null,
      confidence: "none",
      reason: "No room candidate matched name/area within tenant scope",
      warnings
    };
  }

  const exactCandidates = candidates.filter((candidate) => candidate.confidence === "exact");
  if (exactCandidates.length === 1) {
    const candidate = exactCandidates[0];
    return {
      cleaningLocationId: cleaningLocation.id,
      cleaningLocation: {
        name: cleaningLocation.name,
        area: cleaningLocation.area,
        building: cleaningLocation.building,
        floor: cleaningLocation.floor
      },
      candidateRoomId: candidate.roomId,
      candidateRoomLabel: candidate.roomLabel,
      confidence: "exact",
      reason: candidate.reason,
      warnings
    };
  }

  if (exactCandidates.length > 1) {
    return {
      cleaningLocationId: cleaningLocation.id,
      cleaningLocation: {
        name: cleaningLocation.name,
        area: cleaningLocation.area,
        building: cleaningLocation.building,
        floor: cleaningLocation.floor
      },
      candidateRoomId: null,
      candidateRoomLabel: null,
      confidence: "ambiguous",
      reason: `${exactCandidates.length} exact room candidates found`,
      warnings: [...warnings, ...exactCandidates.map((candidate) => candidate.roomLabel)]
    };
  }

  const likelyCandidates = candidates.filter((candidate) => candidate.confidence === "likely");
  if (likelyCandidates.length === 1) {
    const candidate = likelyCandidates[0];
    return {
      cleaningLocationId: cleaningLocation.id,
      cleaningLocation: {
        name: cleaningLocation.name,
        area: cleaningLocation.area,
        building: cleaningLocation.building,
        floor: cleaningLocation.floor
      },
      candidateRoomId: candidate.roomId,
      candidateRoomLabel: candidate.roomLabel,
      confidence: "likely",
      reason: candidate.reason,
      warnings
    };
  }

  return {
    cleaningLocationId: cleaningLocation.id,
    cleaningLocation: {
      name: cleaningLocation.name,
      area: cleaningLocation.area,
      building: cleaningLocation.building,
      floor: cleaningLocation.floor
    },
    candidateRoomId: null,
    candidateRoomLabel: null,
    confidence: "ambiguous",
    reason: `${likelyCandidates.length || candidates.length} likely room candidates found`,
    warnings: [...warnings, ...candidates.map((candidate) => candidate.roomLabel)]
  };
}

export function matchCleaningLocationsToRooms(
  cleaningLocations: readonly CleaningLocationMatchInput[],
  rooms: readonly RoomHierarchyMatchInput[]
): FacilityLocationMatchReportRow[] {
  return cleaningLocations.map((cleaningLocation) => matchCleaningLocationToRooms(cleaningLocation, rooms));
}

export type FacilityLocationBackfillSummary = {
  generatedAt: string;
  tenantId: string | null;
  dryRun: boolean;
  applyEnabled: boolean;
  totals: {
    cleaningLocationCount: number;
    exactCount: number;
    likelyCount: number;
    ambiguousCount: number;
    noneCount: number;
    issuesEligibleForApply: number;
    issuesUpdated: number;
  };
  rows: FacilityLocationMatchReportRow[];
};
