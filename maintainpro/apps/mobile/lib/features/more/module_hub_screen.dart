import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/i18n/app_strings.dart';
import '../../core/rbac/nav_policy.dart';
import '../../design_system/design_system.dart';
import '../shell/adaptive_shell.dart';

class ModuleHubScreen extends ConsumerWidget {
  const ModuleHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final role = auth.user?.role ?? 'VIEWER';
    final permissions = auth.user?.permissions ?? const [];
    final groups = NavPolicy.visibleGroups(
      role: role,
      permissions: permissions,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.moduleHubTitle),
        actions: [
          ...shellActions(context),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          MpCard(
            onTap: () => context.push('/drafts'),
            child: const MpListTile(
              title: AppStrings.draftsTitle,
              subtitle: 'Local unsynced drafts',
              leading: Icon(Icons.drafts_outlined),
            ),
          ),
          const SizedBox(height: MpSpacing.sm),
          MpCard(
            onTap: () => context.push('/sync'),
            child: const MpListTile(
              title: AppStrings.syncTitle,
              subtitle: 'Outbox and connectivity',
              leading: Icon(Icons.cloud_sync_outlined),
            ),
          ),
          const SizedBox(height: MpSpacing.sm),
          MpCard(
            onTap: () => context.push('/settings'),
            child: const MpListTile(
              title: AppStrings.settingsTitle,
              subtitle: 'Preferences',
              leading: Icon(Icons.settings_outlined),
            ),
          ),
          for (final group in groups) ...[
            MpSectionHeader(title: group.label),
            MpCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (var i = 0; i < group.items.length; i++) ...[
                    MpListTile(
                      title: group.items[i].label,
                      subtitle: group.items[i].description,
                      onTap: () {
                        final route = group.items[i].route;
                        if (route == '/more') {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(AppStrings.comingSoon),
                            ),
                          );
                        } else if (route.startsWith('/work-orders') ||
                            route.startsWith('/diagnostics') ||
                            route.startsWith('/settings') ||
                            route.startsWith('/gate') ||
                            route.startsWith('/fg')) {
                          context.push(route);
                        } else {
                          context.go(route);
                        }
                      },
                    ),
                    if (i < group.items.length - 1) const Divider(height: 1),
                  ],
                ],
              ),
            ),
          ],
          const SizedBox(height: MpSpacing.xxl),
        ],
      ),
    );
  }
}
