import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../report_filter_bar.dart';
import 'reports_models.dart';

class ReportsApiClient {
  ReportsApiClient(this._dio);

  final Dio _dio;

  Future<T> _guarded<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  Future<ReportDashboard> dashboard({
    String? startDate,
    String? endDate,
  }) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/reports/dashboard',
          queryParameters: {
            if (startDate != null) 'startDate': startDate,
            if (endDate != null) 'endDate': endDate,
          },
        );
        return ReportDashboard.fromJson(unwrapDataMap(res.data));
      });

  Future<ReportDashboard> dashboardFiltered(ReportFilterParams filters) =>
      dashboard(startDate: filters.startDate, endDate: filters.endDate);

  Future<ReportModulePage> moduleReport(
    String module, {
    ReportFilterParams? filters,
    String? startDate,
    String? endDate,
    String? status,
    String? search,
    int page = 1,
    int pageSize = 20,
  }) =>
      _guarded(() async {
        final query = filters?.toQuery() ??
            {
              if (startDate != null) 'startDate': startDate,
              if (endDate != null) 'endDate': endDate,
              if (status != null && status.isNotEmpty) 'status': status,
              if (search != null && search.isNotEmpty) 'search': search,
              'page': page,
              'pageSize': pageSize,
            };
        final res = await _dio.get<dynamic>(
          '/reports/$module',
          queryParameters: query,
        );
        final map = unwrapDataMap(res.data);
        if (map.isEmpty && res.data is Map) {
          return ReportModulePage.fromJson(Map<String, dynamic>.from(res.data as Map));
        }
        return ReportModulePage.fromJson(map);
      });

  Future<Map<String, dynamic>> managementSummary({
    String? dateFrom,
    String? dateTo,
  }) =>
      _guarded(() async {
        final res = await _dio.get<dynamic>(
          '/reports/management/profitability/summary',
          queryParameters: {
            if (dateFrom != null) 'dateFrom': dateFrom,
            if (dateTo != null) 'dateTo': dateTo,
          },
        );
        return unwrapDataMap(res.data);
      });

  Future<List<MaintenanceExceptionCard>> maintenanceExceptions() =>
      _guarded(() async {
        final res = await _dio.get<dynamic>('/reports/maintenance/exceptions');
        final data = unwrapData(res.data);
        final map = asMap(data) ?? {};
        final cards = asMapList(map['cards'] ?? data);
        return cards.map(MaintenanceExceptionCard.fromJson).toList();
      });

  Future<Map<String, dynamic>> erpMonitoring() => _guarded(() async {
        final res = await _dio.get<dynamic>('/reports/erp-monitoring');
        return unwrapDataMap(res.data);
      });

  Future<Map<String, dynamic>> facilitiesAging() => _guarded(() async {
        final res = await _dio.get<dynamic>('/facilities/reports/aging');
        return unwrapDataMap(res.data);
      });

  Future<Map<String, dynamic>> enterpriseOpsDashboard() => _guarded(() async {
        final res = await _dio.get<dynamic>('/enterprise-ops/dashboard');
        return unwrapDataMap(res.data);
      });

  /// Downloads report export bytes from `GET /reports/:module/export`.
  Future<ReportExportResult> exportModuleReport(
    String module, {
    required String format,
    ReportFilterParams? filters,
  }) =>
      _guarded(() async {
        final res = await _dio.get<List<int>>(
          '/reports/$module/export',
          queryParameters: {
            'format': format,
            ...?filters?.toQuery(),
          },
          options: Options(responseType: ResponseType.bytes),
        );
        final headers = res.headers;
        final contentType = headers.value('content-type') ?? 'application/octet-stream';
        final disposition = headers.value('content-disposition') ?? '';
        final fileName = _fileNameFromDisposition(disposition) ??
            'maintainpro-$module.$format';
        return ReportExportResult(
          bytes: res.data ?? const [],
          fileName: fileName,
          contentType: contentType,
          truncated: headers.value('x-export-truncated') == 'true',
        );
      });

  String? _fileNameFromDisposition(String disposition) {
    final match = RegExp(r'filename="?([^";]+)"?').firstMatch(disposition);
    return match?.group(1);
  }
}

class ReportExportResult {
  const ReportExportResult({
    required this.bytes,
    required this.fileName,
    required this.contentType,
    this.truncated = false,
  });

  final List<int> bytes;
  final String fileName;
  final String contentType;
  final bool truncated;
}

final reportsApiClientProvider = Provider<ReportsApiClient>((ref) {
  return ReportsApiClient(ref.watch(dioProvider));
});
