enum FieldInsightCategory { maintenance, fleet, utilities, inventory, unknown }

enum FieldInsightSeverity { info, warning, critical }

FieldInsightCategory _categoryFromApi(String? raw) {
  switch ((raw ?? '').trim().toUpperCase()) {
    case 'MAINTENANCE':
      return FieldInsightCategory.maintenance;
    case 'FLEET':
      return FieldInsightCategory.fleet;
    case 'UTILITIES':
      return FieldInsightCategory.utilities;
    case 'INVENTORY':
      return FieldInsightCategory.inventory;
    default:
      return FieldInsightCategory.unknown;
  }
}

FieldInsightSeverity _severityFromApi(String? raw) {
  switch ((raw ?? '').trim().toUpperCase()) {
    case 'CRITICAL':
      return FieldInsightSeverity.critical;
    case 'WARNING':
      return FieldInsightSeverity.warning;
    default:
      return FieldInsightSeverity.info;
  }
}

class FieldInsight {
  const FieldInsight({
    required this.id,
    required this.category,
    required this.severity,
    required this.title,
    required this.message,
    this.route,
    this.suggestedAction,
  });

  factory FieldInsight.fromJson(Map<String, dynamic> json) {
    return FieldInsight(
      id: json['id']?.toString() ?? '',
      category: _categoryFromApi(json['category']?.toString()),
      severity: _severityFromApi(json['severity']?.toString()),
      title: (json['title'] ?? '').toString(),
      message: (json['message'] ?? '').toString(),
      route: json['route']?.toString(),
      suggestedAction: json['suggestedAction']?.toString(),
    );
  }

  final String id;
  final FieldInsightCategory category;
  final FieldInsightSeverity severity;
  final String title;
  final String message;
  final String? route;
  final String? suggestedAction;

  bool get hasRoute => route != null && route!.isNotEmpty;
}

class FieldInsightsSnapshot {
  const FieldInsightsSnapshot({
    this.generatedAt,
    this.focusArea = 'GENERAL',
    this.mode = 'PREDICT',
    this.smartSuggestions = const [],
    this.insights = const [],
  });

  factory FieldInsightsSnapshot.fromJson(Map<String, dynamic> json) {
    return FieldInsightsSnapshot(
      generatedAt: DateTime.tryParse(json['generatedAt']?.toString() ?? ''),
      focusArea: (json['focusArea'] ?? 'GENERAL').toString(),
      mode: (json['mode'] ?? 'PREDICT').toString(),
      smartSuggestions: (json['smartSuggestions'] as List?)
              ?.map((value) => value.toString())
              .toList() ??
          const [],
      insights: (json['insights'] as List?)
              ?.whereType<Map>()
              .map((value) =>
                  FieldInsight.fromJson(Map<String, dynamic>.from(value)))
              .toList() ??
          const [],
    );
  }

  final DateTime? generatedAt;
  final String focusArea;
  final String mode;
  final List<String> smartSuggestions;
  final List<FieldInsight> insights;
}