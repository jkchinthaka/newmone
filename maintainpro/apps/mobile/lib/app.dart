import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/i18n/app_strings.dart';
import 'core/router/app_router.dart';
import 'design_system/design_system.dart';
import 'features/settings/settings_screen.dart';

/// Root MaterialApp with MaintainPro theming and go_router.
class MaintainProApp extends ConsumerWidget {
  const MaintainProApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final themeMode = ref.watch(themeModeProvider);
    return MaterialApp.router(
      title: AppStrings.appName,
      debugShowCheckedModeBanner: false,
      theme: MpTheme.light(),
      darkTheme: MpTheme.dark(),
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}
