import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import 'inventory_models.dart';

/// Read-only Nest inventory/procurement/ERP client.
class InventoryApiClient {
  InventoryApiClient(this._dio);

  final Dio _dio;

  Future<T> _guarded<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      throwApiException(e);
    }
  }

  Future<List<InventoryPartSummary>> listParts() => _guarded(() async {
        final res = await _dio.get<dynamic>('/inventory/parts');
        return _list(res.data, InventoryPartSummary.fromJson);
      });

  Future<InventoryPartSummary> getPart(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('/inventory/parts/$id');
        return InventoryPartSummary.fromJson(_unwrapMap(res.data));
      });

  Future<List<InventoryPartSummary>> lowStock() => _guarded(() async {
        final res = await _dio.get<dynamic>('/inventory/low-stock');
        return _list(res.data, InventoryPartSummary.fromJson);
      });

  Future<List<StockMovementSummary>> partMovements(String partId) =>
      _guarded(() async {
        final res =
            await _dio.get<dynamic>('/inventory/parts/$partId/movements');
        return _list(res.data, StockMovementSummary.fromJson);
      });

  Future<List<WarehouseSummary>> listWarehouses() => _guarded(() async {
        final res = await _dio.get<dynamic>('/inventory/warehouses');
        return _list(res.data, WarehouseSummary.fromJson);
      });

  Future<InventoryDashboardSummary?> dashboard() => _guarded(() async {
        final res = await _dio.get<dynamic>('/inventory/dashboard');
        final map = _unwrapMap(res.data);
        if (map.isEmpty) return null;
        return InventoryDashboardSummary.fromJson(map);
      });

  Future<List<SupplierSummary>> listSuppliers() => _guarded(() async {
        final res = await _dio.get<dynamic>('/suppliers');
        return _list(res.data, SupplierSummary.fromJson);
      });

  Future<SupplierSummary> getSupplier(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('/suppliers/$id');
        return SupplierSummary.fromJson(_unwrapMap(res.data));
      });

  Future<List<PurchaseOrderSummary>> listPurchaseOrders() =>
      _guarded(() async {
        final res = await _dio.get<dynamic>('/inventory/purchase-orders');
        return _list(res.data, PurchaseOrderSummary.fromJson);
      });

  Future<PurchaseOrderDetail> getPurchaseOrder(String id) => _guarded(() async {
        final res = await _dio.get<dynamic>('/inventory/purchase-orders/$id');
        return PurchaseOrderDetail.fromJson(_unwrapMap(res.data));
      });

  Future<ErpStatusSummary?> erpPlatformStatus() => _guarded(() async {
        final res = await _dio.get<dynamic>('/erp/status');
        final map = _unwrapMap(res.data);
        if (map.isEmpty) return null;
        return ErpStatusSummary.fromJson(map);
      });

  Future<Map<String, dynamic>> erpInventoryReadiness() => _guarded(() async {
        final res = await _dio.get<dynamic>('/inventory/erp/readiness');
        return _unwrapMap(res.data);
      });

  List<T> _list<T>(
    dynamic body,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    final data = _unwrap(body);
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    return const [];
  }

  dynamic _unwrap(dynamic body) {
    if (body is Map && body.containsKey('data')) return body['data'];
    return body;
  }

  Map<String, dynamic> _unwrapMap(dynamic body) {
    final data = _unwrap(body);
    if (data is Map) return Map<String, dynamic>.from(data);
    return {};
  }
}

final inventoryApiClientProvider = Provider<InventoryApiClient>((ref) {
  return InventoryApiClient(ref.watch(dioProvider));
});
