import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Stream of connectivity results from the device.
final connectivityStreamProvider =
    StreamProvider<List<ConnectivityResult>>((ref) {
  return Connectivity().onConnectivityChanged;
});

/// True when the device has at least one non-`none` connection.
/// Defaults to online while the first reading is pending.
final isOnlineProvider = Provider<bool>((ref) {
  final async = ref.watch(connectivityStreamProvider);
  final results = async.value;
  if (results == null || results.isEmpty) return true;
  return results.any((r) => r != ConnectivityResult.none);
});
