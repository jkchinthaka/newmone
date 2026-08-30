import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/network/dio_client.dart';

class WorkOrderSummary {
  const WorkOrderSummary({
    required this.id,
    required this.title,
    required this.status,
    this.priority,
    this.assetName,
    this.assignedToName,
    this.updatedAt,
  });

  final String id;
  final String title;
  final String status;
  final String? priority;
  final String? assetName;
  final String? assignedToName;
  final DateTime? updatedAt;

  factory WorkOrderSummary.fromJson(Map<String, dynamic> json) {
    return WorkOrderSummary(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: (json['title'] ?? json['summary'] ?? 'Work order').toString(),
      status: (json['status'] ?? 'UNKNOWN').toString(),
      priority: json['priority']?.toString(),
      assetName: (json['asset'] is Map
              ? (json['asset'] as Map)['name']
              : json['assetName'])
          ?.toString(),
      assignedToName: (json['assignee'] is Map
              ? (json['assignee'] as Map)['name']
              : json['assignedToName'])
          ?.toString(),
      updatedAt: DateTime.tryParse(
        (json['updatedAt'] ?? json['updated_at'] ?? '').toString(),
      ),
    );
  }
}

class WorkOrderDetail extends WorkOrderSummary {
  const WorkOrderDetail({
    required super.id,
    required super.title,
    required super.status,
    super.priority,
    super.assetName,
    super.assignedToName,
    super.updatedAt,
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
      assignedToName: base.assignedToName,
      updatedAt: base.updatedAt,
      description: (json['description'] ?? json['notes'])?.toString(),
      raw: json,
    );
  }
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

class WorkOrdersRepository {
  WorkOrdersRepository(this._dio);

  final Dio _dio;

  Future<List<WorkOrderSummary>> list({
    String? status,
    String? queue,
    String? search,
    int page = 1,
    int limit = 50,
  }) async {
    try {
      // Prefer dedicated queue endpoint when a queue key is provided.
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
      final items = _extractList(response.data);
      return items.map(WorkOrderSummary.fromJson).toList();
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
      final items = _extractList(response.data);
      return items.map(WorkOrderSummary.fromJson).toList();
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
      final items = _extractList(response.data);
      return items.map(WorkOrderSummary.fromJson).toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<WorkOrderDetail> getById(String id) async {
    try {
      final response = await _dio.get<dynamic>('/work-orders/$id');
      final map = _extractMap(response.data);
      if (map == null) {
        throw const NotFoundException('Work order not found');
      }
      return WorkOrderDetail.fromJson(map);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
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
      final map = _extractMap(response.data) ?? {'id': id, 'status': status};
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
        data: {'note': note, 'body': note, 'text': note},
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  List<Map<String, dynamic>> _extractList(dynamic body) {
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
      // Nested queue payload: { data: { data: [...], total, ... } }
      if (data is Map) {
        final nested = Map<String, dynamic>.from(data);
        for (final key in ['data', 'items', 'results', 'workOrders']) {
          final list = nested[key];
          if (list is List) {
            return list
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList();
          }
        }
      }
      if (map['items'] is List) {
        return (map['items'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
    }
    return const [];
  }

  Map<String, dynamic>? _extractMap(dynamic body) {
    if (body is! Map) return null;
    final map = Map<String, dynamic>.from(body);
    if (map['data'] is Map) {
      return Map<String, dynamic>.from(map['data'] as Map);
    }
    return map;
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
