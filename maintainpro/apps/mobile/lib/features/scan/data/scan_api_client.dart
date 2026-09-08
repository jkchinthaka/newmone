import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'scan_models.dart';

class ScanApiClient {
  ScanApiClient(this._dio);

  final Dio _dio;

  Future<ScanLookupResult> scanLookup(String code) async {
    try {
      final res = await _dio.post<dynamic>(
        '/operations/scan-lookup',
        data: {'code': code},
      );
      final data = _unwrapMap(res.data);
      return ScanLookupResult.fromJson(data);
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  Map<String, dynamic> _unwrapMap(dynamic body) {
    if (body is Map && body['data'] is Map) {
      return Map<String, dynamic>.from(body['data'] as Map);
    }
    if (body is Map) return Map<String, dynamic>.from(body);
    return {};
  }
}

final scanApiClientProvider = Provider<ScanApiClient>((ref) {
  return ScanApiClient(ref.watch(dioProvider));
});
