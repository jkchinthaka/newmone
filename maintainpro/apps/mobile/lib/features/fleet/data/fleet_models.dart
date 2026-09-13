// Defensive parsers for Nest `/vehicles` + `/drivers` envelopes.

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
Map<String, dynamic>? unwrapFleetDataMap(dynamic body) {
  final map = asStringKeyedMap(body);
  if (map == null) return null;
  final data = map['data'];
  if (data is Map) return Map<String, dynamic>.from(data);
  if (map.containsKey('items') ||
      map.containsKey('id') ||
      map.containsKey('registrationNo') ||
      map.containsKey('totalVehicles') ||
      map.containsKey('totalLiters')) {
    return map;
  }
  return map;
}

dynamic unwrapFleetData(dynamic body) {
  final map = asStringKeyedMap(body);
  if (map == null) return body;
  if (map.containsKey('data')) return map['data'];
  return body;
}

List<Map<String, dynamic>> extractItemList(dynamic data, {List<String>? keys}) {
  if (data is List) return asMapList(data);
  final map = asStringKeyedMap(data);
  if (map == null) return const [];
  final candidates = keys ??
      const [
        'items',
        'results',
        'vehicles',
        'drivers',
        'trips',
        'logs',
        'data'
      ];
  for (final key in candidates) {
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

int? _asInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

bool _asBool(dynamic v) => v == true || v == 'true' || v == 1;

String? _driverDisplayName(Map<String, dynamic>? driver) {
  if (driver == null) return null;
  final user = asStringKeyedMap(driver['user']);
  final first = (user?['firstName'] ?? driver['firstName'])?.toString().trim();
  final last = (user?['lastName'] ?? driver['lastName'])?.toString().trim();
  final parts = [first, last].whereType<String>().where((s) => s.isNotEmpty);
  if (parts.isNotEmpty) return parts.join(' ');
  final email = (user?['email'] ?? driver['email'])?.toString();
  if (email != null && email.isNotEmpty) return email;
  final license = driver['licenseNumber']?.toString();
  if (license != null && license.isNotEmpty) return license;
  final id = driver['id']?.toString();
  return (id != null && id.isNotEmpty) ? id : null;
}

/// Health summary derived ONLY from server `serviceStatus` / alert flags.
enum VehicleHealthLabel { healthy, attention, critical }

VehicleHealthLabel healthFromServiceStatus(
  String? serviceStatus, {
  bool hasCriticalAlert = false,
}) {
  if (hasCriticalAlert) return VehicleHealthLabel.critical;
  final s = (serviceStatus ?? '').toUpperCase();
  if (s.contains('OVERDUE')) return VehicleHealthLabel.critical;
  if (s.contains('DUE_SOON') ||
      s.contains('ATTENTION') ||
      s.contains('WARNING')) {
    return VehicleHealthLabel.attention;
  }
  return VehicleHealthLabel.healthy;
}

String healthLabelText(VehicleHealthLabel h) {
  switch (h) {
    case VehicleHealthLabel.critical:
      return 'Critical';
    case VehicleHealthLabel.attention:
      return 'Attention';
    case VehicleHealthLabel.healthy:
      return 'Healthy';
  }
}

class VehiclePagination {
  const VehiclePagination({
    required this.page,
    required this.pageSize,
    required this.total,
    required this.totalPages,
    required this.hasNextPage,
  });

  final int page;
  final int pageSize;
  final int total;
  final int totalPages;
  final bool hasNextPage;

  factory VehiclePagination.fromJson(Map<String, dynamic>? json) {
    final m = json ?? const {};
    final page = _asInt(m['page']) ?? 1;
    final pageSize = _asInt(m['pageSize']) ?? 12;
    final total = _asInt(m['total']) ?? 0;
    final totalPages = _asInt(m['totalPages']) ??
        (pageSize > 0 ? (total / pageSize).ceil().clamp(1, 999999) : 1);
    final hasNext = m.containsKey('hasNextPage')
        ? _asBool(m['hasNextPage'])
        : page < totalPages;
    return VehiclePagination(
      page: page,
      pageSize: pageSize,
      total: total,
      totalPages: totalPages,
      hasNextPage: hasNext,
    );
  }
}

class VehicleListPage {
  const VehicleListPage({
    required this.items,
    required this.pagination,
  });

  final List<Vehicle> items;
  final VehiclePagination pagination;

  factory VehicleListPage.fromJson(dynamic data) {
    final map = asStringKeyedMap(data);
    final items = extractItemList(data).map(Vehicle.fromJson).toList();
    final paginationMap = asStringKeyedMap(map?['pagination']);
    return VehicleListPage(
      items: items,
      pagination: VehiclePagination.fromJson(paginationMap),
    );
  }
}

class Vehicle {
  const Vehicle({
    required this.id,
    this.registrationNo,
    this.make,
    this.vehicleModel,
    this.status,
    this.currentMileage,
    this.serviceStatus,
    this.driverId,
    this.driverName,
    this.assetTag,
    this.type,
    this.nextServiceDate,
    this.nextServiceMileage,
    this.lastServiceDate,
    this.serviceIntervalDays,
    this.serviceIntervalMileage,
    this.color,
    this.location,
    this.description,
    this.year,
    this.insuranceExpiry,
    this.roadTaxExpiry,
  });

  final String id;
  final String? registrationNo;
  final String? make;
  final String? vehicleModel;
  final String? status;
  final double? currentMileage;
  final String? serviceStatus;
  final String? driverId;
  final String? driverName;
  final String? assetTag;
  final String? type;
  final String? nextServiceDate;
  final double? nextServiceMileage;
  final String? lastServiceDate;
  final int? serviceIntervalDays;
  final double? serviceIntervalMileage;
  final String? color;
  final String? location;
  final String? description;
  final int? year;
  final String? insuranceExpiry;
  final String? roadTaxExpiry;

  String get displayLabel {
    final reg = registrationNo?.trim();
    if (reg != null && reg.isNotEmpty) return reg;
    final parts =
        [make, vehicleModel].whereType<String>().where((s) => s.isNotEmpty);
    if (parts.isNotEmpty) return parts.join(' ');
    return id.isEmpty ? 'Vehicle' : id;
  }

  VehicleHealthLabel get healthLabel => healthFromServiceStatus(serviceStatus);

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    final driverMap = asStringKeyedMap(json['driver']);
    final driverId = (json['driverId'] ?? driverMap?['id'])?.toString();
    return Vehicle(
      id: (json['id'] ?? '').toString(),
      registrationNo: json['registrationNo']?.toString(),
      make: json['make']?.toString(),
      vehicleModel: (json['vehicleModel'] ?? json['model'])?.toString(),
      status: json['status']?.toString(),
      currentMileage: _asDouble(json['currentMileage'] ?? json['mileage']),
      serviceStatus: json['serviceStatus']?.toString(),
      driverId: driverId,
      driverName:
          _driverDisplayName(driverMap) ?? json['driverName']?.toString(),
      assetTag: json['assetTag']?.toString(),
      type: json['type']?.toString(),
      nextServiceDate: json['nextServiceDate']?.toString(),
      nextServiceMileage: _asDouble(json['nextServiceMileage']),
      lastServiceDate: json['lastServiceDate']?.toString(),
      serviceIntervalDays: _asInt(json['serviceIntervalDays']),
      serviceIntervalMileage: _asDouble(json['serviceIntervalMileage']),
      color: json['color']?.toString(),
      location: json['location']?.toString(),
      description: json['description']?.toString(),
      year: _asInt(json['year']),
      insuranceExpiry: json['insuranceExpiry']?.toString(),
      roadTaxExpiry: json['roadTaxExpiry']?.toString(),
    );
  }
}

class DriverSummary {
  const DriverSummary({
    required this.id,
    this.userId,
    this.name,
    this.email,
    this.licenseNumber,
    this.licenseClass,
    this.licenseExpiry,
    this.phone,
    this.vehicleIds = const [],
  });

  final String id;
  final String? userId;
  final String? name;
  final String? email;
  final String? licenseNumber;
  final String? licenseClass;
  final String? licenseExpiry;
  final String? phone;
  final List<String> vehicleIds;

  String get displayLabel {
    if (name != null && name!.trim().isNotEmpty) return name!.trim();
    if (licenseNumber != null && licenseNumber!.isNotEmpty) {
      return licenseNumber!;
    }
    if (email != null && email!.isNotEmpty) return email!;
    return id.isEmpty ? 'Driver' : id;
  }

  factory DriverSummary.fromJson(Map<String, dynamic> json) {
    final user = asStringKeyedMap(json['user']);
    final vehicles = json['vehicles'];
    final ids = <String>[];
    if (vehicles is List) {
      for (final v in vehicles) {
        if (v is Map) {
          final id = v['id']?.toString();
          if (id != null && id.isNotEmpty) ids.add(id);
        } else if (v != null) {
          ids.add(v.toString());
        }
      }
    }
    return DriverSummary(
      id: (json['id'] ?? '').toString(),
      userId: (json['userId'] ?? user?['id'])?.toString(),
      name: _driverDisplayName(json) ?? json['name']?.toString(),
      email: (user?['email'] ?? json['email'])?.toString(),
      licenseNumber: json['licenseNumber']?.toString(),
      licenseClass: json['licenseClass']?.toString(),
      licenseExpiry: json['licenseExpiry']?.toString(),
      phone: (user?['phone'] ?? json['phone'])?.toString(),
      vehicleIds: ids,
    );
  }
}

class TripLog {
  const TripLog({
    required this.id,
    this.vehicleId,
    this.driverId,
    this.startLocation,
    this.endLocation,
    this.startMileage,
    this.endMileage,
    this.distance,
    this.startTime,
    this.endTime,
    this.purpose,
    this.notes,
    this.status,
  });

  final String id;
  final String? vehicleId;
  final String? driverId;
  final String? startLocation;
  final String? endLocation;
  final double? startMileage;
  final double? endMileage;
  final double? distance;
  final String? startTime;
  final String? endTime;
  final String? purpose;
  final String? notes;
  final String? status;

  bool get isInProgress =>
      (status ?? '').toUpperCase().contains('IN_PROGRESS') ||
      (status ?? '').toUpperCase() == 'INPROGRESS';

  factory TripLog.fromJson(Map<String, dynamic> json) {
    return TripLog(
      id: (json['id'] ?? '').toString(),
      vehicleId: json['vehicleId']?.toString(),
      driverId: json['driverId']?.toString(),
      startLocation: json['startLocation']?.toString(),
      endLocation: json['endLocation']?.toString(),
      startMileage: _asDouble(json['startMileage']),
      endMileage: _asDouble(json['endMileage']),
      distance: _asDouble(json['distance']),
      startTime: json['startTime']?.toString(),
      endTime: json['endTime']?.toString(),
      purpose: json['purpose']?.toString(),
      notes: json['notes']?.toString(),
      status: json['status']?.toString(),
    );
  }
}

class FuelLog {
  const FuelLog({
    required this.id,
    this.vehicleId,
    this.driverId,
    this.liters,
    this.costPerLiter,
    this.totalCost,
    this.mileageAtFuel,
    this.fuelStation,
    this.notes,
    this.date,
    this.clientActionId,
  });

  final String id;
  final String? vehicleId;
  final String? driverId;
  final double? liters;
  final double? costPerLiter;
  final double? totalCost;
  final double? mileageAtFuel;
  final String? fuelStation;
  final String? notes;
  final String? date;
  final String? clientActionId;

  factory FuelLog.fromJson(Map<String, dynamic> json) {
    return FuelLog(
      id: (json['id'] ?? '').toString(),
      vehicleId: json['vehicleId']?.toString(),
      driverId: json['driverId']?.toString(),
      liters: _asDouble(json['liters']),
      costPerLiter: _asDouble(json['costPerLiter']),
      totalCost: _asDouble(json['totalCost']),
      mileageAtFuel: _asDouble(json['mileageAtFuel']),
      fuelStation: json['fuelStation']?.toString(),
      notes: json['notes']?.toString(),
      date: json['date']?.toString(),
      clientActionId: json['clientActionId']?.toString(),
    );
  }
}

class FuelAnalytics {
  const FuelAnalytics({
    this.totalLiters,
    this.totalCost,
    this.avgCostPerLiter,
    this.avgConsumption,
    this.averageConsumptionLPer100Km,
    this.distance,
    this.costPerKm,
    this.abnormalUsageCount,
  });

  final double? totalLiters;
  final double? totalCost;
  final double? avgCostPerLiter;
  final double? avgConsumption;
  final double? averageConsumptionLPer100Km;
  final double? distance;
  final double? costPerKm;
  final int? abnormalUsageCount;

  factory FuelAnalytics.fromJson(Map<String, dynamic> json) {
    return FuelAnalytics(
      totalLiters: _asDouble(json['totalLiters']),
      totalCost: _asDouble(json['totalCost']),
      avgCostPerLiter: _asDouble(json['avgCostPerLiter']),
      avgConsumption: _asDouble(json['avgConsumption']),
      averageConsumptionLPer100Km:
          _asDouble(json['averageConsumptionLPer100Km']),
      distance: _asDouble(json['distance']),
      costPerKm: _asDouble(json['costPerKm']),
      abnormalUsageCount: _asInt(json['abnormalUsageCount']),
    );
  }
}

class MeterLog {
  const MeterLog({
    required this.id,
    this.vehicleId,
    this.reading,
    this.readingType,
    this.source,
    this.notes,
    this.createdAt,
  });

  final String id;
  final String? vehicleId;
  final double? reading;
  final String? readingType;
  final String? source;
  final String? notes;
  final String? createdAt;

  factory MeterLog.fromJson(Map<String, dynamic> json) {
    return MeterLog(
      id: (json['id'] ?? '').toString(),
      vehicleId: json['vehicleId']?.toString(),
      reading: _asDouble(json['reading']),
      readingType: json['readingType']?.toString(),
      source: json['source']?.toString(),
      notes: json['notes']?.toString(),
      createdAt: json['createdAt']?.toString(),
    );
  }
}

class VehicleAlert {
  const VehicleAlert({
    required this.id,
    this.type,
    this.severity,
    this.vehicleId,
    this.registrationNo,
    this.title,
    this.message,
    this.status,
    this.dueAt,
    this.createdAt,
  });

  final String id;
  final String? type;
  final String? severity;
  final String? vehicleId;
  final String? registrationNo;
  final String? title;
  final String? message;
  final String? status;
  final String? dueAt;
  final String? createdAt;

  bool get isCritical => (severity ?? '').toLowerCase() == 'critical';

  factory VehicleAlert.fromJson(Map<String, dynamic> json) {
    return VehicleAlert(
      id: (json['id'] ?? '').toString(),
      type: json['type']?.toString(),
      severity: json['severity']?.toString(),
      vehicleId: json['vehicleId']?.toString(),
      registrationNo: json['registrationNo']?.toString(),
      title: json['title']?.toString(),
      message: json['message']?.toString(),
      status: json['status']?.toString(),
      dueAt: json['dueAt']?.toString(),
      createdAt: json['createdAt']?.toString(),
    );
  }
}

class FleetSummary {
  const FleetSummary({
    this.totalVehicles,
    this.availableVehicles,
    this.vehiclesUnderMaintenance,
    this.vehiclesInUse,
    this.vehiclesOutOfService,
    this.upcomingServices,
    this.overdueMaintenance,
  });

  final int? totalVehicles;
  final int? availableVehicles;
  final int? vehiclesUnderMaintenance;
  final int? vehiclesInUse;
  final int? vehiclesOutOfService;
  final int? upcomingServices;
  final int? overdueMaintenance;

  factory FleetSummary.fromJson(Map<String, dynamic> json) {
    return FleetSummary(
      totalVehicles: _asInt(json['totalVehicles']),
      availableVehicles: _asInt(json['availableVehicles']),
      vehiclesUnderMaintenance: _asInt(json['vehiclesUnderMaintenance']),
      vehiclesInUse: _asInt(json['vehiclesInUse']),
      vehiclesOutOfService: _asInt(json['vehiclesOutOfService']),
      upcomingServices: _asInt(json['upcomingServices']),
      overdueMaintenance: _asInt(json['overdueMaintenance']),
    );
  }
}

class ServiceRule {
  const ServiceRule({
    this.serviceIntervalDays,
    this.serviceIntervalMileage,
    this.nextServiceDate,
    this.nextServiceMileage,
    this.lastServiceDate,
    this.serviceStatus,
    this.currentMileage,
  });

  final int? serviceIntervalDays;
  final double? serviceIntervalMileage;
  final String? nextServiceDate;
  final double? nextServiceMileage;
  final String? lastServiceDate;
  final String? serviceStatus;
  final double? currentMileage;

  factory ServiceRule.fromJson(Map<String, dynamic> json) {
    final vehicle = asStringKeyedMap(json['vehicle']) ?? json;
    return ServiceRule(
      serviceIntervalDays: _asInt(vehicle['serviceIntervalDays']),
      serviceIntervalMileage: _asDouble(vehicle['serviceIntervalMileage']),
      nextServiceDate: vehicle['nextServiceDate']?.toString(),
      nextServiceMileage: _asDouble(vehicle['nextServiceMileage']),
      lastServiceDate: vehicle['lastServiceDate']?.toString(),
      serviceStatus: vehicle['serviceStatus']?.toString(),
      currentMileage: _asDouble(vehicle['currentMileage']),
    );
  }
}

class GpsHistoryPoint {
  const GpsHistoryPoint({
    required this.id,
    this.latitude,
    this.longitude,
    this.timestamp,
    this.speed,
  });

  final String id;
  final double? latitude;
  final double? longitude;
  final String? timestamp;
  final double? speed;

  factory GpsHistoryPoint.fromJson(Map<String, dynamic> json) {
    return GpsHistoryPoint(
      id: (json['id'] ?? '').toString(),
      latitude: _asDouble(json['latitude']),
      longitude: _asDouble(json['longitude']),
      timestamp: (json['timestamp'] ?? json['createdAt'])?.toString(),
      speed: _asDouble(json['speed']),
    );
  }
}
