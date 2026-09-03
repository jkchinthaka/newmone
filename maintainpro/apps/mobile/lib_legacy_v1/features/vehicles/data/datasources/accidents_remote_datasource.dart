import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';

/// Remote datasource for Phase 4 accident reporting.
class AccidentsRemoteDataSource {
  AccidentsRemoteDataSource(this._dio);
  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  Future<List<Map<String, dynamic>>> listAccidents({
    String? vehicleId,
    String? status,
  }) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.accidents,
        queryParameters: {
          if (vehicleId != null) 'vehicleId': vehicleId,
          if (status != null) 'status': status,
        },
      );
      final data = _unwrap(res);
      if (data is List) {
        return data
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
      return const [];
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> createAccident({
    required String vehicleId,
    required String occurredAt,
    required String location,
    required String description,
    String? driverId,
    String? severity,
    bool? thirdPartyInvolved,
    String? thirdPartyDetails,
    String? policeReportNo,
    double? estimatedDamageCost,
    String? notes,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.accidents,
        data: {
          'vehicleId': vehicleId,
          'occurredAt': occurredAt,
          'location': location,
          'description': description,
          if (driverId != null) 'driverId': driverId,
          if (severity != null) 'severity': severity,
          if (thirdPartyInvolved != null)
            'thirdPartyInvolved': thirdPartyInvolved,
          if (thirdPartyDetails != null) 'thirdPartyDetails': thirdPartyDetails,
          if (policeReportNo != null) 'policeReportNo': policeReportNo,
          if (estimatedDamageCost != null)
            'estimatedDamageCost': estimatedDamageCost,
          if (notes != null) 'notes': notes,
        },
      );
      return Map<String, dynamic>.from(_unwrap(res) as Map);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> addEvidence({
    required String accidentId,
    required String evidenceType,
    required String fileUrl,
    String? description,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.accidentEvidence(accidentId),
        data: {
          'evidenceType': evidenceType,
          'fileUrl': fileUrl,
          if (description != null) 'description': description,
        },
      );
      return Map<String, dynamic>.from(_unwrap(res) as Map);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
