import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/network/dio_client.dart';
import 'datasources/work_orders_remote_datasource.dart';

/// Shared Nest `{ success, data }` / bare-list envelope helpers.
abstract final class WorkOrdersEnvelope {
  static List<Map<String, dynamic>> extractList(dynamic body) {
    if (body is List) {
      return body
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    if (body is Map) {
      final map = Map<String, dynamic>.from(body);
      final data = map['data'];
      if (data is List) {
        return data
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
      if (data is Map) {
        final nested = Map<String, dynamic>.from(data);
        for (final key in [
          'data',
          'items',
          'results',
          'workOrders',
          'entries'
        ]) {
          final list = nested[key];
          if (list is List) {
            return list
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList();
          }
        }
      }
      for (final key in ['items', 'results', 'workOrders', 'entries']) {
        if (map[key] is List) {
          return (map[key] as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        }
      }
    }
    return const [];
  }

  static Map<String, dynamic>? extractMap(dynamic body) {
    if (body is! Map) return null;
    final map = Map<String, dynamic>.from(body);
    if (map['data'] is Map) {
      return Map<String, dynamic>.from(map['data'] as Map);
    }
    return map;
  }
}

class WorkOrderSummary {
  const WorkOrderSummary({
    required this.id,
    required this.title,
    required this.status,
    this.priority,
    this.assetName,
    this.vehicleName,
    this.assignedToName,
    this.updatedAt,
    this.dueDate,
  });

  final String id;
  final String title;
  final String status;
  final String? priority;
  final String? assetName;
  final String? vehicleName;
  final String? assignedToName;
  final DateTime? updatedAt;
  final DateTime? dueDate;

  factory WorkOrderSummary.fromJson(Map<String, dynamic> json) {
    final asset = json['asset'];
    final vehicle = json['vehicle'];
    final assignee = json['assignee'] ?? json['technician'];
    return WorkOrderSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: (json['title'] ?? json['summary'] ?? 'Work order').toString(),
      status: (json['status'] ?? 'UNKNOWN').toString(),
      priority: json['priority']?.toString(),
      assetName: (asset is Map ? asset['name'] : json['assetName'])?.toString(),
      vehicleName: (vehicle is Map
              ? (vehicle['name'] ??
                  vehicle['plateNumber'] ??
                  vehicle['licensePlate'])
              : json['vehicleName'])
          ?.toString(),
      assignedToName: _personName(assignee) ??
          json['assignedToName']?.toString() ??
          json['technicianName']?.toString(),
      updatedAt: DateTime.tryParse(
        (json['updatedAt'] ?? json['updated_at'] ?? '').toString(),
      ),
      dueDate: DateTime.tryParse((json['dueDate'] ?? '').toString()),
    );
  }
}

String? _personName(dynamic value) {
  if (value is! Map) return null;
  final map = Map<String, dynamic>.from(value);
  final display = (map['displayName'] ?? map['name'] ?? '').toString().trim();
  if (display.isNotEmpty) return display;
  final first = (map['firstName'] ?? '').toString().trim();
  final last = (map['lastName'] ?? '').toString().trim();
  final joined = '$first $last'.trim();
  if (joined.isNotEmpty) return joined;
  final email = (map['email'] ?? '').toString().trim();
  return email.isEmpty ? null : email;
}

class WorkOrderDetail extends WorkOrderSummary {
  const WorkOrderDetail({
    required super.id,
    required super.title,
    required super.status,
    super.priority,
    super.assetName,
    super.vehicleName,
    super.assignedToName,
    super.updatedAt,
    super.dueDate,
    this.description,
    this.raw = const {},
  });

  final String? description;
  final Map<String, dynamic> raw;

  factory WorkOrderDetail.fromJson(Map<String, dynamic> json) {
    final base = WorkOrderSummary.fromJson(json);
    return WorkOrderDetail(
      id: base.id,
      title: base.title,
      status: base.status,
      priority: base.priority,
      assetName: base.assetName,
      vehicleName: base.vehicleName,
      assignedToName: base.assignedToName,
      updatedAt: base.updatedAt,
      dueDate: base.dueDate,
      description: (json['description'] ?? json['notes'])?.toString(),
      raw: json,
    );
  }
}

class WorkOrderEvidenceItem {
  const WorkOrderEvidenceItem({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
    required this.status,
    required this.evidenceType,
    this.verificationStatus,
    this.note,
    this.source,
    this.clientGeneratedId,
    this.uploadedByName,
    this.createdAt,
  });

  final String id;
  final String fileName;
  final String mimeType;
  final int sizeBytes;
  final String status;
  final String evidenceType;
  final String? verificationStatus;
  final String? note;
  final String? source;
  final String? clientGeneratedId;
  final String? uploadedByName;
  final DateTime? createdAt;

  factory WorkOrderEvidenceItem.fromJson(Map<String, dynamic> json) {
    return WorkOrderEvidenceItem(
      id: (json['id'] ?? '').toString(),
      fileName: (json['fileName'] ?? json['filename'] ?? 'file').toString(),
      mimeType: (json['mimeType'] ?? 'application/octet-stream').toString(),
      sizeBytes: _asInt(json['sizeBytes'] ?? json['size']) ?? 0,
      status: (json['status'] ?? 'UNKNOWN').toString(),
      evidenceType: (json['evidenceType'] ?? 'OTHER_DOCUMENT').toString(),
      verificationStatus: json['verificationStatus']?.toString(),
      note: json['note']?.toString(),
      source: json['source']?.toString(),
      clientGeneratedId: json['clientGeneratedId']?.toString(),
      uploadedByName:
          json['uploadedByName']?.toString() ?? _personName(json['uploadedBy']),
      createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()),
    );
  }
}

class EvidenceUploadRequestResult {
  const EvidenceUploadRequestResult({
    required this.ok,
    required this.message,
    this.attachmentId,
    this.uploadUrl,
    this.uploadMethod,
    this.status,
    this.mode,
  });

  final bool ok;
  final String message;
  final String? attachmentId;
  final String? uploadUrl;
  final String? uploadMethod;
  final String? status;
  final String? mode;

  factory EvidenceUploadRequestResult.fromJson(Map<String, dynamic> json) {
    final url = json['uploadUrl']?.toString();
    return EvidenceUploadRequestResult(
      ok: json['ok'] == true,
      message: (json['message'] ?? '').toString(),
      attachmentId: json['attachmentId']?.toString(),
      uploadUrl: (url == null || url.isEmpty || url == 'null') ? null : url,
      uploadMethod: json['uploadMethod']?.toString(),
      status: json['status']?.toString(),
      mode: json['mode']?.toString(),
    );
  }
}

class WorkOrderPartLine {
  const WorkOrderPartLine({
    required this.id,
    required this.partId,
    required this.partName,
    this.sku,
    this.lineStatus,
    this.requestedQuantity,
    this.issuedQuantity,
    this.usedQuantity,
    this.unitCost,
  });

  final String id;
  final String partId;
  final String partName;
  final String? sku;
  final String? lineStatus;
  final num? requestedQuantity;
  final num? issuedQuantity;
  final num? usedQuantity;
  final num? unitCost;

  factory WorkOrderPartLine.fromJson(Map<String, dynamic> json) {
    final part = json['part'];
    final partMap = part is Map ? Map<String, dynamic>.from(part) : null;
    return WorkOrderPartLine(
      id: (json['id'] ?? '').toString(),
      partId: (json['partId'] ?? partMap?['id'] ?? '').toString(),
      partName: (partMap?['name'] ?? json['partName'] ?? 'Part').toString(),
      sku: (partMap?['sku'] ?? partMap?['partNumber'] ?? json['sku'])
          ?.toString(),
      lineStatus: (json['lineStatus'] ?? json['status'])?.toString(),
      requestedQuantity: _asNum(json['requestedQuantity'] ?? json['quantity']),
      issuedQuantity: _asNum(json['issuedQuantity']),
      usedQuantity: _asNum(json['usedQuantity']),
      unitCost: _asNum(json['unitCost']),
    );
  }
}

class WorkOrderActivityEvent {
  const WorkOrderActivityEvent({
    required this.id,
    required this.type,
    required this.label,
    required this.timestamp,
    this.description,
    this.actorName,
    this.status,
    this.source,
  });

  final String id;
  final String type;
  final String label;
  final DateTime timestamp;
  final String? description;
  final String? actorName;
  final String? status;
  final String? source;

  factory WorkOrderActivityEvent.fromJson(Map<String, dynamic> json) {
    return WorkOrderActivityEvent(
      id: (json['id'] ?? '').toString(),
      type: (json['type'] ?? 'event').toString(),
      label: (json['label'] ?? json['type'] ?? 'Event').toString(),
      timestamp: DateTime.tryParse((json['timestamp'] ?? '').toString()) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      description: json['description']?.toString(),
      actorName: json['actorName']?.toString(),
      status: json['status']?.toString(),
      source: json['source']?.toString(),
    );
  }
}

int? _asInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

num? _asNum(dynamic v) {
  if (v == null) return null;
  if (v is num) return v;
  return num.tryParse(v.toString());
}

/// Known Nest work-order queue keys (see work-order-queues.service).
abstract final class WorkOrderQueueKeys {
  static const myTasks = 'my-tasks';
  static const waitingParts = 'waiting-parts';
  static const waitingEvidence = 'waiting-evidence';
  static const supervisorVerification = 'supervisor-verification';
  static const highRisk = 'high-risk';
  static const triage = 'triage';
}

/// Simple double-submit / in-flight guard (unit-testable).
class InFlightGuard {
  bool _busy = false;

  bool get isBusy => _busy;

  /// Runs [action] once; concurrent callers get `null` without starting.
  Future<T?> run<T>(Future<T> Function() action) async {
    if (_busy) return null;
    _busy = true;
    try {
      return await action();
    } finally {
      _busy = false;
    }
  }
}

class WorkOrdersRepository {
  WorkOrdersRepository(this._dio, {WorkOrdersRemoteDataSource? remote})
      : _remote = remote ?? WorkOrdersRemoteDataSource(_dio);

  final Dio _dio;
  final WorkOrdersRemoteDataSource _remote;

  Future<List<WorkOrderSummary>> list({
    String? status,
    String? queue,
    String? search,
    int page = 1,
    int limit = 50,
  }) async {
    try {
      if (queue != null && queue.isNotEmpty) {
        return listQueue(queue, page: page, limit: limit, search: search);
      }
      final response = await _dio.get<dynamic>(
        '/work-orders',
        queryParameters: {
          if (status != null) 'status': status,
          if (search != null && search.isNotEmpty) 'search': search,
          'page': page,
          'limit': limit,
        },
      );
      return WorkOrdersEnvelope.extractList(response.data)
          .map(WorkOrderSummary.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<WorkOrderSummary>> listQueue(
    String queueKey, {
    String? search,
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        '/work-orders/queues/$queueKey',
        queryParameters: {
          if (search != null && search.isNotEmpty) 'search': search,
          'page': page,
          'limit': limit,
        },
      );
      return WorkOrdersEnvelope.extractList(response.data)
          .map(WorkOrderSummary.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<WorkOrderSummary>> actionRequired({
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        '/work-orders/action-required',
        queryParameters: {'page': page, 'limit': limit},
      );
      return WorkOrdersEnvelope.extractList(response.data)
          .map(WorkOrderSummary.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<WorkOrderDetail> getById(String id) async {
    try {
      final response = await _dio.get<dynamic>('/work-orders/$id');
      final map = WorkOrdersEnvelope.extractMap(response.data);
      if (map == null) {
        throw const NotFoundException('Work order not found');
      }
      return WorkOrderDetail.fromJson(map);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Create path must include [createdById] (WO-CONTRACT-004 / Nest service).
  Future<WorkOrderDetail> create({
    required String title,
    required String description,
    required String priority,
    required String type,
    required String createdById,
    String? assetId,
    String? vehicleId,
    DateTime? dueDate,
  }) {
    return _remote.create(
      title: title,
      description: description,
      priority: priority,
      type: type,
      createdById: createdById,
      assetId: assetId,
      vehicleId: vehicleId,
      dueDate: dueDate,
    );
  }

  Future<WorkOrderDetail> updateStatus({
    required String id,
    required String status,
    Map<String, dynamic>? extra,
  }) async {
    try {
      final response = await _dio.patch<dynamic>(
        '/work-orders/$id/status',
        data: {
          'status': status,
          ...?extra,
        },
      );
      final map = WorkOrdersEnvelope.extractMap(response.data) ??
          {'id': id, 'status': status};
      return WorkOrderDetail.fromJson(map);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> addNote({
    required String id,
    required String note,
  }) async {
    try {
      await _dio.post<dynamic>(
        '/work-orders/$id/notes',
        data: {'note': note},
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<WorkOrderEvidenceItem>> listEvidence(String workOrderId) async {
    try {
      final response =
          await _dio.get<dynamic>('/work-orders/$workOrderId/evidence');
      final map = WorkOrdersEnvelope.extractMap(response.data);
      if (map == null) return const [];
      final items = map['items'];
      if (items is List) {
        return items
            .whereType<Map>()
            .map((e) => WorkOrderEvidenceItem.fromJson(
                  Map<String, dynamic>.from(e),
                ))
            .toList();
      }
      return WorkOrdersEnvelope.extractList(response.data)
          .map(WorkOrderEvidenceItem.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<EvidenceUploadRequestResult> requestEvidenceUpload({
    required String workOrderId,
    required String fileName,
    required String mimeType,
    required int sizeBytes,
    String? evidenceType,
    String? note,
    String? clientGeneratedId,
    String source = 'MOBILE',
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        '/work-orders/$workOrderId/evidence/upload-request',
        data: {
          'fileName': fileName,
          'mimeType': mimeType,
          'sizeBytes': sizeBytes,
          if (evidenceType != null) 'evidenceType': evidenceType,
          if (note != null && note.isNotEmpty) 'note': note,
          if (clientGeneratedId != null) 'clientGeneratedId': clientGeneratedId,
          'source': source,
        },
      );
      final map = WorkOrdersEnvelope.extractMap(response.data) ?? {};
      return EvidenceUploadRequestResult.fromJson(map);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> confirmEvidenceUpload({
    required String workOrderId,
    required String attachmentId,
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        '/work-orders/$workOrderId/evidence/confirm',
        data: {'attachmentId': attachmentId},
      );
      final map = WorkOrdersEnvelope.extractMap(response.data);
      if (map != null && map['ok'] == false) {
        throw BadRequestException(
          (map['message'] ?? 'Evidence confirmation failed').toString(),
        );
      }
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// PUT/POST bytes to a presigned [uploadUrl] when the API returns one.
  /// Mock/configured-without-presign modes often return `uploadUrl: null` —
  /// callers should skip this and proceed to confirm (matches web).
  Future<void> uploadBytesIfNeeded({
    required String? uploadUrl,
    required List<int> bytes,
    required String mimeType,
  }) async {
    final url = uploadUrl?.trim();
    if (url == null || url.isEmpty) return;

    try {
      // Presigned URLs are absolute — use a bare Dio without auth headers.
      final bare = Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 60),
          receiveTimeout: const Duration(seconds: 60),
          sendTimeout: const Duration(seconds: 60),
        ),
      );
      await bare.put<dynamic>(
        url,
        data: bytes,
        options: Options(
          headers: {
            'Content-Type': mimeType,
            'Content-Length': bytes.length,
          },
          contentType: mimeType,
        ),
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<WorkOrderPartLine>> listParts(String workOrderId) async {
    try {
      final response =
          await _dio.get<dynamic>('/work-orders/$workOrderId/parts');
      return WorkOrdersEnvelope.extractList(response.data)
          .map(WorkOrderPartLine.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<WorkOrderActivityEvent>> listActivity(String workOrderId) async {
    try {
      final response =
          await _dio.get<dynamic>('/work-orders/$workOrderId/activity');
      final map = WorkOrdersEnvelope.extractMap(response.data);
      if (map != null && map['entries'] is List) {
        return (map['entries'] as List)
            .whereType<Map>()
            .map((e) => WorkOrderActivityEvent.fromJson(
                  Map<String, dynamic>.from(e),
                ))
            .toList();
      }
      return WorkOrdersEnvelope.extractList(response.data)
          .map(WorkOrderActivityEvent.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final workOrdersRepositoryProvider = Provider<WorkOrdersRepository>((ref) {
  return WorkOrdersRepository(ref.watch(dioProvider));
});

class WorkOrdersListQuery {
  const WorkOrdersListQuery({this.queue, this.search, this.status});

  final String? queue;
  final String? search;
  final String? status;

  @override
  bool operator ==(Object other) =>
      other is WorkOrdersListQuery &&
      other.queue == queue &&
      other.search == search &&
      other.status == status;

  @override
  int get hashCode => Object.hash(queue, search, status);
}

final workOrdersListProvider = FutureProvider.autoDispose
    .family<List<WorkOrderSummary>, WorkOrdersListQuery>((ref, query) async {
  final repo = ref.watch(workOrdersRepositoryProvider);
  if (query.queue == 'action-required') {
    return repo.actionRequired();
  }
  return repo.list(
    queue: query.queue,
    search: query.search,
    status: query.status,
  );
});

final workOrderDetailProvider =
    FutureProvider.autoDispose.family<WorkOrderDetail, String>((ref, id) async {
  return ref.watch(workOrdersRepositoryProvider).getById(id);
});

final workOrderEvidenceProvider = FutureProvider.autoDispose
    .family<List<WorkOrderEvidenceItem>, String>((ref, id) async {
  return ref.watch(workOrdersRepositoryProvider).listEvidence(id);
});

final workOrderPartsProvider = FutureProvider.autoDispose
    .family<List<WorkOrderPartLine>, String>((ref, id) async {
  return ref.watch(workOrdersRepositoryProvider).listParts(id);
});

final workOrderActivityProvider = FutureProvider.autoDispose
    .family<List<WorkOrderActivityEvent>, String>((ref, id) async {
  return ref.watch(workOrdersRepositoryProvider).listActivity(id);
});
