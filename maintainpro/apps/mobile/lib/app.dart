import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme.dart';
import 'core/widgets/offline_banner.dart';

class MaintainProApp extends ConsumerWidget {
  const MaintainProApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
