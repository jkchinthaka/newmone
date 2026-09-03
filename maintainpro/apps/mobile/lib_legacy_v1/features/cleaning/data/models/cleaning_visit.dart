/// CleaningVisit model.
class CleaningVisit {
  CleaningVisit({
    required this.id,
    required this.locationId,
    required this.locationName,
    required this.locationArea,
    required this.cleanerId,
    required this.cleanerName,
    required this.status,
    required this.scheduleStatus,
    required this.scannedAt,
    this.submittedAt,
    this.signedOffAt,
    this.signedOffById,
    this.signedOffByName,
    this.durationSeconds,
    this.qualityScore,
    this.notes,
    this.rejectionReason,
    this.beforePhotos = const [],
    this.afterPhotos = const [],
    this.checklist = const [],
  });

  final String id;
  final String locationId;
  final String locationName;
  final String locationArea;
  final String cleanerId;
  final String cleanerName;
  final String status;
  final String scheduleStatus;
  final DateTime scannedAt;
  final DateTime? submittedAt;
  final DateTime? signedOffAt;
  final String? signedOffById;
  final String? signedOffByName;
  final int? durationSeconds;
  final int? qualityScore;
  final String? notes;
  final String? rejectionReason;
  final List<String> beforePhotos;
  final List<String> afterPhotos;
  final List<VisitChecklistItem> checklist;

  bool get isSubmitted => status == 'SUBMITTED' || status == 'PENDING_APPROVAL';
  bool get isApproved => status == 'APPROVED' || status == 'COMPLETED';
  bool get isRejected => status == 'REJECTED';
  bool get isInProgress => status == 'IN_PROGRESS' || status == 'STARTED';

  factory CleaningVisit.fromJson(Map<String, dynamic> json) {
    DateTime? d(dynamic v) =>
        v == null ? null : DateTime.tryParse(v.toString());

    final loc = (json['location'] as Map?) ?? const {};
    final cleaner = (json['cleaner'] as Map?) ?? const {};
    final signed = (json['signedOffBy'] as Map?);
    final cleanerName = ('${cleaner['firstName'] ?? ''} '
            '${cleaner['lastName'] ?? ''}')
        .trim();
    final signedName = signed == null
        ? null
        : ('${signed['firstName'] ?? ''} ${signed['lastName'] ?? ''}').trim();

    final beforePhotos =
        (json['beforePhotos'] as List?)?.whereType<String>().toList() ??
            const <String>[];
    final afterPhotos =
        (json['afterPhotos'] as List?)?.whereType<String>().toList() ??
            const <String>[];
    final checklist = (json['checklist'] as List?) ?? const [];

    return CleaningVisit(
      id: json['id'] as String,
      locationId: (json['locationId'] ?? loc['id'] ?? '') as String,
      locationName: (loc['name'] ?? '') as String,
      locationArea: (loc['area'] ?? '') as String,
      cleanerId: (json['cleanerId'] ?? cleaner['id'] ?? '') as String,
      cleanerName: cleanerName.isEmpty
          ? (cleaner['email'] as String? ?? '—')
          : cleanerName,
      status: (json['status'] ?? 'PENDING') as String,
      scheduleStatus: (json['scheduleStatus'] ?? 'ON_TIME') as String,
      scannedAt: d(json['scannedAt']) ?? DateTime.now(),
      submittedAt: d(json['submittedAt']),
      signedOffAt: d(json['signedOffAt']),
      signedOffById: json['signedOffById'] as String?,
      signedOffByName:
          signedName == null || signedName.isEmpty ? null : signedName,
      durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
      qualityScore: (json['qualityScore'] as num?)?.toInt(),
      notes: json['notes'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      beforePhotos: beforePhotos,
      afterPhotos: afterPhotos,
      checklist: checklist
          .whereType<Map<String, dynamic>>()
          .map(VisitChecklistItem.fromJson)
          .toList(),
    );
  }
}

class VisitChecklistItem {
  const VisitChecklistItem({
    required this.label,
    required this.checked,
    this.note,
  });

  final String label;
  final bool checked;
  final String? note;

  Map<String, dynamic> toJson() => {
        'label': label,
        'checked': checked,
        if (note != null && note!.isNotEmpty) 'note': note,
      };

  factory VisitChecklistItem.fromJson(Map<String, dynamic> json) {
    return VisitChecklistItem(
      label: (json['label'] ?? '') as String,
      checked: json['checked'] == true,
      note: json['note'] as String?,
    );
  }
}

class CleaningVisitFilters {
  const CleaningVisitFilters({
    this.status,
    this.locationId,
    this.assignedToMe = false,
    this.date,
  });

  final String? status;
  final String? locationId;
  final bool assignedToMe;
  final DateTime? date;

  bool get isEmpty =>
      status == null && locationId == null && !assignedToMe && date == null;

  CleaningVisitFilters copyWith({
    Object? status = _sentinel,
    Object? locationId = _sentinel,
    bool? assignedToMe,
    Object? date = _sentinel,
  }) {
    return CleaningVisitFilters(
      status: identical(status, _sentinel) ? this.status : status as String?,
      locationId: identical(locationId, _sentinel)
          ? this.locationId
          : locationId as String?,
      assignedToMe: assignedToMe ?? this.assignedToMe,
      date: identical(date, _sentinel) ? this.date : date as DateTime?,
    );
  }
}

const _sentinel = Object();
