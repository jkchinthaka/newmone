import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../../core/config/app_config.dart';
import '../../../../core/storage/token_storage.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../models/gps_ping.dart';

/// Streams of live fleet events from the backend `/fleet` socket namespace.
class FleetSocket {
  FleetSocket(this._ref);
  final Ref _ref;

  io.Socket? _socket;
  final _locationCtrl = StreamController<GpsPing>.broadcast();
  final _alertCtrl = StreamController<FleetAlert>.broadcast();

  Stream<GpsPing> get locationUpdates => _locationCtrl.stream;
  Stream<FleetAlert> get alerts => _alertCtrl.stream;

  Future<void> connect() async {
    if (_socket != null) return;
    final token = await _ref.read(tokenStorageProvider).readAccessToken();
    if (token == null || token.isEmpty) return;

    final base = AppConfig.apiBaseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    final socket = io.io(
      '$base/fleet',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .setExtraHeaders({'Authorization': 'Bearer $token'})
          .build(),
    );

    socket.on('fleet.location.updated', (data) {
      if (data is Map) {
        try {
          final ping = GpsPing.fromJson(Map<String, dynamic>.from(data));
          _locationCtrl.add(ping);
        } catch (_) {}
      }
    });

    socket.on('fleet.alert.created', (data) {
      if (data is Map) {
        try {
          final alert = FleetAlert.fromJson(Map<String, dynamic>.from(data));
          _alertCtrl.add(alert);
        } catch (_) {}
      }
    });

    socket.connect();
    _socket = socket;
  }

  void dispose() {
    _socket?.dispose();
    _socket = null;
  }

  Future<void> shutdown() async {
    dispose();
    await _locationCtrl.close();
    await _alertCtrl.close();
  }
}

final fleetSocketProvider = Provider<FleetSocket>((ref) {
  final socket = FleetSocket(ref);

  ref.listen(authStateProvider, (prev, next) {
    if (next is AuthAuthenticated) {
      socket.connect();
    } else {
      socket.dispose();
    }
  }, fireImmediately: true);

  ref.onDispose(() => socket.shutdown());
  return socket;
});
