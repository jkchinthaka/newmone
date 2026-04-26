import 'package:dio/dio.dart';

import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../models/inventory_models.dart';

class InventoryRemoteDataSource {
  InventoryRemoteDataSource(this._dio);
  final Dio _dio;

  dynamic _unwrap(Response<dynamic> res) {
    final body = res.data;
    if (body is Map<String, dynamic> && body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }

  List<T> _list<T>(dynamic data, T Function(Map<String, dynamic>) of) {
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => of(Map<String, dynamic>.from(e)))
          .toList();
    }
    return const [];
  }

  Future<List<SparePart>> listParts() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.inventoryParts);
      return _list(_unwrap(res), SparePart.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<SparePart> getPart(String id) async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.inventoryPartById(id));
      return SparePart.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<SparePart> createPart({
    required String partNumber,
    required String name,
    required String category,
    required double unitCost,
    String? unit,
    int? minimumStock,
    int? reorderPoint,
    int? quantityInStock,
    String? location,
    String? supplierId,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.inventoryParts,
        data: {
          'partNumber': partNumber,
          'name': name,
          'category': category,
          'unitCost': unitCost,
          if (unit != null) 'unit': unit,
          if (minimumStock != null) 'minimumStock': minimumStock,
          if (reorderPoint != null) 'reorderPoint': reorderPoint,
          if (quantityInStock != null) 'quantityInStock': quantityInStock,
          if (location != null) 'location': location,
          if (supplierId != null) 'supplierId': supplierId,
        },
      );
      return SparePart.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<SparePart> updatePart(
    String id, {
    String? name,
    String? category,
    double? unitCost,
    int? minimumStock,
    int? reorderPoint,
    String? location,
  }) async {
    try {
      final res = await _dio.patch<dynamic>(
        ApiEndpoints.inventoryPartById(id),
        data: {
          if (name != null) 'name': name,
          if (category != null) 'category': category,
          if (unitCost != null) 'unitCost': unitCost,
          if (minimumStock != null) 'minimumStock': minimumStock,
          if (reorderPoint != null) 'reorderPoint': reorderPoint,
          if (location != null) 'location': location,
        },
      );
      return SparePart.fromJson(Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<void> stockIn(String id, int quantity, {String? notes}) async {
    try {
      await _dio.post<dynamic>(
        ApiEndpoints.inventoryPartStockIn(id),
        data: {'quantity': quantity, if (notes != null) 'notes': notes},
      );
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<void> stockOut(String id, int quantity, {String? notes}) async {
    try {
      await _dio.post<dynamic>(
        ApiEndpoints.inventoryPartStockOut(id),
        data: {'quantity': quantity, if (notes != null) 'notes': notes},
      );
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<StockMovement>> movements(String id) async {
    try {
      final res =
          await _dio.get<dynamic>(ApiEndpoints.inventoryPartMovements(id));
      return _list(_unwrap(res), StockMovement.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<SparePart>> lowStock() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.inventoryLowStock);
      return _list(_unwrap(res), SparePart.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<List<InventoryPurchaseOrder>> purchaseOrders() async {
    try {
      final res = await _dio.get<dynamic>(ApiEndpoints.inventoryPurchaseOrders);
      return _list(_unwrap(res), InventoryPurchaseOrder.fromJson);
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<InventoryPurchaseOrder> createPurchaseOrder({
    required String poNumber,
    required String supplierId,
    required DateTime orderDate,
    DateTime? expectedDate,
    required double totalAmount,
    String? notes,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        ApiEndpoints.inventoryPurchaseOrders,
        data: {
          'poNumber': poNumber,
          'supplierId': supplierId,
          'orderDate': orderDate.toUtc().toIso8601String(),
          if (expectedDate != null)
            'expectedDate': expectedDate.toUtc().toIso8601String(),
          'totalAmount': totalAmount,
          if (notes != null) 'notes': notes,
        },
      );
      return InventoryPurchaseOrder.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }

  Future<InventoryPurchaseOrder> updatePurchaseOrder(
    String id, {
    String? status,
    DateTime? receivedDate,
    String? notes,
  }) async {
    try {
      final res = await _dio.patch<dynamic>(
        ApiEndpoints.inventoryPurchaseOrderById(id),
        data: {
          if (status != null) 'status': status,
          if (receivedDate != null)
            'receivedDate': receivedDate.toUtc().toIso8601String(),
          if (notes != null) 'notes': notes,
        },
      );
      return InventoryPurchaseOrder.fromJson(
          Map<String, dynamic>.from(_unwrap(res) as Map));
    } on DioException catch (e) {
      throw NetworkException.fromDio(e);
    }
  }
}
