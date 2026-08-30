// Tolerant parsers for Nest `/mobile/fg/*` envelopes and Django-shaped payloads.

const String kCl30FormCode = 'NMS/PPU/CL/30';

/// Occurrence token for CL18/CL30 independent occurrences.
/// Allowed: `[A-Za-z0-9._-]{8,80}`.
final RegExp kCl30OccurrenceTokenPattern = RegExp(r'^[A-Za-z0-9._-]{8,80}$');

bool isValidCl30OccurrenceToken(String token) =>
    kCl30OccurrenceTokenPattern.hasMatch(token);

Map<String, dynamic>? asStringKeyedMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

List<Map<String, dynamic>> asMapList(dynamic value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();
}

/// Unwrap Nest `{ success?, data, message }` or raw `{ data, message }` / bare map.
Map<String, dynamic>? unwrapFgDataMap(dynamic body) {
  final map = asStringKeyedMap(body);
  if (map == null) return null;
  final data = map['data'];
  if (data is Map) return Map<String, dynamic>.from(data);
  // Bare payload (already unwrapped by some proxies).
  if (map.containsKey('authenticated') ||
      map.containsKey('record') ||
      map.containsKey('results') ||
      map.containsKey('submissions') ||
      map.containsKey('records') ||
      map.containsKey('editor') ||
      map.containsKey('idempotent')) {
    return map;
  }
  return map;
}

dynamic unwrapFgData(dynamic body) {
  final map = asStringKeyedMap(body);
  if (map == null) return body;
  if (map.containsKey('data')) return map['data'];
  return body;
}

List<Map<String, dynamic>> extractResultsList(dynamic data) {
  if (data is List) return asMapList(data);
  final map = asStringKeyedMap(data);
  if (map == null) return const [];
  for (final key in ['results', 'items', 'submissions', 'records', 'data']) {
    final list = map[key];
    if (list is List) return asMapList(list);
  }
  return const [];
}

class FgSessionStatus {
  const FgSessionStatus({
    required this.authenticated,
    this.actor,
    this.expiresAt,
  });

  final bool authenticated;
  final Map<String, dynamic>? actor;
  final String? expiresAt;

  factory FgSessionStatus.fromJson(Map<String, dynamic> json) {
    return FgSessionStatus(
      authenticated: json['authenticated'] == true,
      actor: asStringKeyedMap(json['actor']),
      expiresAt: json['expiresAt']?.toString(),
    );
  }
}

class VehicleResult {
  const VehicleResult({
    required this.id,
    required this.label,
    this.registrationNo,
    this.make,
    this.vehicleModel,
    this.status,
    this.assetTag,
    this.type,
    this.selectable = false,
    this.unavailable = false,
    this.unavailableReason,
  });

  final String id;
  final String label;
  final String? registrationNo;
  final String? make;
  final String? vehicleModel;
  final String? status;
  final String? assetTag;
  final String? type;
  final bool selectable;
  final bool unavailable;
  final String? unavailableReason;

  factory VehicleResult.fromJson(Map<String, dynamic> json) {
    final reg = json['registrationNo']?.toString();
    final label = (json['label'] ?? reg ?? json['id'] ?? '').toString();
    return VehicleResult(
      id: (json['id'] ?? '').toString(),
      label: label.isEmpty ? 'Vehicle' : label,
      registrationNo: reg,
      make: json['make']?.toString(),
      vehicleModel: (json['vehicleModel'] ?? json['model'])?.toString(),
      status: json['status']?.toString(),
      assetTag: json['assetTag']?.toString(),
      type: json['type']?.toString(),
      selectable: json['selectable'] == true,
      unavailable: json['unavailable'] == true || json['selectable'] == false,
      unavailableReason: json['unavailableReason']?.toString(),
    );
  }
}

class FgRecordSummary {
  const FgRecordSummary({
    required this.id,
    this.status,
    this.bucket,
    this.statusLabel,
    this.formCode,
    this.formTitle,
    this.batchReference,
    this.readOnly = false,
    this.updatedAt,
    this.startedAt,
    this.raw = const {},
  });

  final String id;
  final String? status;
  final String? bucket;
  final String? statusLabel;
  final String? formCode;
  final String? formTitle;
  final String? batchReference;
  final bool readOnly;
  final String? updatedAt;
  final String? startedAt;
  final Map<String, dynamic> raw;

  factory FgRecordSummary.fromJson(Map<String, dynamic> json) {
    return FgRecordSummary(
      id: (json['id'] ?? '').toString(),
      status: json['status']?.toString(),
      bucket: json['bucket']?.toString(),
      statusLabel: json['statusLabel']?.toString(),
      formCode: json['formCode']?.toString(),
      formTitle: json['formTitle']?.toString(),
      batchReference: json['batchReference']?.toString(),
      readOnly: json['readOnly'] == true,
      updatedAt: json['updatedAt']?.toString(),
      startedAt: json['startedAt']?.toString(),
      raw: json,
    );
  }
}

class FgOpenRecordResult {
  const FgOpenRecordResult({
    required this.record,
    required this.idempotent,
  });

  final FgRecordSummary record;
  final bool idempotent;

  factory FgOpenRecordResult.fromJson(Map<String, dynamic> json) {
    final recordMap = asStringKeyedMap(json['record']) ?? json;
    return FgOpenRecordResult(
      record: FgRecordSummary.fromJson(recordMap),
      idempotent: json['idempotent'] == true,
    );
  }
}

class FgEditorField {
  const FgEditorField({
    required this.key,
    required this.label,
    this.code,
    this.responseType,
    this.required = false,
    this.value = '',
    this.options = const [],
    this.isVehicleField = false,
    this.helpText,
  });

  /// Form post key — prefer Django `fieldName`, else `code` / `name` / `id`.
  final String key;
  final String label;
  final String? code;
  final String? responseType;
  final bool required;
  final String value;
  final List<FgFieldOption> options;
  final bool isVehicleField;
  final String? helpText;

  bool get isChoice =>
      options.isNotEmpty ||
      responseType == 'YES_NO' ||
      responseType == 'YES_NO_NA' ||
      responseType == 'SELECT';
}

class FgFieldOption {
  const FgFieldOption({required this.value, required this.label});

  final String value;
  final String label;

  factory FgFieldOption.fromJson(Map<String, dynamic> json) {
    return FgFieldOption(
      value: (json['value'] ?? '').toString(),
      label: (json['label'] ?? json['value'] ?? '').toString(),
    );
  }
}

class FgEditorSection {
  const FgEditorSection({
    required this.title,
    required this.fields,
    this.id,
  });

  final String? id;
  final String title;
  final List<FgEditorField> fields;
}

class FgRecordDetail {
  const FgRecordDetail({
    required this.record,
    this.readOnly = false,
    this.editorSections = const [],
    this.draftVersion,
    this.expectedDraftVersion,
    this.fieldValues = const {},
    this.canEdit = false,
    this.canSubmit = false,
    this.snapshot,
    this.raw = const {},
  });

  final FgRecordSummary record;
  final bool readOnly;
  final List<FgEditorSection> editorSections;
  final int? draftVersion;
  final int? expectedDraftVersion;
  final Map<String, String> fieldValues;
  final bool canEdit;
  final bool canSubmit;
  final List<Map<String, dynamic>>? snapshot;
  final Map<String, dynamic> raw;

  factory FgRecordDetail.fromJson(Map<String, dynamic> json) {
    final recordMap = asStringKeyedMap(json['record']) ??
        (json.containsKey('id') ? json : <String, dynamic>{});
    final record = FgRecordSummary.fromJson(recordMap);

    final actions = asStringKeyedMap(json['actions']) ?? {};
    final editor = asStringKeyedMap(json['editor']);
    final sections = <FgEditorSection>[];
    final values = <String, String>{};

    if (editor != null) {
      final editorSections = asMapList(editor['sections']);
      for (final sec in editorSections) {
        final fieldsRaw = asMapList(sec['fields']);
        final fields = <FgEditorField>[];
        for (final f in fieldsRaw) {
          // Repeating groups: flatten children if present.
          final children = asMapList(f['children']);
          if (children.isNotEmpty) {
            for (final child in children) {
              fields.add(_parseEditorField(child, values));
            }
            continue;
          }
          fields.add(_parseEditorField(f, values));
        }
        sections.add(
          FgEditorSection(
            id: sec['id']?.toString(),
            title: (sec['title'] ?? 'Section').toString(),
            fields: fields,
          ),
        );
      }
    } else {
      // Fallback: known keys from record.fields / flat fields map — no invented rules.
      final flat = asStringKeyedMap(json['fields']) ??
          asStringKeyedMap(recordMap['fields']);
      if (flat != null) {
        flat.forEach((k, v) {
          values[k] = v?.toString() ?? '';
        });
        sections.add(
          FgEditorSection(
            title: 'Fields',
            fields: flat.keys
                .map(
                  (k) => FgEditorField(
                    key: k,
                    label: k,
                    value: values[k] ?? '',
                  ),
                )
                .toList(),
          ),
        );
      }
    }

    final draftVersion =
        _asInt(editor?['draftVersion'] ?? json['draftVersion']);
    final expected = _asInt(
      editor?['expectedDraftVersion'] ??
          json['expectedDraftVersion'] ??
          draftVersion,
    );

    final snapshotRaw = json['snapshot'];
    List<Map<String, dynamic>>? snapshot;
    if (snapshotRaw is List) {
      snapshot = asMapList(snapshotRaw);
    }

    return FgRecordDetail(
      record: record,
      readOnly: json['readOnly'] == true || record.readOnly,
      editorSections: sections,
      draftVersion: draftVersion,
      expectedDraftVersion: expected,
      fieldValues: values,
      canEdit: actions['canEdit'] == true,
      canSubmit: actions['canSubmit'] == true,
      snapshot: snapshot,
      raw: json,
    );
  }

  static FgEditorField _parseEditorField(
    Map<String, dynamic> f,
    Map<String, String> values,
  ) {
    final key =
        (f['fieldName'] ?? f['name'] ?? f['code'] ?? f['id'] ?? '').toString();
    final value = (f['value'] ?? '').toString();
    if (key.isNotEmpty) values[key] = value;
    final options =
        asMapList(f['options']).map(FgFieldOption.fromJson).toList();
    return FgEditorField(
      key: key.isEmpty ? 'field' : key,
      label: (f['label'] ?? f['code'] ?? key).toString(),
      code: f['code']?.toString(),
      responseType: (f['responseType'] ?? f['type'])?.toString(),
      required: f['required'] == true || f['is_required'] == true,
      value: value,
      options: options,
      isVehicleField: f['isVehicleField'] == true,
      helpText: f['helpText']?.toString(),
    );
  }

  static int? _asInt(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v?.toString() ?? '');
  }
}

class FgSaveResult {
  const FgSaveResult({
    this.draftVersion,
    this.serverAuthoritative = false,
  });

  final int? draftVersion;
  final bool serverAuthoritative;

  factory FgSaveResult.fromJson(Map<String, dynamic> json) {
    return FgSaveResult(
      draftVersion: FgRecordDetail._asInt(json['draftVersion']),
      serverAuthoritative: json['serverAuthoritative'] == true,
    );
  }
}

class FgSubmission {
  const FgSubmission({
    required this.id,
    this.recordId,
    this.formCode,
    this.formTitle,
    this.batchReference,
    this.status,
    this.submittedAt,
    this.raw = const {},
  });

  final String id;
  final String? recordId;
  final String? formCode;
  final String? formTitle;
  final String? batchReference;
  final String? status;
  final String? submittedAt;
  final Map<String, dynamic> raw;

  factory FgSubmission.fromJson(Map<String, dynamic> json) {
    return FgSubmission(
      id: (json['id'] ?? '').toString(),
      recordId: json['recordId']?.toString(),
      formCode: json['formCode']?.toString(),
      formTitle: json['formTitle']?.toString(),
      batchReference: json['batchReference']?.toString(),
      status: json['status']?.toString(),
      submittedAt: json['submittedAt']?.toString(),
      raw: json,
    );
  }
}

class FgReviewDetail {
  const FgReviewDetail({
    required this.submission,
    this.record,
    this.snapshot = const [],
    this.canDecide = false,
    this.selfReviewBlocked = false,
    this.selfReviewMessage,
    this.existingDecision,
    this.raw = const {},
  });

  final FgSubmission submission;
  final FgRecordSummary? record;
  final List<Map<String, dynamic>> snapshot;
  final bool canDecide;
  final bool selfReviewBlocked;
  final String? selfReviewMessage;
  final String? existingDecision;
  final Map<String, dynamic> raw;

  factory FgReviewDetail.fromJson(Map<String, dynamic> json) {
    final submissionMap = asStringKeyedMap(json['submission']) ?? json;
    final actions = asStringKeyedMap(json['actions']) ?? {};
    final selfReview = asStringKeyedMap(json['selfReview']) ?? {};
    final review = asStringKeyedMap(json['review']);
    final recordMap = asStringKeyedMap(json['record']);
    return FgReviewDetail(
      submission: FgSubmission.fromJson(submissionMap),
      record: recordMap == null ? null : FgRecordSummary.fromJson(recordMap),
      snapshot: asMapList(json['snapshot']),
      canDecide: actions['canDecide'] == true,
      selfReviewBlocked: selfReview['blocked'] == true,
      selfReviewMessage: selfReview['message']?.toString(),
      existingDecision: review?['decision']?.toString(),
      raw: json,
    );
  }
}

class FgQaDetail {
  const FgQaDetail({
    required this.submission,
    this.record,
    this.snapshot = const [],
    this.canDecide = false,
    this.existingDecision,
    this.raw = const {},
  });

  final FgSubmission submission;
  final FgRecordSummary? record;
  final List<Map<String, dynamic>> snapshot;
  final bool canDecide;
  final String? existingDecision;
  final Map<String, dynamic> raw;

  factory FgQaDetail.fromJson(Map<String, dynamic> json) {
    final submissionMap = asStringKeyedMap(json['submission']) ?? json;
    final actions = asStringKeyedMap(json['actions']) ?? {};
    final qaReview = asStringKeyedMap(json['qaReview']);
    final recordMap = asStringKeyedMap(json['record']);
    return FgQaDetail(
      submission: FgSubmission.fromJson(submissionMap),
      record: recordMap == null ? null : FgRecordSummary.fromJson(recordMap),
      snapshot: asMapList(json['snapshot']),
      canDecide: actions['canDecide'] == true,
      existingDecision: qaReview?['decision']?.toString(),
      raw: json,
    );
  }
}

/// Local draft payload for [Cl30DraftStore] / OutboxService entityType `FgCl30Draft`.
class FgCl30DraftPayload {
  const FgCl30DraftPayload({
    required this.fields,
    required this.occurrenceToken,
    required this.localDraftId,
    this.vehicleId,
    this.recordId,
    this.draftVersion,
    this.displayDate,
    this.title,
  });

  final Map<String, dynamic> fields;
  final String occurrenceToken;
  final String localDraftId;
  final String? vehicleId;
  final String? recordId;
  final int? draftVersion;

  /// Optional UI-only date — never authoritative businessDate.
  final String? displayDate;
  final String? title;

  Map<String, dynamic> toJson() => {
        'fields': fields,
        'occurrenceToken': occurrenceToken,
        'localDraftId': localDraftId,
        if (vehicleId != null) 'vehicleId': vehicleId,
        if (recordId != null) 'recordId': recordId,
        if (draftVersion != null) 'draftVersion': draftVersion,
        if (displayDate != null) 'displayDate': displayDate,
        if (title != null) 'title': title,
      };

  factory FgCl30DraftPayload.fromJson(Map<String, dynamic> json) {
    final fieldsRaw = asStringKeyedMap(json['fields']) ?? {};
    return FgCl30DraftPayload(
      fields: fieldsRaw,
      occurrenceToken: (json['occurrenceToken'] ?? '').toString(),
      localDraftId: (json['localDraftId'] ?? json['draftId'] ?? '').toString(),
      vehicleId: json['vehicleId']?.toString(),
      recordId: json['recordId']?.toString(),
      draftVersion: FgRecordDetail._asInt(json['draftVersion']),
      displayDate: json['displayDate']?.toString(),
      title: json['title']?.toString(),
    );
  }
}
