import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../../core/config/app_config.dart';
import '../../../../core/storage/token_storage.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../models/app_notification.dart';
import '../../presentation/providers/notifications_provider.dart';

/// Maintains a Socket.IO connection to the `/notifications` namespace and
/// pushes incoming events into [notificationsProvider].
class NotificationsSocket {
  NotificationsSocket(this._ref);

  final Ref _ref;
  io.Socket? _socket;

  Future<void> connect() async {
    if (_socket != null) return;
    final token = await _ref.read(tokenStorageProvider).readAccessToken();
    if (token == null || token.isEmpty) return;

    final base = AppConfig.apiBaseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    final socket = io.io(
      '$base/notifications',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .setExtraHeaders({'Authorization': 'Bearer $token'})
          .build(),
    );

    socket.on('notification:new', (data) {
      if (data is Map) {
        try {
          final n = AppNotification.fromJson(
              Map<String, dynamic>.from(data as Map));
          _ref.read(notificationsProvider.notifier).prepend(n);
        } catch (_) {}
      }
    });

    socket.on('notification:read', (_) {
      _ref.read(notificationsProvider.notifier).refreshUnreadCount();
    });

    socket.connect();
    _socket = socket;
  }

  void dispose() {
    _socket?.dispose();
    _socket = null;
  }
}

/// Lifecycle-bound provider: connects when authenticated, disposes on logout.
final notificationsSocketProvider = Provider<NotificationsSocket>((ref) {
  final socket = NotificationsSocket(ref);

  ref.listen(authStateProvider, (prev, next) {
    if (next is AuthAuthenticated) {
      socket.connect();
    } else {
      socket.dispose();
    }
  }, fireImmediately: true);

  ref.onDispose(socket.dispose);
  return socket;
});
