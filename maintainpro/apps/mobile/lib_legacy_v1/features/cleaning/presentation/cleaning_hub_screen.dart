import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../../../shared/models/app_user.dart';

class CleaningHubScreen extends ConsumerWidget {
  const CleaningHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final isCleaner = user?.role == UserRole.cleaner;
    final canSupervise = user?.role == UserRole.admin ||
        user?.role == UserRole.superAdmin ||
        user?.role == UserRole.manager ||
        user?.role == UserRole.supervisor;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Cleaning'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner_rounded),
            tooltip: 'Scan location',
            onPressed: () => context.push('/cleaning/scan'),
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              _HubTile(
                icon: Icons.qr_code_scanner_rounded,
                title: 'Scan to clean',
                subtitle: 'Start a cleaning visit by scanning the location QR',
                accent: AppColors.primaryLight,
                onTap: () => context.push('/cleaning/scan'),
              ),
              const SizedBox(height: AppSpacing.sm),
              _HubTile(
                icon: Icons.location_on_outlined,
                title: 'Locations',
                subtitle: 'Browse facilities, schedules and QR codes',
                accent: AppColors.info,
                onTap: () => context.push('/cleaning/locations'),
              ),
              const SizedBox(height: AppSpacing.sm),
              _HubTile(
                icon: Icons.fact_check_outlined,
                title: isCleaner ? 'My visits' : 'All visits',
                subtitle: 'Track completed and pending cleaning visits',
                accent: AppColors.success,
                onTap: () => context.push('/cleaning/visits'),
              ),
              const SizedBox(height: AppSpacing.sm),
              _HubTile(
                icon: Icons.report_gmailerrorred_outlined,
                title: 'Facility issues',
                subtitle: 'Report and follow up on cleaning issues',
                accent: AppColors.warning,
                onTap: () => context.push('/cleaning/issues'),
              ),
              if (canSupervise) ...[
                const SizedBox(height: AppSpacing.sm),
                _HubTile(
                  icon: Icons.dashboard_outlined,
                  title: 'Sign-off queue',
                  subtitle: 'Review submissions waiting for sign-off',
                  accent: AppColors.secondary,
                  onTap: () => context.push('/cleaning/signoff'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _HubTile(
                  icon: Icons.insights_outlined,
                  title: 'Analytics',
                  subtitle: 'Visits, quality and cleaner performance',
                  accent: AppColors.info,
                  onTap: () => context.push('/cleaning/analytics'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _HubTile extends StatelessWidget {
  const _HubTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Material(
          color: AppColors.card.withValues(alpha: 0.7),
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Icon(icon, color: accent),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AppTextStyles.subtitle),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(subtitle, style: AppTextStyles.bodySecondary),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded,
                      color: AppColors.textSecondary),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
