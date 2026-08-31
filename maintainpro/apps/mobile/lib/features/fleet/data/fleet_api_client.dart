import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../gate/data/gate_models.dart' show GateMovement;
import 'fleet_models.dart';

/// Nest client for `/vehicles/*` and `/drivers`.
///
/// Online-required mutations (never outbox): trip start/end, fuel log,
/// meter reading, assign-driver.
///
/// Idempotency notes:
/// - Trips & meter: server has no Idempotency-Key — rely on [InFlightGuard].
/// - Fuel: optional `clientActionId` in body (service-supported; send UUID).
/// - Do NOT send `occurredAt` from the phone for trips.
class FleetApiClient {
  FleetApiClient(this._dio);

  final Dio _dio;

  static const _vehicles = '/vehicles';
  static const _drivers = '/drivers';

  Future<T> _guarded<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  Future<VehicleListPage> listVehicles({
    String? q,
    String? status,
    int page = 1,
    int pageSize = 20,
  }) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          _vehicles,
          queryParameters: {
            if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
            if (status != null && status.trim().isNotEmpty)
              'status': status.trim(),
            'page': page,
            'pageSize': pageSize,
          },
        );
        return VehicleListPage.fromJson(unwrapFleetData(res.data));
      });

  Future<Vehicle> getVehicle(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('$_vehicles/$id');
        final data = unwrapFleetDataMap(res.data) ?? {};
        return Vehicle.fromJson(data);
      });

  Future<List<VehicleAlert>> getAlerts({int limit = 12}) => _guarded(() async {
        final res = await _dio.get<dynamic>(
          '$_vehicles/alerts',
          queryParameters: {'limit': limit},
        );
        final data = unwrapFleetData(res.data);
        return extractItemList(data, keys: const ['items', 'alerts', 'data'])
            .map(VehicleAlert.fromJson)
            .toList();
      });

  Future<FleetSummary> getSummary() => _guarded(() async {
        final res = await _dio.get<dynamic>('$_vehicles/summary');
        final data = unwrapFleetDataMap(res.data) ?? {};
        return FleetSummary.fromJson(data);
      });

  /// May 403 for roles outside SUPER_ADMIN / ADMIN / ASSET_MANAGER.
  Future<List<DriverSummary>> listDrivers({String? q}) => _guarded(() async {
        final res = await _dio.get<dynamic>(
          _drivers,
          queryParameters: {
            if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
            'pageSize': 50,
          },
        );
        final data = unwrapFleetData(res.data);
        return extractItemList(data).map(DriverSummary.fromJson).toList();
      });

  Future<DriverSummary> getDriver(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('$_drivers/$id');
        final data = unwrapFleetDataMap(res.data) ?? {};
        return DriverSummary.fromJson(data);
      });

  /// Online-only. Requires vehicles.edit.
  Future<Vehicle> assignDriver(String vehicleId, String driverId) =>
      _guarded(() async {
        final res = await _dio.post<dynamic>(
          '$_vehicles/$vehicleId/assign-driver',
          data: {'driverId': driverId},
        );
        final data = unwrapFleetDataMap(res.data) ?? {};
        return Vehicle.fromJson(data);
      });

  /// Online-only. Requires vehicles.edit. Clears active driver assignment.
  Future<Vehicle> unassignDriver(String vehicleId) => _guarded(() async {
        final res = await _dio.post<dynamic>(
          '$_vehicles/$vehicleId/unassign-driver',
        );
        final payload = unwrapFleetDataMap(res.data) ?? {};
        final vehicleMap = payload['vehicle'] is Map
            ? Map<String, dynamic>.from(payload['vehicle'] as Map)
            : payload;
        return Vehicle.fromJson(vehicleMap);
      });

  Future<Map<String, dynamic>> getVehicleHealth(String vehicleId) =>
      _guarded(() async {
        final res =
            await _dio.get<dynamic>('/enterprise-ops/health/$vehicleId');
        return unwrapFleetDataMap(res.data) ?? {};
      });

  /// Online-only. No server Idempotency-Key — use InFlightGuard.
  Future<MeterLog> meterReading(
    String id,
    double reading, {
    String? notes,
    String? source,
  }) =>
      _guarded(() async {
        final body = <String, dynamic>{
          'reading': reading,
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
          if (source != null && source.trim().isNotEmpty)
            'source': source.trim(),
        };
        final res = await _dio.post<dynamic>(
          '$_vehicles/$id/meter-reading',
          data: body,
        );
        final data = unwrapFleetDataMap(res.data) ?? {};
        return MeterLog.fromJson(data);
      });

  Future<List<MeterLog>> listMeterLogs(String id, {int limit = 100}) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '$_vehicles/$id/meter-logs',
          queryParameters: {'limit': limit},
        );
        final data = unwrapFleetData(res.data);
        return extractItemList(data).map(MeterLog.fromJson).toList();
      });

  /// Online-only. Sends [clientActionId] UUID when provided (service supports
  /// it; controller TS type may omit it — Nest inline body still passes through
  /// when ValidationPipe has no DTO class metatype).
  Future<FuelLog> fuelLog(
    String id, {
    required double liters,
    required double costPerLiter,
    required double mileageAtFuel,
    String? driverId,
    String? fuelStation,
    String? notes,
    String? clientActionId,
  }) =>
      _guarded(() async {
        final body = <String, dynamic>{
          'liters': liters,
          'costPerLiter': costPerLiter,
          'mileageAtFuel': mileageAtFuel,
          if (driverId != null && driverId.trim().isNotEmpty)
            'driverId': driverId.trim(),
          if (fuelStation != null && fuelStation.trim().isNotEmpty)
            'fuelStation': fuelStation.trim(),
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
          if (clientActionId != null && clientActionId.trim().isNotEmpty)
            'clientActionId': clientActionId.trim(),
        };
        final res = await _dio.post<dynamic>(
          '$_vehicles/$id/fuel-log',
          data: body,
        );
        final data = unwrapFleetDataMap(res.data) ?? {};
        return FuelLog.fromJson(data);
      });

  Future<List<FuelLog>> listFuelLogs(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('$_vehicles/$id/fuel-logs');
        final data = unwrapFleetData(res.data);
        return extractItemList(data).map(FuelLog.fromJson).toList();
      });

  Future<FuelAnalytics> fuelAnalytics(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('$_vehicles/$id/fuel-analytics');
        final data = unwrapFleetDataMap(res.data) ?? {};
        return FuelAnalytics.fromJson(data);
      });

  /// Online-only. Do NOT send occurredAt. No Idempotency-Key header.
  Future<TripLog> tripStart(
    String id, {
    required String driverId,
    required String startLocation,
    required String endLocation,
    required double startMileage,
    String? purpose,
  }) =>
      _guarded(() async {
        final body = <String, dynamic>{
          'driverId': driverId.trim(),
          'startLocation': startLocation.trim(),
          'endLocation': endLocation.trim(),
          'startMileage': startMileage,
          if (purpose != null && purpose.trim().isNotEmpty)
            'purpose': purpose.trim(),
        };
        body.remove('occurredAt');
        body.remove('startTime');
        final res = await _dio.post<dynamic>(
          '$_vehicles/$id/trip-start',
          data: body,
        );
        final data = unwrapFleetDataMap(res.data) ?? {};
        return TripLog.fromJson(data);
      });

  /// Online-only. Do NOT send occurredAt. No Idempotency-Key header.
  Future<TripLog> tripEnd(
    String id, {
    required String tripId,
    required double endMileage,
    String? notes,
  }) =>
      _guarded(() async {
        final body = <String, dynamic>{
          'tripId': tripId,
          'endMileage': endMileage,
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        };
        body.remove('occurredAt');
        body.remove('endTime');
        final res = await _dio.post<dynamic>(
          '$_vehicles/$id/trip-end',
          data: body,
        );
        final data = unwrapFleetDataMap(res.data) ?? {};
        return TripLog.fromJson(data);
      });

  Future<List<TripLog>> listTrips(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('$_vehicles/$id/trips');
        final data = unwrapFleetData(res.data);
        return extractItemList(data).map(TripLog.fromJson).toList();
      });

  Future<List<GpsHistoryPoint>> listHistory(String id, {int limit = 100}) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '$_vehicles/$id/history',
          queryParameters: {'limit': limit},
        );
        final data = unwrapFleetData(res.data);
        return extractItemList(data).map(GpsHistoryPoint.fromJson).toList();
      });

  Future<List<GateMovement>> listGateMovements(String id, {int limit = 50}) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '$_vehicles/$id/gate-movements',
          queryParameters: {'limit': limit},
        );
        final data = unwrapFleetData(res.data);
        return extractItemList(data, keys: const ['items', 'movements', 'data'])
            .map(GateMovement.fromJson)
            .toList();
      });

  Future<ServiceRule?> getServiceRule(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('$_vehicles/$id/service-rule');
        final data = unwrapFleetDataMap(res.data);
        if (data == null) return null;
        return ServiceRule.fromJson(data);
      });
}

final fleetApiClientProvider = Provider<FleetApiClient>((ref) {
  return FleetApiClient(ref.watch(dioProvider));
});
