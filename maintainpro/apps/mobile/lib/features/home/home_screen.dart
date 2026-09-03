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
          MpPageHeader(
            title: 'Hello, $name',
            subtitle: 'Your field workspace for today.',
            badge: role.replaceAll('_', ' '),
          ),
          if (sync.phase == SyncPhase.offline || sync.pendingCount > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: MpSpacing.lg),
              child: MpCard(
                color: sync.phase == SyncPhase.offline
                    ? Theme.of(context).colorScheme.errorContainer.withValues(alpha: 0.35)
                    : Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.35),
                onTap: () => context.push('/sync'),
                child: Row(
                  children: [
                    Icon(
                      sync.phase == SyncPhase.offline
                          ? Icons.cloud_off
                          : Icons.cloud_sync,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: MpSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            sync.phase == SyncPhase.offline
                                ? AppStrings.offlineBanner
                                : 'Sync pending',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          Text(
                            sync.phase == SyncPhase.offline
                                ? 'Read-only where cached. Mutations queue when back online.'
                                : '${sync.pendingCount} item(s) waiting to sync',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                                ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right),
                  ],
                ),
              ),
            ),
          const MpSectionHeader(title: 'Quick actions', subtitle: 'Role-aware shortcuts'),
          ...cards.map(
            (card) => MpHubTile(
              icon: _icon(card.iconName),
              title: card.title,
              subtitle: card.subtitle,
              onTap: () {
                final route = card.route;
                if (route.startsWith('/work-orders') ||
                    route.startsWith('/diagnostics') ||
                    route.startsWith('/settings') ||
                    route.startsWith('/profile') ||
                    route.startsWith('/sync') ||
                    route.startsWith('/drafts') ||
                    route.startsWith('/search') ||
                    route.startsWith('/gate') ||
                    route.startsWith('/fleet') ||
                    route.startsWith('/fg') ||
                    route.startsWith('/admin') ||
                    route.startsWith('/reports') ||
                    route.startsWith('/farm')) {
                  context.push(route);
                } else {
                  context.go(route);
                }
              },
            ),
          ),
          const SizedBox(height: MpSpacing.sm),
          Center(
            child: TextButton.icon(
              onPressed: () => context.go('/more'),
              icon: const Icon(Icons.apps_outlined),
              label: const Text('Browse all modules'),
            ),
          ),
        ],
      ),
    );
  }
}
