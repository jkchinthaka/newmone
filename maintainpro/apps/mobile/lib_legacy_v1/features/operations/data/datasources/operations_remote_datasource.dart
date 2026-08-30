import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/operational_scan_result.dart';

class OperationsRemoteDataSource {
  OperationsRemoteDataSource(this._dio);

  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  Future<OperationalScanResult> scanLookup(String code) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.operationsScanLookup,
        data: {'code': code},
      );
      final data = _unwrap(res);
      return OperationalScanResult.fromJson(
        Map<String, dynamic>.from(data as Map),
      );
    } on DioException catch (error) {
      throw NetworkException.fromDio(error);
    }
  }
}