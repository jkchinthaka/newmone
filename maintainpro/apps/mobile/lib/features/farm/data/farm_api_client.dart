import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../admin/data/admin_models.dart' show asMapList, unwrapData;

class FarmRow {
  const FarmRow({required this.id, required this.title, this.subtitle, this.status});

  final String id;
  final String title;
  final String? subtitle;
  final String? status;

  factory FarmRow.fromJson(Map<String, dynamic> json, {String titleKey = 'name'}) {
    return FarmRow(
      id: (json['id'] ?? '').toString(),
      title: (json[titleKey] ?? json['fullName'] ?? json['batchCode'] ?? 'Record')
          .toString(),
      subtitle: [
        if (json['code'] != null) json['code'].toString(),
        if (json['species'] != null) json['species'].toString(),
        if (json['fieldName'] != null) json['fieldName'].toString(),
        if (json['status'] != null) json['status'].toString(),
      ].where((e) => e.isNotEmpty).join(' · '),
      status: json['status']?.toString(),
    );
  }
}

class FarmApiClient {
  FarmApiClient(this._dio);

  final Dio _dio;

  Future<T> _guarded<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  Future<List<FarmRow>> listFields({String? status}) => _list('/farm/fields', status: status);
  Future<List<FarmRow>> listCrops({String? status, String? fieldId}) =>
      _list('/farm/crops', status: status, extra: {'fieldId': fieldId});
  Future<List<FarmRow>> listHarvest({String? cropCycleId}) =>
      _list('/farm/harvest', extra: {'cropCycleId': cropCycleId});
  Future<List<FarmRow>> listLivestock({String? species, String? status}) =>
      _list('/farm/livestock/animals', status: status, extra: {'species': species});
  Future<List<FarmRow>> listIrrigation({String? fieldId}) =>
      _list('/farm/irrigation', extra: {'fieldId': fieldId});
  Future<List<FarmRow>> listWorkers({String? status}) =>
      _list('/farm/workers', status: status);
  Future<List<FarmRow>> listAttendance({String? from, String? to}) =>
      _list('/farm/workers/attendance', extra: {'from': from, 'to': to});
  Future<List<FarmRow>> listTraceability() => _list('/farm/traceability');

  Future<Map<String, dynamic>> overview() => _guarded(() async {
        final fields = await listFields();
        final crops = await listCrops();
        final livestock = await listLivestock();
        return {
          'fields': fields.length,
          'crops': crops.length,
          'livestock': livestock.length,
        };
      });

  Future<List<FarmRow>> _list(
    String path, {
    String? status,
    Map<String, String?> extra = const {},
  }) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          path,
          queryParameters: {
            if (status != null && status.isNotEmpty) 'status': status,
            for (final e in extra.entries)
              if (e.value != null && e.value!.isNotEmpty) e.key: e.value,
          },
        );
        final data = unwrapData(res.data);
        return asMapList(data).map((e) => FarmRow.fromJson(e)).toList();
      });
}

final farmApiClientProvider = Provider<FarmApiClient>((ref) {
  return FarmApiClient(ref.watch(dioProvider));
});
