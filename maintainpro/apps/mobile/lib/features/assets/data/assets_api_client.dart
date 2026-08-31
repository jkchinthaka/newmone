import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'asset_models.dart';

/// Nest client for `/assets`, `/maintenance`, `/job-codes`.
///
/// Read-heavy mobile surfaces. Status/service mutations stay online-required
/// (no outbox) until server idempotency is proven for those paths.
class AssetsApiClient {
  AssetsApiClient(this._dio);

  final Dio _dio;

  static const _assets = '/assets';
  static const _maintenance = '/maintenance';
  static const _jobCodes = '/job-codes';

  Future<T> _guarded<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  Future<AssetListPage> listAssets({
    String? search,
    String? status,
    String? category,
    String? location,
    String? department,
    int page = 1,
    int limit = 20,
  }) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          _assets,
          queryParameters: {
            'page': page,
            'limit': limit,
            if (search != null && search.trim().isNotEmpty)
              'search': search.trim(),
            if (status != null && status.isNotEmpty) 'status': status,
            if (category != null && category.isNotEmpty) 'category': category,
            if (location != null && location.isNotEmpty) 'location': location,
            if (department != null && department.isNotEmpty)
              'department': department,
          },
        );
        return AssetListPage.fromEnvelope(res.data);
      });

  Future<AssetDetail> getAsset(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('$_assets/$id');
        final data = _unwrapMap(res.data);
        return AssetDetail.fromJson(data);
      });

  Future<List<Map<String, dynamic>>> maintenanceHistory(String id) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>('$_assets/$id/maintenance-history');
        final data = _unwrap(res.data);
        if (data is List) {
          return data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        }
        if (data is Map && data['items'] is List) {
          return (data['items'] as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        }
        return const [];
      });

  Future<AssetTagLookup> validateTag(String assetTag) => _guarded(() async {
        final res = await _dio.get<dynamic>(
          '$_assets/validate-tag',
          queryParameters: {'assetTag': assetTag},
        );
        return AssetTagLookup.fromJson(_unwrapMap(res.data));
      });

  Future<List<MaintenanceScheduleSummary>> listSchedules() => _guarded(() async {
        final res = await _dio.get<dynamic>('$_maintenance/schedules');
        final data = _unwrap(res.data);
        final list = data is List
            ? data
            : (data is Map && data['items'] is List)
                ? data['items'] as List
                : const [];
        return list
            .whereType<Map>()
            .map((e) => MaintenanceScheduleSummary.fromJson(
                  Map<String, dynamic>.from(e),
                ))
            .toList();
      });

  Future<MaintenanceScheduleSummary> getSchedule(String id) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>('$_maintenance/schedules/$id');
        return MaintenanceScheduleSummary.fromJson(_unwrapMap(res.data));
      });

  Future<List<JobCodeSummary>> listJobCodes({
    String? q,
    int pageSize = 100,
  }) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          _jobCodes,
          queryParameters: {
            'pageSize': pageSize,
            if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
            'parentId': 'null',
          },
        );
        final data = _unwrap(res.data);
        final list = data is List
            ? data
            : (data is Map && data['items'] is List)
                ? data['items'] as List
                : const [];
        return list
            .whereType<Map>()
            .map((e) => JobCodeSummary.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      });

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

final assetsApiClientProvider = Provider<AssetsApiClient>((ref) {
  return AssetsApiClient(ref.watch(dioProvider));
});
