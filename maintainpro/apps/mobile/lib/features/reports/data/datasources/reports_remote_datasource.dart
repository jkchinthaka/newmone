import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';

class ReportsRemoteDataSource {
  ReportsRemoteDataSource(this._dio);
  final Dio _dio;

  Map<String, dynamic> _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic>) {
      if (body.containsKey('data') && body['data'] is Map) {
        return Map<String, dynamic>.from(body['data'] as Map);
      }
      return Map<String, dynamic>.from(body);
    }
    if (body is List) {
      return {'items': body};
    }
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> _get(String path) async {
    try {
      final res = await _dio.get<dynamic>(path);
      return _unwrap(res);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> dashboard() =>
      _get(ApiEndpoints.reportsDashboard);
  Future<Map<String, dynamic>> maintenanceCost() =>
      _get(ApiEndpoints.reportsMaintenanceCost);
  Future<Map<String, dynamic>> fleetEfficiency() =>
      _get(ApiEndpoints.reportsFleetEfficiency);
  Future<Map<String, dynamic>> downtime() => _get(ApiEndpoints.reportsDowntime);
  Future<Map<String, dynamic>> workOrders() =>
      _get(ApiEndpoints.reportsWorkOrders);
  Future<Map<String, dynamic>> inventory() =>
      _get(ApiEndpoints.reportsInventory);
  Future<Map<String, dynamic>> utilities() =>
      _get(ApiEndpoints.reportsUtilities);
}
