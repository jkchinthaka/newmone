import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/utilities_remote_datasource.dart';
import '../../data/models/utility_models.dart';

final utilitiesRemoteProvider = Provider<UtilitiesRemoteDataSource>((ref) {
  return UtilitiesRemoteDataSource(ref.watch(dioProvider));
});

final utilityMetersProvider =
    FutureProvider.autoDispose<List<UtilityMeter>>((ref) {
  return ref.watch(utilitiesRemoteProvider).meters();
});

final utilityMeterProvider =
    FutureProvider.autoDispose.family<UtilityMeter, String>((ref, id) {
  return ref.watch(utilitiesRemoteProvider).meter(id);
});

final meterReadingsProvider =
    FutureProvider.autoDispose.family<List<MeterReading>, String>((ref, id) {
  return ref.watch(utilitiesRemoteProvider).readings(id);
});

final utilityBillsProvider =
    FutureProvider.autoDispose<List<UtilityBill>>((ref) {
  return ref.watch(utilitiesRemoteProvider).bills();
});

final utilityBillProvider =
    FutureProvider.autoDispose.family<UtilityBill, String>((ref, id) {
  return ref.watch(utilitiesRemoteProvider).bill(id);
});

final utilityBillsOverdueProvider =
    FutureProvider.autoDispose<List<UtilityBill>>((ref) {
  return ref.watch(utilitiesRemoteProvider).overdueBills();
});

final utilityAnalyticsProvider =
    FutureProvider.autoDispose<UtilityAnalytics>((ref) {
  return ref.watch(utilitiesRemoteProvider).analytics();
});
