import 'package:dio/dio.dart';

import '../../../../core/network/api_exception.dart';
import '../work_orders_repository.dart';

/// Remote create/list contract for work orders (WO-CONTRACT-004).
///
/// Mirrors the legacy Flutter create payload: title, description, priority,
/// type, and required [createdById].
class WorkOrdersRemoteDataSource {
  WorkOrdersRemoteDataSource(this._dio);

  final Dio _dio;

  Future<WorkOrderDetail> create({
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
      final response = await _dio.post<dynamic>(
        '/work-orders',
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
      final map = WorkOrdersEnvelope.extractMap(response.data);
      if (map == null) {
        throw const NotFoundException('Work order create returned empty body');
      }
      return WorkOrderDetail.fromJson(map);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
