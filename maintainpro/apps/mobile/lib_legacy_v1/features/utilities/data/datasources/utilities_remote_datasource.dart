import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/utility_models.dart';

class UtilitiesRemoteDataSource {
  UtilitiesRemoteDataSource(this._dio);
  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  List<T> _list<T>(dynamic data, T Function(Map<String, dynamic>) of) {
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => of(Map<String, dynamic>.from(e)))
          .toList();
    }
    return const [];
  }

  Future<List<UtilityMeter>> meters() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.utilityMeters);
      return _list(_unwrap(res), UtilityMeter.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<UtilityMeter> meter(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.utilityMeterById(id));
      return UtilityMeter.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<UtilityMeter> createMeter({
    required String meterNumber,
    required String type,
    required String location,
    required String unit,
    String? description,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.utilityMeters,
        data: {
          'meterNumber': meterNumber,
          'type': type,
          'location': location,
          'unit': unit,
          if (description != null) 'description': description,
        },
      );
      return UtilityMeter.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<MeterReading> addReading(
    String meterId, {
    required DateTime readingDate,
    required double readingValue,
    String? notes,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.utilityMeterReadings(meterId),
        data: {
          'readingDate': readingDate.toUtc().toIso8601String(),
          'readingValue': readingValue,
          if (notes != null) 'notes': notes,
        },
      );
      return MeterReading.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<MeterReading>> readings(String meterId) async {
    try {
      final res =
          await _dio.get<dynamic>(ApiEndpoints.utilityMeterReadings(meterId));
      return _list(_unwrap(res), MeterReading.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<UtilityBill>> bills() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.utilityBills);
      return _list(_unwrap(res), UtilityBill.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<UtilityBill> bill(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.utilityBillById(id));
      return UtilityBill.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<UtilityBill> payBill(String id) async {
    try {
      final res = await _dio.patch<dynamic>(ApiEndpoints.utilityBillPay(id));
      return UtilityBill.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<UtilityBill>> overdueBills() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.utilityBillsOverdue);
      return _list(_unwrap(res), UtilityBill.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<UtilityAnalytics> analytics() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.utilityAnalytics);
      return UtilityAnalytics.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
