import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/driver.dart';
import '../models/fuel_log.dart';
import '../models/gps_ping.dart';
import '../models/trip.dart';
import '../models/vehicle.dart';

class FleetRemoteDataSource {
  FleetRemoteDataSource(this._dio);
  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  // ── Vehicles ────────────────────────────────────────────────────────────
  Future<VehicleListResult> listVehicles({
    String? q,
    List<String> statuses = const [],
    String sortBy = 'createdAt',
    String sortDir = 'desc',
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.vehicles,
        queryParameters: {
          if (q != null && q.isNotEmpty) 'q': q,
          if (statuses.isNotEmpty) 'status': statuses.join(','),
          'sortBy': sortBy,
          'sortDir': sortDir,
          'page': page,
          'pageSize': pageSize,
        },
      );
      final data = _unwrap(res);
      if (data is Map) {
        final items = (data['items'] as List?) ?? const [];
        final pag = (data['pagination'] as Map?) ?? const {};
        return VehicleListResult(
          items: items
              .whereType<Map>()
              .map((e) => Vehicle.fromJson(Map<String, dynamic>.from(e)))
              .toList(),
          total: (pag['total'] as num?)?.toInt() ?? items.length,
          page: (pag['page'] as num?)?.toInt() ?? page,
          pageSize: (pag['pageSize'] as num?)?.toInt() ?? pageSize,
          totalPages: (pag['totalPages'] as num?)?.toInt() ?? 1,
        );
      }
      if (data is List) {
        final items = data
            .whereType<Map>()
            .map((e) => Vehicle.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        return VehicleListResult(
          items: items,
          total: items.length,
          page: page,
          pageSize: pageSize,
          totalPages: 1,
        );
      }
      return VehicleListResult(
        items: const [],
        total: 0,
        page: page,
        pageSize: pageSize,
        totalPages: 1,
      );
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<VehicleSummary> vehicleSummary({int upcomingDays = 14}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.vehiclesSummary,
        queryParameters: {'upcomingDays': upcomingDays},
      );
      final data = _unwrap(res);
      return VehicleSummary.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Vehicle> getVehicle(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.vehicleById(id));
      final data = _unwrap(res);
      return Vehicle.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Vehicle> createVehicle({
    required String registrationNo,
    required String make,
    required String vehicleModel,
    required int year,
    required String type,
    required String fuelType,
    double? currentMileage,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.vehicles,
        data: {
          'registrationNo': registrationNo,
          'make': make,
          'vehicleModel': vehicleModel,
          'year': year,
          'type': type,
          'fuelType': fuelType,
          if (currentMileage != null) 'currentMileage': currentMileage,
        },
      );
      final data = _unwrap(res);
      return Vehicle.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Vehicle> updateVehicle(
    String id, {
    String? status,
    double? currentMileage,
    DateTime? nextServiceDate,
    double? nextServiceMileage,
    DateTime? insuranceExpiry,
    DateTime? roadTaxExpiry,
    String? color,
  }) async {
    try {
      final res = await _dio.patch<dynamic>(
        ApiEndpoints.vehicleById(id),
        data: {
          if (status != null) 'status': status,
          if (currentMileage != null) 'currentMileage': currentMileage,
          if (nextServiceDate != null)
            'nextServiceDate': nextServiceDate.toIso8601String(),
          if (nextServiceMileage != null)
            'nextServiceMileage': nextServiceMileage,
          if (insuranceExpiry != null)
            'insuranceExpiry': insuranceExpiry.toIso8601String(),
          if (roadTaxExpiry != null)
            'roadTaxExpiry': roadTaxExpiry.toIso8601String(),
          if (color != null) 'color': color,
        },
      );
      final data = _unwrap(res);
      return Vehicle.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<void> assignDriver(String vehicleId, String driverId) async {
    try {
      await _dio.post<dynamic>(
        ApiEndpoints.vehicleAssignDriver(vehicleId),
        data: {'driverId': driverId},
      );
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Fuel ───────────────────────────────────────────────────────────────
  Future<FuelLog> createFuelLog(
    String vehicleId, {
    required double liters,
    required double costPerLiter,
    required double mileageAtFuel,
    String? fuelStation,
    String? notes,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.vehicleFuelLog(vehicleId),
        data: {
          'liters': liters,
          'costPerLiter': costPerLiter,
          'mileageAtFuel': mileageAtFuel,
          if (fuelStation != null && fuelStation.isNotEmpty)
            'fuelStation': fuelStation,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
        },
      );
      final data = _unwrap(res);
      return FuelLog.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<FuelLog>> listVehicleFuelLogs(String vehicleId) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.vehicleFuelLogs(vehicleId),
      );
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map>()
          .map((e) => FuelLog.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<FuelLog>> listAllFuelLogs() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.fuelLogs);
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map>()
          .map((e) => FuelLog.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<FuelAnalytics> vehicleFuelAnalytics(String vehicleId) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.vehicleFuelAnalytics(vehicleId),
      );
      final data = _unwrap(res);
      return FuelAnalytics.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Trips ──────────────────────────────────────────────────────────────
  Future<Trip> startTrip(
    String vehicleId, {
    required String driverId,
    required String startLocation,
    required String endLocation,
    required double startMileage,
    String? purpose,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.vehicleTripStart(vehicleId),
        data: {
          'driverId': driverId,
          'startLocation': startLocation,
          'endLocation': endLocation,
          'startMileage': startMileage,
          if (purpose != null && purpose.isNotEmpty) 'purpose': purpose,
        },
      );
      final data = _unwrap(res);
      return Trip.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Trip> endTrip(
    String vehicleId, {
    required String tripId,
    required double endMileage,
    String? notes,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.vehicleTripEnd(vehicleId),
        data: {
          'tripId': tripId,
          'endMileage': endMileage,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
        },
      );
      final data = _unwrap(res);
      return Trip.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<Trip>> listVehicleTrips(String vehicleId) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.vehicleTrips(vehicleId));
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map>()
          .map((e) => Trip.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<Trip>> listAllTrips() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.tripLogs);
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map>()
          .map((e) => Trip.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<GpsPing>> vehicleHistory(
    String vehicleId, {
    DateTime? from,
    DateTime? to,
    int limit = 1000,
  }) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.vehicleHistory(vehicleId),
        queryParameters: {
          if (from != null) 'from': from.toIso8601String(),
          if (to != null) 'to': to.toIso8601String(),
          'limit': limit,
        },
      );
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map>()
          .map((e) => GpsPing.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Drivers ────────────────────────────────────────────────────────────
  Future<List<Driver>> listDrivers() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.drivers);
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map>()
          .map((e) => Driver.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Driver> getDriver(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.driverById(id));
      final data = _unwrap(res);
      return Driver.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Driver> createDriver({
    required String userId,
    required String licenseNumber,
    required String licenseClass,
    required DateTime licenseExpiry,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.drivers,
        data: {
          'userId': userId,
          'licenseNumber': licenseNumber,
          'licenseClass': licenseClass,
          'licenseExpiry': licenseExpiry.toIso8601String(),
        },
      );
      final data = _unwrap(res);
      return Driver.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Live map / alerts / geofences ──────────────────────────────────────
  Future<List<GpsPing>> liveMap() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.fleetLiveMap);
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map>()
          .map((e) => GpsPing.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<FleetAlert>> listFleetAlerts({int limit = 50}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.fleetAlerts,
        queryParameters: {'limit': limit},
      );
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map>()
          .map((e) => FleetAlert.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
