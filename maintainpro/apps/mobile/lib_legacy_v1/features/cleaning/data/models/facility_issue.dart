/// Facility issue (cleaning module).
class FacilityIssue {
  FacilityIssue({
    required this.id,
    required this.title,
    required this.description,
    required this.severity,
    required this.status,
    required this.createdAt,
    this.locationId,
    this.locationName,
    this.assignedToId,
    this.assignedToName,
    this.reporterName,
    this.resolution,
    this.resolvedAt,
    this.slaHours,
    this.slaDueAt,
    this.photos = const [],
  });

  final String id;
  final String title;
  final String description;
  final String severity;
  final String status;
  final DateTime createdAt;
  final String? locationId;
  final String? locationName;
  final String? assignedToId;
  final String? assignedToName;
  final String? reporterName;
  final String? resolution;
  final DateTime? resolvedAt;
  final int? slaHours;
  final DateTime? slaDueAt;
  final List<String> photos;

  bool get isResolved =>
      status == 'RESOLVED' || status == 'CLOSED' || status == 'COMPLETED';

  bool get isSlaBreached {
    if (slaDueAt == null || isResolved) return false;
    return DateTime.now().isAfter(slaDueAt!);
  }

  factory FacilityIssue.fromJson(Map<String, dynamic> json) {
    DateTime? d(dynamic v) =>
        v == null ? null : DateTime.tryParse(v.toString());

    String? nameOf(dynamic m) {
      if (m is! Map) return null;
      final fn = (m['firstName'] ?? '') as String;
      final ln = (m['lastName'] ?? '') as String;
      final n = '$fn $ln'.trim();
      return n.isEmpty ? (m['email'] as String?) : n;
    }

    final photos = (json['photos'] as List?)?.whereType<String>().toList() ??
        const <String>[];

    return FacilityIssue(
      id: json['id'] as String,
      title: (json['title'] ?? '') as String,
      description: (json['description'] ?? '') as String,
      severity: (json['severity'] ?? 'MEDIUM') as String,
      status: (json['status'] ?? 'OPEN') as String,
      createdAt: d(json['createdAt']) ?? DateTime.now(),
      locationId: json['locationId'] as String?,
      locationName: (json['location'] is Map)
          ? (json['location']['name'] as String?)
          : null,
      assignedToId: json['assignedToId'] as String?,
      assignedToName: nameOf(json['assignedTo']),
      reporterName: nameOf(json['reporter'] ?? json['createdBy']),
      resolution: json['resolution'] as String?,
      resolvedAt: d(json['resolvedAt']),
      slaHours: (json['slaHours'] as num?)?.toInt(),
      slaDueAt: d(json['slaDueAt']),
      photos: photos,
    );
  }
}
