import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../data/datasources/billing_remote_datasource.dart';

final billingRemoteProvider = Provider<BillingRemoteDataSource>((ref) {
  return BillingRemoteDataSource(ref.watch(dioProvider));
});

final billingSubscriptionProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(billingRemoteProvider).subscription();
});

final billingUsageProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(billingRemoteProvider).usage();
});
