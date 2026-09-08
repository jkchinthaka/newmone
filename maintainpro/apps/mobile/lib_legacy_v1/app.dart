import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'features/notifications/presentation/providers/push_notifications_provider.dart';
import 'core/network/connectivity_provider.dart';
import 'core/offline/offline_sync.dart';
import 'core/router/app_router.dart';
import 'core/theme.dart';
import 'core/widgets/offline_banner.dart';

class MaintainProApp extends ConsumerStatefulWidget {
  const MaintainProApp({super.key});

  @override
  ConsumerState<MaintainProApp> createState() => _MaintainProAppState();
}

class _MaintainProAppState extends ConsumerState<MaintainProApp> {
  ProviderSubscription<bool>? _onlineSubscription;

  @override
  void initState() {
    super.initState();
    _onlineSubscription = ref.listenManual<bool>(
      isOnlineProvider,
      (previous, next) {
        if (next && previous != true) {
          unawaited(ref.read(offlineSyncControllerProvider).replayPending());
        }
      },
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_replayQueuedActionsOnLaunch());
      unawaited(ref.read(pushNotificationsServiceProvider).bootstrap());
    });
  }

  Future<void> _replayQueuedActionsOnLaunch() async {
    final results = await Connectivity().checkConnectivity();
    if (!mounted) {
      return;
    }
    if (results.any((result) => result != ConnectivityResult.none)) {
      await ref.read(offlineSyncControllerProvider).replayPending();
    }
  }

  @override
  void dispose() {
    _onlineSubscription?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(offlineSyncControllerProvider);

    return MaterialApp.router(
      title: 'MaintainPro',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      routerConfig: appRouter,
      builder: (context, child) {
        return Stack(
          children: [
            child ?? const SizedBox.shrink(),
            const Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: SafeArea(child: OfflineBanner()),
            ),
          ],
        );
      },
    );
  }
}
