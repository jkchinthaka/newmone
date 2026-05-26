import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/operations_remote_datasource.dart';

final operationsRemoteProvider = Provider<OperationsRemoteDataSource>((ref) {
  return OperationsRemoteDataSource(ref.watch(dioProvider));
});