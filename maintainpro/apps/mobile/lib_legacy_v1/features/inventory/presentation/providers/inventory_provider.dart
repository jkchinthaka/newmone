import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/inventory_remote_datasource.dart';
import '../../data/models/inventory_models.dart';

final inventoryRemoteProvider = Provider<InventoryRemoteDataSource>((ref) {
  return InventoryRemoteDataSource(ref.watch(dioProvider));
});

final inventoryPartsProvider =
    FutureProvider.autoDispose<List<SparePart>>((ref) {
  return ref.watch(inventoryRemoteProvider).listParts();
});

final inventoryPartProvider =
    FutureProvider.autoDispose.family<SparePart, String>((ref, id) {
  return ref.watch(inventoryRemoteProvider).getPart(id);
});

final inventoryPartMovementsProvider =
    FutureProvider.autoDispose.family<List<StockMovement>, String>((ref, id) {
  return ref.watch(inventoryRemoteProvider).movements(id);
});

final inventoryLowStockProvider =
    FutureProvider.autoDispose<List<SparePart>>((ref) {
  return ref.watch(inventoryRemoteProvider).lowStock();
});

final inventoryPurchaseOrdersProvider =
    FutureProvider.autoDispose<List<InventoryPurchaseOrder>>((ref) {
  return ref.watch(inventoryRemoteProvider).purchaseOrders();
});
