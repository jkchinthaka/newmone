import 'dart:convert';

import '../../../core/database/app_database.dart';

/// Local draft payload for facility issue reporting (online submit only).
class FacilityIssueDraftPayload {
  const FacilityIssueDraftPayload({
    required this.title,
    required this.description,
    this.severity = 'MEDIUM',
    this.category,
    this.roomId,
    this.locationId,
    this.roomLabel,
  });

  final String title;
  final String description;
  final String severity;
  final String? category;
  final String? roomId;
  final String? locationId;
  final String? roomLabel;

  static const entityType = 'FacilityIssueDraft';

  Map<String, dynamic> toJson() => {
        'title': title,
        'description': description,
        'severity': severity,
        if (category != null) 'category': category,
        if (roomId != null) 'roomId': roomId,
        if (locationId != null) 'locationId': locationId,
        if (roomLabel != null) 'roomLabel': roomLabel,
      };

  factory FacilityIssueDraftPayload.fromJson(Map<String, dynamic> json) {
    return FacilityIssueDraftPayload(
      title: (json['title'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      severity: (json['severity'] ?? 'MEDIUM').toString(),
      category: json['category']?.toString(),
      roomId: json['roomId']?.toString(),
      locationId: json['locationId']?.toString(),
      roomLabel: json['roomLabel']?.toString(),
    );
  }

  static FacilityIssueDraftPayload? fromDraft(LocalDraft draft) {
    if (draft.entityType != entityType) return null;
    try {
      final map = jsonDecode(draft.payloadJson) as Map<String, dynamic>;
      return FacilityIssueDraftPayload.fromJson(map);
    } catch (_) {
      return null;
    }
  }
}
