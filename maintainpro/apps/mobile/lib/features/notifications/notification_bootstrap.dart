import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/auth_session.dart';
import '../../core/router/app_router.dart';
import 'data/notifications_api_client.dart';
import 'push_notifications_service.dart';

/// Registers FCM after login and unregisters on logout.
class NotificationBootstrap extends ConsumerStatefulWidget {
  const NotificationBootstrap({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<NotificationBootstrap> createState() =>
      _NotificationBootstrapState();
}

class _NotificationBootstrapState extends ConsumerState<NotificationBootstrap> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncAuth(
          ref.read(authControllerProvider),
        ));
  }

  void _syncAuth(AuthState auth) {
    if (auth.isAuthenticated) {
      ref.read(pushNotificationsServiceProvider).bootstrap(
            onDeepLink: (route) {
              if (!mounted) return;
              ref.read(appRouterProvider).push(route);
            },
          );
      unawaited(_refreshUnread());
    }
  }

  Future<void> _refreshUnread() async {
    try {
      final count =
          await ref.read(notificationsApiClientProvider).unreadCount();
      ref.read(unreadNotificationsCountProvider.notifier).state = count;
    } catch (_) {
      // Badge is best-effort.
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authControllerProvider, (prev, next) async {
      if (next.isAuthenticated && prev?.isAuthenticated != true) {
        _syncAuth(next);
      }
      if (!next.isAuthenticated && prev?.isAuthenticated == true) {
        await ref.read(pushNotificationsServiceProvider).unregisterDevice();
        ref.read(unreadNotificationsCountProvider.notifier).state = 0;
      }
    });

    return widget.child;
  }
}
