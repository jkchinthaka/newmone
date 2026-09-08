import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/network/network_exceptions.dart';
import '../../data/models/dashboard_summary.dart';

class DashboardRemoteDataSource {
  DashboardRemoteDataSource(this._dio);

  final Dio _dio;

  Future<DashboardSummary> fetch() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.dashboard);
      final body = res.data;
      Map<String, dynamic> payload = const {};
      if (body is Map<String, dynamic>) {
        final data = body['data'];
        payload = data is Map<String, dynamic> ? data : body;
      }
      return DashboardSummary.fromJson(payload);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}

final dashboardRemoteProvider = Provider<DashboardRemoteDataSource>((ref) {
  return DashboardRemoteDataSource(ref.watch(dioProvider));
});

final dashboardProvider = FutureProvider.autoDispose<DashboardSummary>((ref) {
  return ref.watch(dashboardRemoteProvider).fetch();
});
