import '../../admin/data/admin_models.dart';

export '../../admin/data/admin_models.dart' show asMap, asMapList, unwrapData, unwrapDataMap, unwrapDataList;

class ReportKpiCard {
  const ReportKpiCard({
    required this.label,
    required this.value,
    this.subLabel,
    this.keyName,
    this.unit,
    this.coverageStatus,
  });

  final String label;
  final String value;
  final String? subLabel;
  final String? keyName;
  final String? unit;
  final String? coverageStatus;

  factory ReportKpiCard.fromJson(Map<String, dynamic> json) {
    final rawValue = json['value'] ?? json['amount'];
    return ReportKpiCard(
      label: (json['label'] ?? json['key'] ?? 'KPI').toString(),
      value: rawValue?.toString() ?? 'Unavailable',
      subLabel: (json['subLabel'] ?? json['coverageStatus'])?.toString(),
      keyName: json['key']?.toString(),
      unit: json['unit']?.toString(),
      coverageStatus: json['coverageStatus']?.toString(),
    );
  }
}

class ReportDashboard {
  const ReportDashboard({
    this.cards = const [],
    this.summaryCards = const [],
    this.raw = const {},
  });

  final List<ReportKpiCard> cards;
  final List<ReportKpiCard> summaryCards;
  final Map<String, dynamic> raw;

  factory ReportDashboard.fromJson(Map<String, dynamic> json) {
    final cards = asMapList(json['cards']).map(ReportKpiCard.fromJson).toList();
    final summary =
        asMapList(json['summaryCards']).map(ReportKpiCard.fromJson).toList();
    return ReportDashboard(
      cards: cards,
      summaryCards: summary,
      raw: json,
    );
  }
}

class ReportModulePage {
  const ReportModulePage({
    this.title,
    this.rows = const [],
    this.columns = const [],
    this.kpis = const [],
    this.page = 1,
    this.pageSize = 15,
    this.total = 0,
    this.raw = const {},
  });

  final String? title;
  final List<Map<String, dynamic>> rows;
  final List<String> columns;
  final List<ReportKpiCard> kpis;
  final int page;
  final int pageSize;
  final int total;
  final Map<String, dynamic> raw;

  factory ReportModulePage.fromJson(Map<String, dynamic> json) {
    final table = asMap(json['table']) ?? asMap(json['data']) ?? json;
    final rows = asMapList(table['rows'] ?? table['items'] ?? json['rows'] ?? json['items']);
    final colsRaw = table['columns'] ?? json['columns'];
    final columns = colsRaw is List
        ? colsRaw.map((e) {
            if (e is Map) return (e['key'] ?? e['label'] ?? e).toString();
            return e.toString();
          }).toList()
        : (rows.isNotEmpty ? rows.first.keys.map((k) => k.toString()).toList() : <String>[]);
    final meta = asMap(json['meta']) ?? asMap(table['pagination']) ?? {};
    return ReportModulePage(
      title: (json['title'] ?? json['module'] ?? table['title'])?.toString(),
      rows: rows,
      columns: columns,
      kpis: asMapList(json['cards'] ?? json['kpis']).map(ReportKpiCard.fromJson).toList(),
      page: (meta['page'] as num?)?.toInt() ?? 1,
      pageSize: (meta['pageSize'] as num?)?.toInt() ??
          (meta['limit'] as num?)?.toInt() ??
          15,
      total: (meta['total'] as num?)?.toInt() ?? rows.length,
      raw: json,
    );
  }
}

class MaintenanceExceptionCard {
  const MaintenanceExceptionCard({
    required this.type,
    required this.label,
    required this.count,
  });

  final String type;
  final String label;
  final int count;

  factory MaintenanceExceptionCard.fromJson(Map<String, dynamic> json) {
    return MaintenanceExceptionCard(
      type: (json['type'] ?? json['exceptionType'] ?? '').toString(),
      label: (json['label'] ?? json['title'] ?? json['type'] ?? 'Exception')
          .toString(),
      count: (json['count'] as num?)?.toInt() ??
          (json['total'] as num?)?.toInt() ??
          0,
    );
  }
}

/// Module keys allowlisted by Nest reports controller.
const kReportModules = <String, String>{
  'operations': 'Operations',
  'assets': 'Assets',
  'inventory': 'Inventory',
  'financials': 'Financials',
  'performance': 'Performance',
  'user-activity': 'User activity',
  'system-logs': 'System logs',
  'driver-intelligence': 'Driver intelligence',
  'fuel-analytics': 'Fuel analytics',
  'vehicle-cost-analytics': 'Vehicle cost',
};
