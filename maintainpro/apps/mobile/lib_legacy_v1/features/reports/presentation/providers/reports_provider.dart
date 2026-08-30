import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/reports_remote_datasource.dart';

final reportsRemoteProvider = Provider<ReportsRemoteDataSource>((ref) {
  return ReportsRemoteDataSource(ref.watch(dioProvider));
});

final reportsDashboardProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(reportsRemoteProvider).dashboard();
});
final reportsMaintenanceCostProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(reportsRemoteProvider).maintenanceCost();
});
final reportsFleetEfficiencyProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(reportsRemoteProvider).fleetEfficiency();
});
final reportsDowntimeProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(reportsRemoteProvider).downtime();
});
final reportsWorkOrdersProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(reportsRemoteProvider).workOrders();
});
final reportsInventoryProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(reportsRemoteProvider).inventory();
});
final reportsUtilitiesProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(reportsRemoteProvider).utilities();
});
