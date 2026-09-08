// Defensive parsers for Nest `/vehicles` gate In/Out envelopes.

Map<String, dynamic>? asStringKeyedMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

List<Map<String, dynamic>> asMapList(dynamic value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();
}

/// Unwrap Nest `{ success?, data, message }` or bare map / list payloads.
Map<String, dynamic>? unwrapGateDataMap(dynamic body) {
  final map = asStringKeyedMap(body);
  if (map == null) return null;
  final data = map['data'];
  if (data is Map) return Map<String, dynamic>.from(data);
  if (map.containsKey('allowed') ||
      map.containsKey('blocked') ||
      map.containsKey('items') ||
      map.containsKey('registrationNo') ||
      map.containsKey('movement')) {
    return map;
  }
  return map;
}

dynamic unwrapGateData(dynamic body) {
  final map = asStringKeyedMap(body);
  if (map == null) return body;
  if (map.containsKey('data')) return map['data'];
  return body;
}

List<Map<String, dynamic>> extractVehicleList(dynamic data) {
  if (data is List) return asMapList(data);
  final map = asStringKeyedMap(data);
  if (map == null) return const [];
  for (final key in ['items', 'results', 'vehicles', 'data']) {
    final list = map[key];
    if (list is List) return asMapList(list);
  }
  return const [];
}

List<Map<String, dynamic>> extractMovementList(dynamic data) {
  if (data is List) return asMapList(data);
  final map = asStringKeyedMap(data);
  if (map == null) return const [];
  for (final key in ['items', 'movements', 'results', 'data']) {
    final list = map[key];
    if (list is List) return asMapList(list);
  }
  return const [];
}

double? _asDouble(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

/// Mongo ObjectId-style opaque id (24 hex) or UUID-ish vehicle keys.
final RegExp kVehicleIdPattern = RegExp(
  r'^[a-fA-F0-9]{24}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
);

bool looksLikeVehicleId(String code) => kVehicleIdPattern.hasMatch(code.trim());

class VehicleSummary {
  const VehicleSummary({
    required this.id,
    this.registrationNo,
    this.make,
    this.vehicleModel,
    this.status,
    this.currentMileage,
    this.serviceStatus,
    this.driverId,
    this.assetTag,
    this.type,
    this.nextServiceDate,
    this.nextServiceMileage,
  });

  final String id;
  final String? registrationNo;
  final String? make;
  final String? vehicleModel;
  final String? status;
  final double? currentMileage;
  final String? serviceStatus;
  final String? driverId;
  final String? assetTag;
  final String? type;
  final String? nextServiceDate;
  final double? nextServiceMileage;

  String get displayLabel {
    final reg = registrationNo?.trim();
    if (reg != null && reg.isNotEmpty) return reg;
    final parts =
        [make, vehicleModel].whereType<String>().where((s) => s.isNotEmpty);
    if (parts.isNotEmpty) return parts.join(' ');
    return id.isEmpty ? 'Vehicle' : id;
  }

  factory VehicleSummary.fromJson(Map<String, dynamic> json) {
    return VehicleSummary(
      id: (json['id'] ?? '').toString(),
      registrationNo: json['registrationNo']?.toString(),
      make: json['make']?.toString(),
      vehicleModel: (json['vehicleModel'] ?? json['model'])?.toString(),
      status: json['status']?.toString(),
      currentMileage: _asDouble(json['currentMileage'] ?? json['mileage']),
      serviceStatus: json['serviceStatus']?.toString(),
      driverId: json['driverId']?.toString(),
      assetTag: json['assetTag']?.toString(),
      type: json['type']?.toString(),
      nextServiceDate: json['nextServiceDate']?.toString(),
      nextServiceMileage: _asDouble(json['nextServiceMileage']),
    );
  }
}

class GateEligibility {
  const GateEligibility({
    required this.allowed,
    required this.blocked,
    this.blockReasons = const [],
    this.canOverride = false,
    this.vehicle,
  });

  final bool allowed;
  final bool blocked;
  final List<String> blockReasons;
  final bool canOverride;
  final VehicleSummary? vehicle;

  factory GateEligibility.fromJson(Map<String, dynamic> json) {
    final reasonsRaw = json['blockReasons'] ?? json['blockedReasons'];
    final reasons = <String>[];
    if (reasonsRaw is List) {
      for (final r in reasonsRaw) {
        final s = r?.toString().trim() ?? '';
        if (s.isNotEmpty) reasons.add(s);
      }
    } else if (reasonsRaw is String && reasonsRaw.trim().isNotEmpty) {
      reasons.add(reasonsRaw.trim());
    }

    final vehicleMap = asStringKeyedMap(json['vehicle']);
    final blocked = json['blocked'] == true ||
        (json['allowed'] == false && reasons.isNotEmpty) ||
        json['allowed'] == false;

    return GateEligibility(
      allowed:
          json['allowed'] == true || (!blocked && json['allowed'] != false),
      blocked: blocked,
      blockReasons: reasons,
      canOverride: json['canOverride'] == true,
      vehicle: vehicleMap == null ? null : VehicleSummary.fromJson(vehicleMap),
    );
  }
}

class GateMovement {
  const GateMovement({
    required this.id,
    this.movementType,
    this.status,
    this.meterReading,
    this.previousMileage,
    this.blockedReason,
    this.overrideReason,
    this.checkpoint,
    this.gatePassNo,
    this.occurredAt,
    this.driverId,
    this.notes,
  });

  final String id;
  final String? movementType;
  final String? status;
  final double? meterReading;
  final double? previousMileage;
  final String? blockedReason;
  final String? overrideReason;
  final String? checkpoint;
  final String? gatePassNo;
  final String? occurredAt;
  final String? driverId;
  final String? notes;

  bool get isOut => (movementType ?? '').toUpperCase().contains('OUT');
  bool get isIn => (movementType ?? '').toUpperCase().contains('IN');
  bool get isBlocked =>
      (status ?? '').toUpperCase().contains('BLOCK') ||
      (blockedReason != null && blockedReason!.isNotEmpty);

  factory GateMovement.fromJson(Map<String, dynamic> json) {
    return GateMovement(
      id: (json['id'] ?? '').toString(),
      movementType: (json['movementType'] ?? json['type'])?.toString(),
      status: json['status']?.toString(),
      meterReading: _asDouble(json['meterReading']),
      previousMileage: _asDouble(json['previousMileage']),
      blockedReason: json['blockedReason']?.toString(),
      overrideReason: json['overrideReason']?.toString(),
      checkpoint: json['checkpoint']?.toString(),
      gatePassNo: json['gatePassNo']?.toString(),
      occurredAt: json['occurredAt']?.toString(),
      driverId: json['driverId']?.toString(),
      notes: json['notes']?.toString(),
    );
  }
}

class GateOutResult {
  const GateOutResult({
    required this.allowed,
    required this.blocked,
    this.blockedReason,
    this.overrideUsed = false,
    this.idempotentReplay = false,
    this.movement,
  });

  final bool allowed;
  final bool blocked;
  final String? blockedReason;
  final bool overrideUsed;
  final bool idempotentReplay;
  final GateMovement? movement;

  factory GateOutResult.fromJson(Map<String, dynamic> json) {
    final movementMap = asStringKeyedMap(json['movement']);
    return GateOutResult(
      allowed: json['allowed'] == true,
      blocked: json['blocked'] == true || json['allowed'] == false,
      blockedReason: json['blockedReason']?.toString(),
      overrideUsed: json['overrideUsed'] == true,
      idempotentReplay: json['idempotentReplay'] == true,
      movement: movementMap == null ? null : GateMovement.fromJson(movementMap),
    );
  }
}

class GateInResult {
  const GateInResult({
    this.movement,
    this.idempotentReplay = false,
    this.raw = const {},
  });

  final GateMovement? movement;
  final bool idempotentReplay;
  final Map<String, dynamic> raw;

  factory GateInResult.fromJson(Map<String, dynamic> json) {
    final movementMap = asStringKeyedMap(json['movement']) ??
        (json.containsKey('id') ? json : null);
    return GateInResult(
      movement: movementMap == null ? null : GateMovement.fromJson(movementMap),
      idempotentReplay: json['idempotentReplay'] == true,
      raw: json,
    );
  }
}

/// UX-only: show override controls when server says canOverride AND user has
/// gate.override.approve. Never trust client-supplied approver ids.
bool canShowGateOverrideUi({
  required bool eligibilityCanOverride,
  required bool userHasOverridePermission,
}) =>
    eligibilityCanOverride && userHasOverridePermission;
