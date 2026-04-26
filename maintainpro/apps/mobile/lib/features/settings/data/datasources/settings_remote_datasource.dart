import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';

class SettingsRemoteDataSource {
  SettingsRemoteDataSource(this._dio);
  final Dio _dio;

  Map<String, dynamic> _unwrapMap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic>) {
      if (body.containsKey('data') && body['data'] is Map) {
        return Map<String, dynamic>.from(body['data'] as Map);
      }
      return Map<String, dynamic>.from(body);
    }
    return <String, dynamic>{};
  }

  List<Map<String, dynamic>> _unwrapList(Response<dynamic> res) {
    final body = res.data;
    final source = body is Map<String, dynamic> && body.containsKey('data')
        ? body['data']
        : body;
    if (source is List) {
      return source
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList(growable: false);
    }
    if (source is Map<String, dynamic>) {
      return [source];
    }
    return const <Map<String, dynamic>>[];
  }

  Future<Map<String, dynamic>> _get(String path) async {
    try {
      final res = await _dio.get<dynamic>(path);
      return _unwrapMap(res);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> _patch(
      String path, Map<String, dynamic> body) async {
    try {
      final res = await _dio.patch<dynamic>(path, data: body);
      return _unwrapMap(res);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> getProfile() =>
      _get(ApiEndpoints.settingsProfile);
  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> body) =>
      _patch(ApiEndpoints.settingsProfile, body);

  Future<Map<String, dynamic>> getOrganization() =>
      _get(ApiEndpoints.settingsOrganization);
  Future<Map<String, dynamic>> updateOrganization(Map<String, dynamic> body) =>
      _patch(ApiEndpoints.settingsOrganization, body);

  Future<Map<String, dynamic>> getSystem() => _get(ApiEndpoints.settingsSystem);
  Future<Map<String, dynamic>> updateSystem(Map<String, dynamic> body) =>
      _patch(ApiEndpoints.settingsSystem, body);

  Future<Map<String, dynamic>> getIntegrations() =>
      _get(ApiEndpoints.settingsIntegrations);
  Future<Map<String, dynamic>> updateIntegrations(Map<String, dynamic> body) =>
      _patch(ApiEndpoints.settingsIntegrations, body);

  Future<Map<String, dynamic>> getFeatureToggles() =>
      _get(ApiEndpoints.settingsFeatureToggles);
  Future<Map<String, dynamic>> updateFeatureToggles(
          Map<String, bool> toggles) =>
      _patch(ApiEndpoints.settingsFeatureToggles, toggles);

  Future<List<Map<String, dynamic>>> getAutomationRules() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.settingsAutomationRules);
      return _unwrapList(res);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<Map<String, dynamic>>> updateAutomationRules(
      List<Map<String, dynamic>> rules) async {
    try {
      final res = await _dio.patch<dynamic>(
        ApiEndpoints.settingsAutomationRules,
        data: {'rules': rules},
      );
      return _unwrapList(res);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<Map<String, dynamic>>> getDigestSchedules() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.settingsDigestSchedules);
      return _unwrapList(res);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<Map<String, dynamic>>> updateDigestSchedules(
      List<Map<String, dynamic>> schedules) async {
    try {
      final res = await _dio.patch<dynamic>(
        ApiEndpoints.settingsDigestSchedules,
        data: {'schedules': schedules},
      );
      return _unwrapList(res);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<Map<String, dynamic>>> getAuditLogs({
    int page = 1,
    int pageSize = 20,
    String? entity,
  }) async {
    try {
      final res = await _dio.get<dynamic>(
        ApiEndpoints.settingsAuditLogs,
        queryParameters: {
          'page': page,
          'pageSize': pageSize,
          if (entity != null && entity.isNotEmpty) 'entity': entity,
        },
      );
      return _unwrapList(res);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
