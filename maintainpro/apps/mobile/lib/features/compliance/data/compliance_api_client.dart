import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'compliance_models.dart';

class ComplianceApiClient {
  ComplianceApiClient(this._dio);

  final Dio _dio;

  Future<T> _guarded<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  Future<ComplianceSummary> complianceSummary() => _guarded(() async {
        final res = await _dio.get<dynamic>('/compliance/summary');
        return ComplianceSummary.fromJson(_unwrapMap(res.data));
      });

  Future<List<VehicleDocumentSummary>> expiringDocuments({int days = 30}) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/compliance/expiring-documents',
          queryParameters: {'days': days},
        );
        return _list(res.data, VehicleDocumentSummary.fromJson);
      });

  Future<VehicleDocumentSummary> getVehicleDocument(String id) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>('/vehicle-documents/$id');
        return VehicleDocumentSummary.fromJson(_unwrapMap(res.data));
      });

  Future<List<AccidentSummary>> listAccidents({String? vehicleId}) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/accidents',
          queryParameters: {
            if (vehicleId != null && vehicleId.isNotEmpty) 'vehicleId': vehicleId,
          },
        );
        return _list(res.data, AccidentSummary.fromJson);
      });

  Future<AccidentSummary> getAccident(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('/accidents/$id');
        return AccidentSummary.fromJson(_unwrapMap(res.data));
      });

  Future<AccidentSummary> reportAccident(Map<String, dynamic> body) =>
      _guarded(() async {
        final res = await _dio.post<dynamic>('/accidents', data: body);
        return AccidentSummary.fromJson(_unwrapMap(res.data));
      });

  Future<List<InsuranceClaimSummary>> listInsuranceClaims({String? vehicleId}) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/insurance-claims',
          queryParameters: {
            if (vehicleId != null && vehicleId.isNotEmpty) 'vehicleId': vehicleId,
          },
        );
        return _list(res.data, InsuranceClaimSummary.fromJson);
      });

  Future<InsuranceClaimSummary> getInsuranceClaim(String id) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>('/insurance-claims/$id');
        return InsuranceClaimSummary.fromJson(_unwrapMap(res.data));
      });

  Future<List<TrafficFineSummary>> listTrafficFines({String? vehicleId}) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/traffic-fines',
          queryParameters: {
            if (vehicleId != null && vehicleId.isNotEmpty) 'vehicleId': vehicleId,
          },
        );
        return _list(res.data, TrafficFineSummary.fromJson);
      });

  Future<TrafficFineSummary> getTrafficFine(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('/traffic-fines/$id');
        return TrafficFineSummary.fromJson(_unwrapMap(res.data));
      });

  List<T> _list<T>(
    dynamic body,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    final data = _unwrap(body);
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    return const [];
  }

  dynamic _unwrap(dynamic body) {
    if (body is Map && body.containsKey('data')) return body['data'];
    return body;
  }

  Map<String, dynamic> _unwrapMap(dynamic body) {
    final data = _unwrap(body);
    if (data is Map) return Map<String, dynamic>.from(data);
    return {};
  }
}

final complianceApiClientProvider = Provider<ComplianceApiClient>((ref) {
  return ComplianceApiClient(ref.watch(dioProvider));
});
