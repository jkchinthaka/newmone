import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/widgets/avatar_widget.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../auth/presentation/providers/auth_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            children: [
              const SizedBox(height: AppSpacing.lg),
              Center(
                child: AvatarWidget(
                  name: user?.displayName,
                  size: AvatarSize.xl,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Center(
                child: Text(
                  user?.displayName ?? 'Guest',
                  style: AppTextStyles.display.copyWith(fontSize: 22),
                ),
              ),
              Center(
                child: Text(user?.email ?? '',
                    style: AppTextStyles.bodySecondary),
              ),
              const SizedBox(height: AppSpacing.xs),
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.18),
                    borderRadius: BorderRadius.circular(AppRadius.full),
                    border: Border.all(
                        color: AppColors.primary.withOpacity(0.4)),
                  ),
                  child: Text(
                    (user?.role.name ?? 'viewer').toUpperCase(),
                    style: AppTextStyles.label.copyWith(
                        color: AppColors.primaryLight),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              _Section(title: 'Account', children: [
                _Tile(
                  icon: Icons.person_outline_rounded,
                  label: 'Edit profile',
                  onTap: () => context.go('/profile/edit'),
                ),
                _Tile(
                  icon: Icons.business_outlined,
                  label: 'Switch organization',
                  onTap: () => _showTenantSheet(context),
                ),
              ]),
              const SizedBox(height: AppSpacing.md),
              _Section(title: 'App', children: [
                _Tile(
                  icon: Icons.settings_outlined,
                  label: 'Settings',
                  onTap: () => context.go('/settings'),
                ),
                _Tile(
                  icon: Icons.receipt_long_outlined,
                  label: 'Billing',
                  onTap: () => context.go('/billing'),
                ),
                _Tile(
                  icon: Icons.bar_chart_rounded,
                  label: 'Reports',
                  onTap: () => context.go('/reports'),
                ),
              ]),
              const SizedBox(height: AppSpacing.md),
              _Section(title: 'Support', children: [
                _Tile(
                  icon: Icons.help_outline_rounded,
                  label: 'Help & FAQ',
                  onTap: () {},
                ),
                _Tile(
                  icon: Icons.info_outline_rounded,
                  label: 'About',
                  onTap: () => _showAbout(context),
                ),
              ]),
              const SizedBox(height: AppSpacing.xl),
              FilledButton.tonalIcon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.error.withOpacity(0.15),
                  foregroundColor: AppColors.error,
                ),
                icon: const Icon(Icons.logout_rounded),
                label: const Text('Sign out'),
                onPressed: () async {
                  final ok = await showConfirmDialog(
                    context,
                    title: 'Sign out?',
                    message: 'You will need to sign in again to continue.',
                    confirmLabel: 'Sign out',
                    destructive: true,
                  );
                  if (ok) {
                    HapticFeedback.mediumImpact();
                    await ref.read(authStateProvider.notifier).logout();
                    if (context.mounted) context.go('/login');
                  }
                },
              ),
              const SizedBox(height: AppSpacing.huge),
            ],
          ),
        ),
      ),
    );
  }

  void _showTenantSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => const Padding(
        padding: EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.business_outlined,
                size: 48, color: AppColors.primaryLight),
            SizedBox(height: AppSpacing.md),
            Text('Tenant switching coming soon',
                style: AppTextStyles.subtitle),
            SizedBox(height: AppSpacing.xs),
            Text(
              'You will be able to switch between organizations here.',
              textAlign: TextAlign.center,
              style: AppTextStyles.bodySecondary,
            ),
            SizedBox(height: AppSpacing.lg),
          ],
        ),
      ),
    );
  }

  void _showAbout(BuildContext context) {
    showAboutDialog(
      context: context,
      applicationName: 'MaintainPro',
      applicationVersion: '1.2.0',
      applicationLegalese: '\u00A9 MaintainPro \u00B7 Operations Excellence',
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(
              left: AppSpacing.xs, bottom: AppSpacing.xs),
          child: Text(title.toUpperCase(), style: AppTextStyles.label),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppColors.card.withOpacity(0.85),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primaryLight),
      title: Text(label, style: AppTextStyles.body),
      trailing: const Icon(Icons.chevron_right_rounded,
          color: AppColors.textMuted),
      onTap: onTap,
    );
  }
}
