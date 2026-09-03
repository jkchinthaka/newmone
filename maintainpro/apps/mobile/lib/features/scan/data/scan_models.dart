class ScanTarget {
  const ScanTarget({
    required this.type,
    required this.id,
    required this.route,
    required this.matchedBy,
    required this.title,
    required this.subtitle,
    this.metadata = const {},
  });

  final String type;
  final String id;
  final String route;
  final String matchedBy;
  final String title;
  final String subtitle;
  final Map<String, dynamic> metadata;

  factory ScanTarget.fromJson(Map<String, dynamic> json) {
    final target = json['target'];
    final map = target is Map
        ? Map<String, dynamic>.from(target)
        : json;
    return ScanTarget(
      type: (map['type'] ?? '').toString(),
      id: (map['id'] ?? '').toString(),
      route: (map['route'] ?? '').toString(),
      matchedBy: (map['matchedBy'] ?? '').toString(),
      title: (map['title'] ?? '').toString(),
      subtitle: (map['subtitle'] ?? '').toString(),
      metadata: map['metadata'] is Map
          ? Map<String, dynamic>.from(map['metadata'] as Map)
          : const {},
    );
  }
}

class ScanLookupResult {
  const ScanLookupResult({
    required this.code,
    required this.normalizedCode,
    required this.target,
  });

  final String code;
  final String normalizedCode;
  final ScanTarget target;

  factory ScanLookupResult.fromJson(Map<String, dynamic> json) {
    return ScanLookupResult(
      code: (json['code'] ?? '').toString(),
      normalizedCode: (json['normalizedCode'] ?? '').toString(),
      target: ScanTarget.fromJson(json),
    );
  }
}

/// Maps authoritative Nest scan target to mobile go_router path.
String? mapScanTargetToMobileRoute({
  required ScanTarget target,
  required bool isSecurityOfficer,
}) {
  switch (target.type.toUpperCase()) {
    case 'VEHICLE':
      return isSecurityOfficer
          ? '/gate/vehicle/${target.id}'
          : '/fleet/vehicles/${target.id}';
    case 'ASSET':
      return '/assets/${target.id}';
    case 'WORK_ORDER':
      return '/work-orders/${target.id}';
    case 'DRIVER':
      return '/fleet/drivers/${target.id}';
    default:
      if (target.route.startsWith('/')) {
        return target.route;
      }
      return null;
  }
}
