import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/maintenance_models.dart';

class MaintenanceLogPage {
  MaintenanceLogPage(
      {required this.items, required this.total, required this.page});
  final List<MaintenanceLog> items;
  final int total;
  final int page;
}

class MaintenanceRemoteDataSource {
  MaintenanceRemoteDataSource(this._dio);
  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  // ── Schedules ──
  Future<List<MaintenanceSchedule>> listSchedules() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.maintenanceSchedules);
      final data = _unwrap(res);
      if (data is List) {
        return data
            .whereType<Map>()
            .map((e) =>
                MaintenanceSchedule.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }
      return const [];
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<MaintenanceSchedule> getSchedule(String id) async {
    try {
      final res =
          await _dio.get<dynamic>(ApiEndpoints.maintenanceScheduleById(id));
      final data = _unwrap(res);
      return MaintenanceSchedule.fromJson(
          Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<MaintenanceSchedule> createSchedule({
    required String name,
    String? description,
    required String type,
    required String frequency,
    int? intervalDays,
    double? intervalMileage,
    String? assetId,
    String? vehicleId,
    DateTime? nextDueDate,
    double? nextDueMileage,
    double? estimatedCost,
    double? estimatedHours,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.maintenanceSchedules,
        data: {
          'name': name,
          if (description != null) 'description': description,
          'type': type,
          'frequency': frequency,
          if (intervalDays != null) 'intervalDays': intervalDays,
          if (intervalMileage != null) 'intervalMileage': intervalMileage,
          if (assetId != null) 'assetId': assetId,
          if (vehicleId != null) 'vehicleId': vehicleId,
          if (nextDueDate != null)
            'nextDueDate': nextDueDate.toUtc().toIso8601String(),
          if (nextDueMileage != null) 'nextDueMileage': nextDueMileage,
          if (estimatedCost != null) 'estimatedCost': estimatedCost,
          if (estimatedHours != null) 'estimatedHours': estimatedHours,
        },
      );
      final data = _unwrap(res);
      return MaintenanceSchedule.fromJson(
          Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<MaintenanceSchedule> updateSchedule(
    String id, {
    bool? isActive,
    DateTime? nextDueDate,
    double? nextDueMileage,
  }) async {
    try {
      final res = await _dio.patch<dynamic>(
        ApiEndpoints.maintenanceScheduleById(id),
        data: {
          if (isActive != null) 'isActive': isActive,
          if (nextDueDate != null)
            'nextDueDate': nextDueDate.toUtc().toIso8601String(),
          if (nextDueMileage != null) 'nextDueMileage': nextDueMileage,
        },
      );
      final data = _unwrap(res);
      return MaintenanceSchedule.fromJson(
          Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<void> deleteSchedule(String id) async {
    try {
      await _dio.delete<dynamic>(ApiEndpoints.maintenanceScheduleById(id));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Logs ──
  Future<MaintenanceLogPage> listLogs(
      {String? vehicleId, int page = 1, int pageSize = 20}) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.maintenanceLogs,
        queryParameters: {
          if (vehicleId != null) 'vehicleId': vehicleId,
          'page': page,
          'pageSize': pageSize,
        },
      );
      final data = _unwrap(res);
      if (data is Map) {
        final items = (data['items'] as List?) ?? const [];
        final pag = (data['pagination'] as Map?) ?? const {};
        return MaintenanceLogPage(
          items: items
              .whereType<Map>()
              .map((e) => MaintenanceLog.fromJson(Map<String, dynamic>.from(e)))
              .toList(),
          total: (pag['total'] as num?)?.toInt() ?? items.length,
          page: (pag['page'] as num?)?.toInt() ?? page,
        );
      }
      return MaintenanceLogPage(items: const [], total: 0, page: page);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<MaintenanceLog> createLog({
    String? scheduleId,
    String? assetId,
    String? vehicleId,
    String? workOrderId,
    required String description,
    required String performedBy,
    required DateTime performedAt,
    double? cost,
    String? notes,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.maintenanceLogs,
        data: {
          if (scheduleId != null) 'scheduleId': scheduleId,
          if (assetId != null) 'assetId': assetId,
          if (vehicleId != null) 'vehicleId': vehicleId,
          if (workOrderId != null) 'workOrderId': workOrderId,
          'description': description,
          'performedBy': performedBy,
          'performedAt': performedAt.toUtc().toIso8601String(),
          if (cost != null) 'cost': cost,
          if (notes != null) 'notes': notes,
        },
      );
      final data = _unwrap(res);
      return MaintenanceLog.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Calendar ──
  Future<List<MaintenanceCalendarEntry>> calendar() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.maintenanceCalendar);
      final data = _unwrap(res);
      if (data is List) {
        return data
            .whereType<Map>()
            .map((e) =>
                MaintenanceCalendarEntry.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }
      return const [];
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  // ── Predictive alerts ──
  Future<List<PredictiveAlert>> predictiveAlerts() async {
    try {
      final res =
          await _dio.get<dynamic>(ApiEndpoints.maintenancePredictiveAlerts);
      final data = _unwrap(res);
      if (data is List) {
        return data
            .whereType<Map>()
            .map((e) => PredictiveAlert.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }
      return const [];
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<void> acknowledgePredictiveAlert(String id) async {
    try {
      await _dio.post<dynamic>(ApiEndpoints.maintenancePredictiveAlertAck(id));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
