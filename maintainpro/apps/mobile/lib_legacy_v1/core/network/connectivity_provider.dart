import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Stream of the current set of connectivity results from the device.
/// Emits whenever the device gains/loses Wi-Fi, mobile, ethernet, etc.
final connectivityStreamProvider =
    StreamProvider<List<ConnectivityResult>>((ref) {
  return Connectivity().onConnectivityChanged;
});

/// Convenience boolean — true when the device has at least one non-`none`
/// connection. Useful for showing "You're offline" banners.
final isOnlineProvider = Provider<bool>((ref) {
  final async = ref.watch(connectivityStreamProvider);
  final results = async.value;
  if (results == null || results.isEmpty) return true;
  return results.any((r) => r != ConnectivityResult.none);
});
