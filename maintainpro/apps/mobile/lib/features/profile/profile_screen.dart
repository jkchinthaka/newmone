import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/i18n/app_strings.dart';
import '../../core/tenant/tenant_context.dart';
import '../../design_system/design_system.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final tenant = ref.watch(tenantContextProvider);
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.profileTitle)),
      body: ListView(
        padding: const EdgeInsets.all(MpSpacing.screenPadding),
        children: [
          MpCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Theme.of(context)
                      .colorScheme
                      .primary
                      .withValues(alpha: 0.15),
                  child: Text(
                    (user?.name.isNotEmpty == true
                            ? user!.name[0]
                            : '?')
                        .toUpperCase(),
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          color: Theme.of(context).colorScheme.primary,
                        ),
                  ),
                ),
                const SizedBox(width: MpSpacing.lg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.name ?? 'User',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      Text(user?.email ?? ''),
                      const SizedBox(height: MpSpacing.xs),
                      MpStatusChip(
                        label: (user?.role ?? 'VIEWER').replaceAll('_', ' '),
                        tone: MpStatusTone.primary,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: MpSpacing.lg),
          MpCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                MpListTile(
                  title: 'Tenant',
                  subtitle: tenant.tenantId ?? 'Not set',
                  leading: const Icon(Icons.apartment_outlined),
                ),
                const Divider(height: 1),
                MpListTile(
                  title: AppStrings.settingsTitle,
                  leading: const Icon(Icons.settings_outlined),
                  onTap: () => context.push('/settings'),
                ),
                const Divider(height: 1),
                MpListTile(
                  title: AppStrings.diagnosticsTitle,
                  leading: const Icon(Icons.monitor_heart_outlined),
                  onTap: () => context.push('/diagnostics'),
                ),
              ],
            ),
          ),
          const SizedBox(height: MpSpacing.xl),
          MpButton(
            label: AppStrings.signOut,
            variant: MpButtonVariant.outlined,
            icon: Icons.logout,
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
    );
  }
}
