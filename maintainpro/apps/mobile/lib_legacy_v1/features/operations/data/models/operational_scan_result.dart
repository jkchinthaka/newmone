enum OperationalScanTargetType {
  asset,
  vehicle,
  driver,
  workOrder,
}

class OperationalScanTarget {
  const OperationalScanTarget({
    required this.type,
    required this.id,
    required this.route,
    required this.matchedBy,
    required this.title,
    required this.subtitle,
    required this.metadata,
  });

  final OperationalScanTargetType type;
  final String id;
  final String route;
  final String matchedBy;
  final String title;
  final String subtitle;
  final Map<String, dynamic> metadata;

  factory OperationalScanTarget.fromJson(Map<String, dynamic> json) {
    return OperationalScanTarget(
      type: _parseType(json['type']?.toString()),
      id: (json['id'] ?? '').toString(),
      route: (json['route'] ?? '').toString(),
      matchedBy: (json['matchedBy'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      subtitle: (json['subtitle'] ?? '').toString(),
      metadata: Map<String, dynamic>.from(
        (json['metadata'] as Map?) ?? const <String, dynamic>{},
      ),
    );
  }

  static OperationalScanTargetType _parseType(String? raw) {
    switch ((raw ?? '').trim().toUpperCase()) {
      case 'ASSET':
        return OperationalScanTargetType.asset;
      case 'VEHICLE':
        return OperationalScanTargetType.vehicle;
      case 'DRIVER':
        return OperationalScanTargetType.driver;
      case 'WORK_ORDER':
        return OperationalScanTargetType.workOrder;
      default:
        return OperationalScanTargetType.asset;
    }
  }
}

class OperationalScanResult {
  const OperationalScanResult({
    required this.code,
    required this.normalizedCode,
    required this.target,
  });

  final String code;
  final String normalizedCode;
  final OperationalScanTarget target;

  factory OperationalScanResult.fromJson(Map<String, dynamic> json) {
    return OperationalScanResult(
      code: (json['code'] ?? '').toString(),
      normalizedCode: (json['normalizedCode'] ?? '').toString(),
      target: OperationalScanTarget.fromJson(
        Map<String, dynamic>.from((json['target'] as Map?) ?? const {}),
      ),
    );
  }
}