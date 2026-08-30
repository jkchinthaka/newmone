import 'package:flutter/material.dart';

import '../../core/i18n/app_strings.dart';
import '../../design_system/design_system.dart';
import '../shell/adaptive_shell.dart';

class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.navAlerts),
        actions: shellActions(context),
      ),
      body: const MpEmptyState(
        title: AppStrings.emptyAlerts,
        message: 'Push and in-app alerts will appear here.',
        icon: Icons.notifications_none,
      ),
    );
  }
}
