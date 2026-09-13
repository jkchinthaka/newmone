/// Cleaning location model. Mirrors backend `CleaningLocation` enriched with
/// today's compliance metrics.
class CleaningLocation {
  CleaningLocation({
    required this.id,
    required this.name,
    required this.area,
    this.building,
    this.floor,
    this.description,
    this.scheduleCron,
    this.shiftWindow,
    this.shiftAssignment,
    this.cleaningFrequency,
    this.cleaningFrequencyUnit,
    this.assignedCleanerId,
    this.assignedCleanerName,
    this.geoLatitude,
    this.geoLongitude,
    this.geoRadiusMeters,
    this.requireDeviceValidation = false,
    this.requirePhoto = false,
    this.qrCode,
    this.qrCodeUrl,
    this.scanUrl,
    this.todayVisitCount = 0,
    this.pendingToday = 0,
    this.expectedTodayVisits = 0,
    this.complianceToday = 0,
    this.openIssuesCount = 0,
    this.checklistTemplate = const [],
    this.isActive = true,
  });

  final String id;
  final String name;
  final String area;
  final String? building;
  final String? floor;
  final String? description;
  final String? scheduleCron;
  final String? shiftWindow;
  final String? shiftAssignment;
  final int? cleaningFrequency;
  final String? cleaningFrequencyUnit;
  final String? assignedCleanerId;
  final String? assignedCleanerName;
  final double? geoLatitude;
  final double? geoLongitude;
  final int? geoRadiusMeters;
  final bool requireDeviceValidation;
  final bool requirePhoto;
  final String? qrCode;
  final String? qrCodeUrl;
  final String? scanUrl;
  final int todayVisitCount;
  final int pendingToday;
  final int expectedTodayVisits;
  final num complianceToday;
  final int openIssuesCount;
  final List<ChecklistTemplateItem> checklistTemplate;
  final bool isActive;

  bool get isOverdue => pendingToday > 0;

  factory CleaningLocation.fromJson(Map<String, dynamic> json) {
    final assigned = json['assignedCleaner'];
    String? cleanerName;
    String? cleanerId;
    if (assigned is Map) {
      cleanerId = assigned['id'] as String?;
      final fn = (assigned['firstName'] ?? '') as String;
      final ln = (assigned['lastName'] ?? '') as String;
      cleanerName = '$fn $ln'.trim();
      if (cleanerName.isEmpty) cleanerName = assigned['email'] as String?;
    }

    final templates = (json['checklistTemplates'] as List?) ?? const [];

    double? d(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString());
    }

    int? i(dynamic v) {
      if (v == null) return null;
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v.toString());
    }

    return CleaningLocation(
      id: json['id'] as String,
      name: (json['name'] ?? '') as String,
      area: (json['area'] ?? '') as String,
      building: json['building'] as String?,
      floor: json['floor'] as String?,
      description: json['description'] as String?,
      scheduleCron: json['scheduleCron'] as String?,
      shiftWindow: json['shiftWindow'] as String?,
      shiftAssignment: json['shiftAssignment'] as String?,
      cleaningFrequency: i(json['cleaningFrequency']),
      cleaningFrequencyUnit: json['cleaningFrequencyUnit'] as String?,
      assignedCleanerId: (json['assignedCleanerId'] as String?) ?? cleanerId,
      assignedCleanerName: cleanerName,
      geoLatitude: d(json['geoLatitude']),
      geoLongitude: d(json['geoLongitude']),
      geoRadiusMeters: i(json['geoRadiusMeters']),
      requireDeviceValidation: json['requireDeviceValidation'] == true,
      requirePhoto: json['requirePhoto'] == true,
      qrCode: json['qrCode'] as String?,
      qrCodeUrl: json['qrCodeUrl'] as String?,
      scanUrl: json['scanUrl'] as String?,
      todayVisitCount: i(json['todayVisitCount']) ?? 0,
      pendingToday: i(json['pendingToday']) ?? 0,
      expectedTodayVisits: i(json['expectedTodayVisits']) ?? 0,
      complianceToday: (json['complianceToday'] as num?) ?? 0,
      openIssuesCount: i(json['openIssuesCount']) ?? 0,
      checklistTemplate: templates
          .whereType<Map<String, dynamic>>()
          .map(ChecklistTemplateItem.fromJson)
          .toList(),
      isActive: json['isActive'] != false,
    );
  }
}

class ChecklistTemplateItem {
  const ChecklistTemplateItem({
    required this.label,
    this.required = false,
  });

  final String label;
  final bool required;

  factory ChecklistTemplateItem.fromJson(Map<String, dynamic> json) {
    return ChecklistTemplateItem(
      label: (json['label'] ?? '') as String,
      required: json['required'] == true,
    );
  }
}
