import 'driver.dart';

const _sentinel = Object();

class Vehicle {
  Vehicle({
    required this.id,
    required this.registrationNo,
    required this.make,
    required this.vehicleModel,
    required this.year,
    required this.type,
    required this.status,
    required this.fuelType,
    required this.currentMileage,
    this.color,
    this.vin,
    this.engineNo,
    this.fuelCapacity,
    this.insuranceExpiry,
    this.roadTaxExpiry,
    this.lastServiceDate,
    this.nextServiceDate,
    this.nextServiceMileage,
    this.gpsDeviceId,
    this.images = const [],
    this.driverId,
    this.driver,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String registrationNo;
  final String make;
  final String vehicleModel;
  final int year;
  final String type;
  final String status;
  final String fuelType;
  final double currentMileage;
  final String? color;
  final String? vin;
  final String? engineNo;
  final double? fuelCapacity;
  final DateTime? insuranceExpiry;
  final DateTime? roadTaxExpiry;
  final DateTime? lastServiceDate;
  final DateTime? nextServiceDate;
  final double? nextServiceMileage;
  final String? gpsDeviceId;
  final List<String> images;
  final String? driverId;
  final Driver? driver;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  bool get isAvailable => status == 'AVAILABLE';
  bool get isInUse => status == 'IN_USE';
  bool get isUnderMaintenance => status == 'UNDER_MAINTENANCE';
  bool get isOutOfService => status == 'OUT_OF_SERVICE';

  bool get serviceOverdue =>
      nextServiceDate != null && nextServiceDate!.isBefore(DateTime.now());

  bool get serviceDueSoon {
    final d = nextServiceDate;
    if (d == null) return false;
    final diff = d.difference(DateTime.now());
    return !diff.isNegative && diff.inDays <= 14;
  }

  String get displayLabel => '$make $vehicleModel · $registrationNo';

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    DateTime? d(dynamic v) =>
        v == null ? null : DateTime.tryParse(v.toString());

    final imagesRaw = json['images'];
    final images = imagesRaw is List
        ? imagesRaw.map((e) => e.toString()).toList()
        : <String>[];

    final driverJson = json['driver'];
    return Vehicle(
      id: (json['id'] ?? '').toString(),
      registrationNo: (json['registrationNo'] ?? '').toString(),
      make: (json['make'] ?? '').toString(),
      vehicleModel: (json['vehicleModel'] ?? '').toString(),
      year: (json['year'] as num?)?.toInt() ?? 0,
      type: (json['type'] ?? 'OTHER').toString(),
      status: (json['status'] ?? 'AVAILABLE').toString(),
      fuelType: (json['fuelType'] ?? 'PETROL').toString(),
      currentMileage: (json['currentMileage'] as num?)?.toDouble() ?? 0,
      color: json['color']?.toString(),
      vin: json['vin']?.toString(),
      engineNo: json['engineNo']?.toString(),
      fuelCapacity: (json['fuelCapacity'] as num?)?.toDouble(),
      insuranceExpiry: d(json['insuranceExpiry']),
      roadTaxExpiry: d(json['roadTaxExpiry']),
      lastServiceDate: d(json['lastServiceDate']),
      nextServiceDate: d(json['nextServiceDate']),
      nextServiceMileage: (json['nextServiceMileage'] as num?)?.toDouble(),
      gpsDeviceId: json['gpsDeviceId']?.toString(),
      images: images,
      driverId: json['driverId']?.toString(),
      driver: driverJson is Map<String, dynamic>
          ? Driver.fromJson(driverJson)
          : (driverJson is Map
              ? Driver.fromJson(Map<String, dynamic>.from(driverJson))
              : null),
      createdAt: d(json['createdAt']),
      updatedAt: d(json['updatedAt']),
    );
  }
}

class VehicleListResult {
  VehicleListResult({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
    required this.totalPages,
  });

  final List<Vehicle> items;
  final int total;
  final int page;
  final int pageSize;
  final int totalPages;
}

class VehicleSummary {
  VehicleSummary({
    required this.totalVehicles,
    required this.availableVehicles,
    required this.vehiclesUnderMaintenance,
    required this.vehiclesInUse,
    required this.vehiclesOutOfService,
    required this.disposedVehicles,
    required this.upcomingServices,
    required this.overdueMaintenance,
  });

  final int totalVehicles;
  final int availableVehicles;
  final int vehiclesUnderMaintenance;
  final int vehiclesInUse;
  final int vehiclesOutOfService;
  final int disposedVehicles;
  final int upcomingServices;
  final int overdueMaintenance;

  factory VehicleSummary.fromJson(Map<String, dynamic> json) => VehicleSummary(
        totalVehicles: (json['totalVehicles'] as num?)?.toInt() ?? 0,
        availableVehicles: (json['availableVehicles'] as num?)?.toInt() ?? 0,
        vehiclesUnderMaintenance:
            (json['vehiclesUnderMaintenance'] as num?)?.toInt() ?? 0,
        vehiclesInUse: (json['vehiclesInUse'] as num?)?.toInt() ?? 0,
        vehiclesOutOfService:
            (json['vehiclesOutOfService'] as num?)?.toInt() ?? 0,
        disposedVehicles: (json['disposedVehicles'] as num?)?.toInt() ?? 0,
        upcomingServices: (json['upcomingServices'] as num?)?.toInt() ?? 0,
        overdueMaintenance: (json['overdueMaintenance'] as num?)?.toInt() ?? 0,
      );
}

class VehicleListFilters {
  const VehicleListFilters({
    this.q,
    this.statuses = const [],
    this.sortBy = 'createdAt',
    this.sortDir = 'desc',
    this.page = 1,
    this.pageSize = 20,
  });

  final String? q;
  final List<String> statuses;
  final String sortBy;
  final String sortDir;
  final int page;
  final int pageSize;

  VehicleListFilters copyWith({
    Object? q = _sentinel,
    List<String>? statuses,
    String? sortBy,
    String? sortDir,
    int? page,
    int? pageSize,
  }) {
    return VehicleListFilters(
      q: identical(q, _sentinel) ? this.q : q as String?,
      statuses: statuses ?? this.statuses,
      sortBy: sortBy ?? this.sortBy,
      sortDir: sortDir ?? this.sortDir,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
    );
  }
}
