import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/i18n/app_strings.dart';
import '../../core/offline/sync_controller.dart';
import '../../core/rbac/role_home_config.dart';
import '../../design_system/design_system.dart';
import '../shell/adaptive_shell.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  IconData _icon(String name) {
    switch (name) {
      case 'assignment':
        return Icons.assignment_outlined;
      case 'photo_camera':
        return Icons.photo_camera_outlined;
      case 'build':
        return Icons.build_outlined;
      case 'qr_code_scanner':
        return Icons.qr_code_scanner;
      case 'verified':
        return Icons.verified_outlined;
      case 'notifications_active':
        return Icons.notifications_active_outlined;
      case 'warning':
        return Icons.warning_amber_outlined;
      case 'grid_view':
        return Icons.grid_view;
      case 'local_shipping':
        return Icons.local_shipping_outlined;
      case 'directions_car':
        return Icons.directions_car_outlined;
      case 'notifications':
        return Icons.notifications_outlined;
      case 'monitor_heart':
        return Icons.monitor_heart_outlined;
      case 'admin_panel_settings':
        return Icons.admin_panel_settings_outlined;
      case 'task_alt':
        return Icons.task_alt;
      case 'apps':
        return Icons.apps;
      default:
        return Icons.home_outlined;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final sync = ref.watch(syncControllerProvider);
    final user = auth.user;
    final role = user?.role ?? 'VIEWER';
    final cards = RoleHomeConfig.cardsForRole(role);
    final name = user?.name.isNotEmpty == true ? user!.name : 'there';

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.appName),
        actions: shellActions(context),
      ),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          Text(
            'Hello, $name',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: MpSpacing.xs),
          Text(
            role.replaceAll('_', ' '),
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: MpSpacing.md),
          if (sync.phase == SyncPhase.offline || sync.pendingCount > 0)
            MpCard(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              onTap: () => context.push('/sync'),
              child: Row(
                children: [
                  Icon(
                    sync.phase == SyncPhase.offline
                        ? Icons.cloud_off
                        : Icons.cloud_sync,
                  ),
                  const SizedBox(width: MpSpacing.md),
                  Expanded(
                    child: Text(
                      sync.phase == SyncPhase.offline
                          ? AppStrings.offlineBanner
                          : '${sync.pendingCount} pending sync item(s)',
                    ),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
            ),
          MpSectionHeader(
            title: 'Shortcuts',
            subtitle: 'Role-aware workspace',
            actionLabel: 'Modules',
            onAction: () => context.go('/more'),
          ),
          ...cards.map(
            (card) => Padding(
              padding: const EdgeInsets.only(bottom: MpSpacing.md),
              child: MpCard(
                onTap: () {
                  final route = card.route;
                  if (route.startsWith('/work-orders') ||
                      route.startsWith('/diagnostics') ||
                      route.startsWith('/settings') ||
                      route.startsWith('/profile') ||
                      route.startsWith('/sync') ||
                      route.startsWith('/drafts') ||
                      route.startsWith('/search')) {
                    context.push(route);
                  } else {
                    context.go(route);
                  }
                },
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: Theme.of(context)
                          .colorScheme
                          .primary
                          .withValues(alpha: 0.12),
                      child: Icon(
                        _icon(card.iconName),
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: MpSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            card.title,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: MpSpacing.xxs),
                          Text(
                            card.subtitle,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
