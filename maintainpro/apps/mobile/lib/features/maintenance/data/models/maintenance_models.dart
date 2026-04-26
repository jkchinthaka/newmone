class MaintenanceSchedule {
  MaintenanceSchedule({
    required this.id,
    required this.name,
    this.description,
    required this.type,
    required this.frequency,
    this.intervalDays,
    this.intervalMileage,
    this.assetId,
    this.vehicleId,
    this.nextDueDate,
    this.nextDueMileage,
    required this.isActive,
    this.estimatedCost,
    this.estimatedHours,
    this.assetName,
    this.vehicleRegistrationNo,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final String? description;
  final String type;
  final String frequency;
  final int? intervalDays;
  final double? intervalMileage;
  final String? assetId;
  final String? vehicleId;
  final DateTime? nextDueDate;
  final double? nextDueMileage;
  final bool isActive;
  final double? estimatedCost;
  final double? estimatedHours;
  final String? assetName;
  final String? vehicleRegistrationNo;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isOverdue =>
      nextDueDate != null && nextDueDate!.isBefore(DateTime.now());
  bool get isDueSoon {
    if (nextDueDate == null) return false;
    final diff = nextDueDate!.difference(DateTime.now()).inDays;
    return diff >= 0 && diff <= 7;
  }

  String get target =>
      vehicleRegistrationNo ?? assetName ?? (vehicleId ?? assetId ?? '—');

  factory MaintenanceSchedule.fromJson(Map<String, dynamic> json) {
    final asset = json['asset'] as Map<String, dynamic>?;
    final vehicle = json['vehicle'] as Map<String, dynamic>?;
    return MaintenanceSchedule(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString(),
      type: json['type']?.toString() ?? 'PREVENTIVE',
      frequency: json['frequency']?.toString() ?? 'MONTHLY',
      intervalDays: (json['intervalDays'] as num?)?.toInt(),
      intervalMileage: (json['intervalMileage'] as num?)?.toDouble(),
      assetId: json['assetId']?.toString(),
      vehicleId: json['vehicleId']?.toString(),
      nextDueDate: _parseDate(json['nextDueDate']),
      nextDueMileage: (json['nextDueMileage'] as num?)?.toDouble(),
      isActive: json['isActive'] as bool? ?? true,
      estimatedCost: (json['estimatedCost'] as num?)?.toDouble(),
      estimatedHours: (json['estimatedHours'] as num?)?.toDouble(),
      assetName: asset?['name']?.toString(),
      vehicleRegistrationNo: vehicle?['registrationNo']?.toString(),
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
      updatedAt: _parseDate(json['updatedAt']) ?? DateTime.now(),
    );
  }
}

class MaintenanceLog {
  MaintenanceLog({
    required this.id,
    this.scheduleId,
    this.assetId,
    this.vehicleId,
    this.workOrderId,
    required this.description,
    required this.performedBy,
    required this.performedAt,
    this.cost,
    this.notes,
    this.attachments = const [],
    this.scheduleName,
    this.assetName,
    this.vehicleRegistrationNo,
    required this.createdAt,
  });

  final String id;
  final String? scheduleId;
  final String? assetId;
  final String? vehicleId;
  final String? workOrderId;
  final String description;
  final String performedBy;
  final DateTime performedAt;
  final double? cost;
  final String? notes;
  final List<String> attachments;
  final String? scheduleName;
  final String? assetName;
  final String? vehicleRegistrationNo;
  final DateTime createdAt;

  String get target =>
      vehicleRegistrationNo ?? assetName ?? scheduleName ?? '—';

  factory MaintenanceLog.fromJson(Map<String, dynamic> json) {
    final schedule = json['schedule'] as Map<String, dynamic>?;
    final asset = json['asset'] as Map<String, dynamic>?;
    final vehicle = json['vehicle'] as Map<String, dynamic>?;
    return MaintenanceLog(
      id: json['id']?.toString() ?? '',
      scheduleId: json['scheduleId']?.toString(),
      assetId: json['assetId']?.toString(),
      vehicleId: json['vehicleId']?.toString(),
      workOrderId: json['workOrderId']?.toString(),
      description: json['description']?.toString() ?? '',
      performedBy: json['performedBy']?.toString() ?? '',
      performedAt: _parseDate(json['performedAt']) ?? DateTime.now(),
      cost: (json['cost'] as num?)?.toDouble(),
      notes: json['notes']?.toString(),
      attachments:
          (json['attachments'] as List?)?.map((e) => e.toString()).toList() ??
              const [],
      scheduleName: schedule?['name']?.toString(),
      assetName: asset?['name']?.toString(),
      vehicleRegistrationNo: vehicle?['registrationNo']?.toString(),
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
    );
  }
}

class MaintenanceCalendarEntry {
  MaintenanceCalendarEntry({
    required this.id,
    required this.title,
    this.date,
    this.vehicleId,
    this.assetId,
  });

  final String id;
  final String title;
  final DateTime? date;
  final String? vehicleId;
  final String? assetId;

  factory MaintenanceCalendarEntry.fromJson(Map<String, dynamic> json) {
    return MaintenanceCalendarEntry(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      date: _parseDate(json['date']),
      vehicleId: json['vehicleId']?.toString(),
      assetId: json['assetId']?.toString(),
    );
  }
}

class PredictiveAlert {
  PredictiveAlert({
    required this.id,
    required this.type,
    required this.riskLevel,
    required this.message,
    required this.referenceId,
  });

  final String id;
  final String type;
  final String riskLevel;
  final String message;
  final String referenceId;

  factory PredictiveAlert.fromJson(Map<String, dynamic> json) {
    return PredictiveAlert(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      riskLevel: json['riskLevel']?.toString() ?? 'MEDIUM',
      message: json['message']?.toString() ?? '',
      referenceId: json['referenceId']?.toString() ?? '',
    );
  }
}

DateTime? _parseDate(Object? raw) {
  if (raw == null) return null;
  if (raw is DateTime) return raw;
  return DateTime.tryParse(raw.toString());
}
