class DashboardSummary {
  DashboardSummary({
    required this.openWorkOrders,
    required this.criticalAlerts,
    required this.assetsTotal,
    required this.assetsDown,
    required this.maintenanceDue,
    required this.fleetActive,
    required this.fuelMonthLiters,
    required this.recent,
  });

  final int openWorkOrders;
  final int criticalAlerts;
  final int assetsTotal;
  final int assetsDown;
  final int maintenanceDue;
  final int fleetActive;
  final double fuelMonthLiters;
  final List<DashboardRecent> recent;

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    int n(dynamic v) {
      if (v is num) return v.toInt();
      if (v is String) return int.tryParse(v) ?? 0;
      return 0;
    }

    double d(dynamic v) {
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v) ?? 0;
      return 0;
    }

    final recentRaw = json['recent'];
    final recent = <DashboardRecent>[];
    if (recentRaw is List) {
      for (final item in recentRaw) {
        if (item is Map<String, dynamic>) {
          recent.add(DashboardRecent.fromJson(item));
        }
      }
    }

    return DashboardSummary(
      openWorkOrders: n(json['openWorkOrders'] ?? json['open']),
      criticalAlerts: n(json['criticalAlerts'] ?? json['alerts']),
      assetsTotal: n(json['assetsTotal']),
      assetsDown: n(json['assetsDown']),
      maintenanceDue: n(json['maintenanceDue']),
      fleetActive: n(json['fleetActive']),
      fuelMonthLiters: d(json['fuelMonthLiters'] ?? json['fuelLiters']),
      recent: recent,
    );
  }

  static DashboardSummary empty() => DashboardSummary(
        openWorkOrders: 0,
        criticalAlerts: 0,
        assetsTotal: 0,
        assetsDown: 0,
        maintenanceDue: 0,
        fleetActive: 0,
        fuelMonthLiters: 0,
        recent: const [],
      );
}

class DashboardRecent {
  DashboardRecent({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.kind,
    this.status,
    this.priority,
  });

  final String id;
  final String title;
  final String subtitle;
  final String kind;
  final String? status;
  final String? priority;

  factory DashboardRecent.fromJson(Map<String, dynamic> json) {
    return DashboardRecent(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? json['name'] ?? '').toString(),
      subtitle: (json['subtitle'] ?? json['description'] ?? '').toString(),
      kind: (json['kind'] ?? json['type'] ?? 'item').toString(),
      status: json['status']?.toString(),
      priority: json['priority']?.toString(),
    );
  }
}
