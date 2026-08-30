import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';

class BillingRemoteDataSource {
  BillingRemoteDataSource(this._dio);
  final Dio _dio;

  Map<String, dynamic> _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic>) {
      if (body.containsKey('data') && body['data'] is Map) {
        return Map<String, dynamic>.from(body['data'] as Map);
      }
      return Map<String, dynamic>.from(body);
    }
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> subscription() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.billingSubscription);
      return _unwrap(res);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> usage() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.billingUsage);
      return _unwrap(res);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> createCheckoutSession(
      Map<String, dynamic> body) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.billingCheckoutSession,
        data: body,
      );
      return _unwrap(res);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
