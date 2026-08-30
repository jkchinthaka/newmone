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

class WorkOrdersRepository {
  WorkOrdersRepository(this._dio);

  final Dio _dio;

  Future<List<WorkOrderSummary>> list({
    String? status,
    String? queue,
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        '/work-orders',
        queryParameters: {
          if (status != null) 'status': status,
          if (queue != null) 'queue': queue,
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
      if (data is Map && data['items'] is List) {
        return (data['items'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
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

final workOrdersListProvider =
    FutureProvider.autoDispose<List<WorkOrderSummary>>((ref) async {
  return ref.watch(workOrdersRepositoryProvider).list();
});

final workOrderDetailProvider =
    FutureProvider.autoDispose.family<WorkOrderDetail, String>((ref, id) async {
  return ref.watch(workOrdersRepositoryProvider).getById(id);
});
