import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/work_order.dart';

class WorkOrdersRemoteDataSource {
  WorkOrdersRemoteDataSource(this._dio);

  final Dio _dio;

  /// Returns the inner data payload, unwrapping any envelope.
  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic>) {
      if (body.containsKey('data')) return body['data'];
    }
    return body;
  }

  Future<List<WorkOrder>> list() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.workOrders);
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(WorkOrder.fromJson)
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<WorkOrder> getById(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.workOrderById(id));
      final data = _unwrap(res);
      if (data is! Map<String, dynamic>) {
        throw const NotFoundException('Work order not found');
      }
      return WorkOrder.fromJson(data);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<WorkOrder> create({
    required String title,
    required String description,
    required String priority,
    required String type,
    required String createdById,
    String? assetId,
    String? vehicleId,
    DateTime? dueDate,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.workOrders,
        data: {
          'title': title,
          'description': description,
          'priority': priority,
          'type': type,
          'createdById': createdById,
          if (assetId != null && assetId.isNotEmpty) 'assetId': assetId,
          if (vehicleId != null && vehicleId.isNotEmpty) 'vehicleId': vehicleId,
          if (dueDate != null) 'dueDate': dueDate.toUtc().toIso8601String(),
        },
      );
      final data = _unwrap(res);
      return WorkOrder.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<WorkOrder> updateStatus(
    String id, {
    required String status,
    num? actualCost,
    num? actualHours,
  }) async {
    try {
      final res = await _dio.patch<dynamic>(
        ApiEndpoints.workOrderStatus(id),
        data: {
          'status': status,
          if (actualCost != null) 'actualCost': actualCost,
          if (actualHours != null) 'actualHours': actualHours,
        },
      );
      final data = _unwrap(res);
      return WorkOrder.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<WorkOrder> assign(String id, String technicianId) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.workOrderAssign(id),
        data: {'technicianId': technicianId},
      );
      final data = _unwrap(res);
      return WorkOrder.fromJson(Map<String, dynamic>.from(data as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<WorkOrderPart>> parts(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.workOrderParts(id));
      final data = _unwrap(res);
      if (data is! List) return const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(WorkOrderPart.fromJson)
          .toList();
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<void> addPart(
    String id, {
    required String partId,
    required num quantity,
    required num unitCost,
  }) async {
    try {
      await _dio.post<dynamic>(
        ApiEndpoints.workOrderParts(id),
        data: {
          'partId': partId,
          'quantity': quantity,
          'unitCost': unitCost,
        },
      );
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<void> addNote(String id, String note) async {
    try {
      await _dio.post<dynamic>(
        ApiEndpoints.workOrderNotes(id),
        data: {'note': note},
      );
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<void> addAttachment(String id, String url) async {
    try {
      await _dio.post<dynamic>(
        ApiEndpoints.workOrderAttachments(id),
        data: {'attachmentUrl': url},
      );
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
