import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';

/// Remote datasource for Phase 4 traffic fines.
class TrafficFinesRemoteDataSource {
  TrafficFinesRemoteDataSource(this._dio);
  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  Future<List<Map<String, dynamic>>> listFines({
    String? vehicleId,
    String? paymentStatus,
    String? responsibility,
  }) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.trafficFines,
        queryParameters: {
          if (vehicleId != null) 'vehicleId': vehicleId,
          if (paymentStatus != null) 'paymentStatus': paymentStatus,
          if (responsibility != null) 'responsibility': responsibility,
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

  Future<Map<String, dynamic>> createFine({
    required String vehicleId,
    required String fineDate,
    required String offense,
    required double fineAmount,
    String? driverId,
    String? dueDate,
    String? violationCode,
    String? location,
    String? responsibility,
    bool? documentRelated,
    String? relatedDocumentType,
    String? issuingAuthority,
    List<String>? evidenceUrls,
    String? notes,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.trafficFines,
        data: {
          'vehicleId': vehicleId,
          'fineDate': fineDate,
          'offense': offense,
          'fineAmount': fineAmount,
          if (driverId != null) 'driverId': driverId,
          if (dueDate != null) 'dueDate': dueDate,
          if (violationCode != null) 'violationCode': violationCode,
          if (location != null) 'location': location,
          if (responsibility != null) 'responsibility': responsibility,
          if (documentRelated != null) 'documentRelated': documentRelated,
          if (relatedDocumentType != null)
            'relatedDocumentType': relatedDocumentType,
          if (issuingAuthority != null) 'issuingAuthority': issuingAuthority,
          if (evidenceUrls != null) 'evidenceUrls': evidenceUrls,
          if (notes != null) 'notes': notes,
        },
      );
      return Map<String, dynamic>.from(_unwrap(res) as Map);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
