import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/suppliers_remote_datasource.dart';
import '../../data/models/supplier.dart';

final suppliersRemoteProvider = Provider<SuppliersRemoteDataSource>((ref) {
  return SuppliersRemoteDataSource(ref.watch(dioProvider));
});

final suppliersProvider = FutureProvider.autoDispose<List<Supplier>>((ref) {
  return ref.watch(suppliersRemoteProvider).list();
});

final supplierProvider =
    FutureProvider.autoDispose.family<Supplier, String>((ref, id) {
  return ref.watch(suppliersRemoteProvider).getById(id);
});
