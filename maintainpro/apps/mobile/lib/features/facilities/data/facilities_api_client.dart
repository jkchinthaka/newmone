import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'facilities_models.dart';

/// Read-only Nest client for facilities, cleaning, utilities.
class FacilitiesApiClient {
  FacilitiesApiClient(this._dio);

  final Dio _dio;

  Future<T> _guarded<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  Future<List<PropertySummary>> listProperties({String? q}) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/facilities/properties',
          queryParameters: {if (q != null && q.isNotEmpty) 'q': q},
        );
        return _list(res.data, PropertySummary.fromJson);
      });

  Future<List<RoomSummary>> listRooms({String? q}) => _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/facilities/rooms',
          queryParameters: {if (q != null && q.isNotEmpty) 'q': q},
        );
        return _list(res.data, RoomSummary.fromJson);
      });

  Future<RoomSummary> getRoom(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('/facilities/rooms/$id');
        return RoomSummary.fromJson(_unwrapMap(res.data));
      });

  Future<List<FacilityIssueSummary>> listIssues({String? status}) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/cleaning/issues',
          queryParameters: {if (status != null && status.isNotEmpty) 'status': status},
        );
        return _list(res.data, FacilityIssueSummary.fromJson);
      });

  Future<FacilityIssueSummary> getIssue(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('/cleaning/issues/$id');
        return FacilityIssueSummary.fromJson(_unwrapMap(res.data));
      });

  Future<FacilityIssueSummary> createIssue(Map<String, dynamic> body) =>
      _guarded(() async {
        final res = await _dio.post<dynamic>('/cleaning/issues', data: body);
        return FacilityIssueSummary.fromJson(_unwrapMap(res.data));
      });

  Future<DuplicateIssueCheckResult> checkDuplicateIssues(
    Map<String, dynamic> body,
  ) =>
      _guarded(() async {
        final res = await _dio.post<dynamic>(
          '/cleaning/issues/duplicate-check',
          data: body,
        );
        return DuplicateIssueCheckResult.fromJson(_unwrapMap(res.data));
      });

  Future<List<CleaningVisitSummary>> listCleaningVisits({
    int page = 1,
    int pageSize = 20,
    String? status,
  }) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/cleaning/visits',
          queryParameters: {
            'page': page,
            'pageSize': pageSize,
            if (status != null && status.isNotEmpty) 'status': status,
          },
        );
        final data = _unwrap(res.data);
        if (data is Map && data['items'] is List) {
          return (data['items'] as List)
              .whereType<Map>()
              .map((e) => CleaningVisitSummary.fromJson(
                    Map<String, dynamic>.from(e),
                  ))
              .toList();
        }
        return _list(res.data, CleaningVisitSummary.fromJson);
      });

  Future<List<CleaningLocationSummary>> listCleaningLocations() =>
      _guarded(() async {
        final res = await _dio.get<dynamic>('/cleaning/locations');
        return _list(res.data, CleaningLocationSummary.fromJson);
      });

  Future<List<UtilityMeterSummary>> listMeters() => _guarded(() async {
        final res = await _dio.get<dynamic>('/utilities/meters');
        return _list(res.data, UtilityMeterSummary.fromJson);
      });

  Future<UtilityMeterSummary> getMeter(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('/utilities/meters/$id');
        return UtilityMeterSummary.fromJson(_unwrapMap(res.data));
      });

  Future<List<MeterReadingSummary>> meterReadings(String meterId) =>
      _guarded(() async {
        final res =
            await _dio.get<dynamic>('/utilities/meters/$meterId/readings');
        return _list(res.data, MeterReadingSummary.fromJson);
      });

  List<T> _list<T>(
    dynamic body,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    final data = _unwrap(body);
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    return const [];
  }

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

final facilitiesApiClientProvider = Provider<FacilitiesApiClient>((ref) {
  return FacilitiesApiClient(ref.watch(dioProvider));
});
