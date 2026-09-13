import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';

/// Remote datasource for Phase 4 vehicle documents / compliance.
///
/// Returns raw maps/lists from the API. Callers can map to typed models.
class VehicleDocumentsRemoteDataSource {
  VehicleDocumentsRemoteDataSource(this._dio);
  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  Future<List<Map<String, dynamic>>> listDocuments(String vehicleId) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.vehicleDocuments(vehicleId),
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

  Future<Map<String, dynamic>> uploadDocument({
    required String vehicleId,
    required String documentType,
    required String expiryDate,
    String? documentNumber,
    String? issuedDate,
    String? issuingAuthority,
    String? fileUrl,
    String? notes,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.vehicleDocuments(vehicleId),
        data: {
          'documentType': documentType,
          'expiryDate': expiryDate,
          if (documentNumber != null) 'documentNumber': documentNumber,
          if (issuedDate != null) 'issuedDate': issuedDate,
          if (issuingAuthority != null) 'issuingAuthority': issuingAuthority,
          if (fileUrl != null) 'fileUrl': fileUrl,
          if (notes != null) 'notes': notes,
        },
      );
      final data = _unwrap(res);
      return Map<String, dynamic>.from(data as Map);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> verifyDocument(String documentId) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.vehicleDocumentVerify(documentId),
      );
      return Map<String, dynamic>.from(_unwrap(res) as Map);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> rejectDocument(
    String documentId, {
    required String reason,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.vehicleDocumentReject(documentId),
        data: {'reason': reason},
      );
      return Map<String, dynamic>.from(_unwrap(res) as Map);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> getVehicleCompliance(String vehicleId) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.complianceVehicle(vehicleId),
      );
      return Map<String, dynamic>.from(_unwrap(res) as Map);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> getComplianceOverview() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.complianceOverview);
      return Map<String, dynamic>.from(_unwrap(res) as Map);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
