/// Facilities / cleaning / utilities read models.
library;

class PropertySummary {
  const PropertySummary({
    required this.id,
    required this.name,
    this.code,
    this.address,
    this.isActive = true,
  });

  final String id;
  final String name;
  final String? code;
  final String? address;
  final bool isActive;

  factory PropertySummary.fromJson(Map<String, dynamic> json) {
    return PropertySummary(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      code: json['code']?.toString(),
      address: json['address']?.toString(),
      isActive: json['isActive'] != false,
    );
  }
}

class RoomSummary {
  const RoomSummary({
    required this.id,
    required this.name,
    this.code,
    this.roomType,
    this.floorName,
    this.buildingName,
  });

  final String id;
  final String name;
  final String? code;
  final String? roomType;
  final String? floorName;
  final String? buildingName;

  factory RoomSummary.fromJson(Map<String, dynamic> json) {
    final floor = json['floor'];
    final building = floor is Map ? floor['building'] : null;
    return RoomSummary(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      code: json['code']?.toString(),
      roomType: json['roomType']?.toString(),
      floorName: floor is Map ? floor['name']?.toString() : null,
      buildingName: building is Map ? building['name']?.toString() : null,
    );
  }
}

class FacilityIssueSummary {
  const FacilityIssueSummary({
    required this.id,
    required this.title,
    required this.status,
    required this.severity,
    this.category,
    this.description,
    this.workOrderId,
    this.createdAt,
  });

  final String id;
  final String title;
  final String status;
  final String severity;
  final String? category;
  final String? description;
  final String? workOrderId;
  final DateTime? createdAt;

  factory FacilityIssueSummary.fromJson(Map<String, dynamic> json) {
    return FacilityIssueSummary(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      severity: (json['severity'] ?? '').toString(),
      category: json['category']?.toString(),
      description: json['description']?.toString(),
      workOrderId: json['workOrderId']?.toString(),
      createdAt: DateTime.tryParse('${json['createdAt'] ?? ''}'),
    );
  }
}

class CleaningLocationSummary {
  const CleaningLocationSummary({
    required this.id,
    required this.name,
    this.qrCode,
    this.address,
    this.isActive = true,
  });

  final String id;
  final String name;
  final String? qrCode;
  final String? address;
  final bool isActive;

  factory CleaningLocationSummary.fromJson(Map<String, dynamic> json) {
    return CleaningLocationSummary(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? json['label'] ?? 'Location').toString(),
      qrCode: json['qrCode']?.toString(),
      address: json['address']?.toString(),
      isActive: json['isActive'] != false,
    );
  }
}

class UtilityMeterSummary {
  const UtilityMeterSummary({
    required this.id,
    required this.meterNumber,
    required this.type,
    this.location,
    this.unit,
    this.isActive = true,
  });

  final String id;
  final String meterNumber;
  final String type;
  final String? location;
  final String? unit;
  final bool isActive;

  factory UtilityMeterSummary.fromJson(Map<String, dynamic> json) {
    return UtilityMeterSummary(
      id: (json['id'] ?? '').toString(),
      meterNumber: (json['meterNumber'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      location: json['location']?.toString(),
      unit: json['unit']?.toString(),
      isActive: json['isActive'] != false,
    );
  }
}

class MeterReadingSummary {
  const MeterReadingSummary({
    required this.id,
    required this.readingValue,
    this.readingDate,
    this.consumption,
  });

  final String id;
  final num readingValue;
  final DateTime? readingDate;
  final num? consumption;

  factory MeterReadingSummary.fromJson(Map<String, dynamic> json) {
    return MeterReadingSummary(
      id: (json['id'] ?? '').toString(),
      readingValue: json['readingValue'] is num
          ? json['readingValue'] as num
          : num.tryParse('${json['readingValue'] ?? 0}') ?? 0,
      readingDate: DateTime.tryParse('${json['readingDate'] ?? ''}'),
      consumption: json['consumption'] is num ? json['consumption'] as num : null,
    );
  }
}

class CleaningVisitSummary {
  const CleaningVisitSummary({
    required this.id,
    required this.status,
    this.locationName,
    this.cleanerName,
    this.scannedAt,
    this.dueAt,
  });

  final String id;
  final String status;
  final String? locationName;
  final String? cleanerName;
  final DateTime? scannedAt;
  final DateTime? dueAt;

  factory CleaningVisitSummary.fromJson(Map<String, dynamic> json) {
    final location = json['location'];
    final cleaner = json['cleaner'];
    String? cleanerName;
    if (cleaner is Map) {
      final first = cleaner['firstName']?.toString() ?? '';
      final last = cleaner['lastName']?.toString() ?? '';
      cleanerName = '$first $last'.trim();
    }
    return CleaningVisitSummary(
      id: (json['id'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      locationName: location is Map ? location['name']?.toString() : null,
      cleanerName: cleanerName,
      scannedAt: DateTime.tryParse('${json['scannedAt'] ?? ''}'),
      dueAt: DateTime.tryParse('${json['dueAt'] ?? json['scheduledAt'] ?? ''}'),
    );
  }
}

class DuplicateIssueCandidate {
  const DuplicateIssueCandidate({
    required this.id,
    required this.title,
    required this.confidence,
  });

  final String id;
  final String title;
  final String confidence;

  factory DuplicateIssueCandidate.fromJson(Map<String, dynamic> json) {
    return DuplicateIssueCandidate(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      confidence: (json['confidence'] ?? '').toString(),
    );
  }
}

class DuplicateIssueCheckResult {
  const DuplicateIssueCheckResult({
    required this.hasDuplicates,
    required this.candidates,
  });

  final bool hasDuplicates;
  final List<DuplicateIssueCandidate> candidates;

  factory DuplicateIssueCheckResult.fromJson(Map<String, dynamic> json) {
    final raw = json['candidates'];
    final list = raw is List
        ? raw
            .whereType<Map>()
            .map((e) => DuplicateIssueCandidate.fromJson(
                  Map<String, dynamic>.from(e),
                ))
            .toList()
        : const <DuplicateIssueCandidate>[];
    return DuplicateIssueCheckResult(
      hasDuplicates: json['hasDuplicates'] == true,
      candidates: list,
    );
  }
}

