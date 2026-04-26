import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/maintenance_provider.dart';

class MaintenanceHubScreen extends ConsumerWidget {
  const MaintenanceHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedules = ref.watch(maintenanceSchedulesProvider);
    final alerts = ref.watch(maintenancePredictiveAlertsProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Maintenance'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(maintenanceSchedulesProvider);
              ref.invalidate(maintenancePredictiveAlertsProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                schedules.when(
                  data: (list) => _SummaryCard(
                    total: list.length,
                    overdue: list.where((s) => s.isOverdue).length,
                    dueSoon: list.where((s) => s.isDueSoon).length,
                    active: list.where((s) => s.isActive).length,
                  ),
                  loading: () => const _SkeletonCard(),
                  error: (e, _) =>
                      _ErrorCard(message: 'Failed to load schedules: $e'),
                ),
                const SizedBox(height: AppSpacing.md),
                alerts.maybeWhen(
                  data: (a) => a.isEmpty
                      ? const SizedBox.shrink()
                      : _AlertsBanner(count: a.length),
                  orElse: () => const SizedBox.shrink(),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.event_repeat_outlined,
                  title: 'Schedules',
                  subtitle: 'Preventive · predictive · inspections',
                  accent: AppColors.primaryLight,
                  onTap: () => context.push('/maintenance/schedules'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.list_alt_outlined,
                  title: 'Service logs',
                  subtitle: 'Performed maintenance history',
                  accent: AppColors.info,
                  onTap: () => context.push('/maintenance/logs'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.calendar_month_outlined,
                  title: 'Calendar',
                  subtitle: 'Upcoming services by date',
                  accent: AppColors.success,
                  onTap: () => context.push('/maintenance/calendar'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.psychology_outlined,
                  title: 'Predictive alerts',
                  subtitle: 'AI-driven service risk warnings',
                  accent: AppColors.warning,
                  onTap: () => context.push('/maintenance/alerts'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.total,
    required this.overdue,
    required this.dueSoon,
    required this.active,
  });
  final int total;
  final int overdue;
  final int dueSoon;
  final int active;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          color: AppColors.card.withValues(alpha: 0.7),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Maintenance overview', style: AppTextStyles.subtitle),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  _Stat(
                      label: 'Total',
                      value: '$total',
                      color: AppColors.primaryLight),
                  _Stat(
                      label: 'Active',
                      value: '$active',
                      color: AppColors.success),
                  _Stat(
                      label: 'Due soon',
                      value: '$dueSoon',
                      color: AppColors.warning),
                  _Stat(
                      label: 'Overdue',
                      value: '$overdue',
                      color: AppColors.error),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(value, style: AppTextStyles.subtitle.copyWith(color: color)),
          Text(label, style: AppTextStyles.caption),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
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
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Icon(icon, color: accent),
                  ),
                  const SizedBox(width: AppSpacing.sm),
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
                  const Icon(Icons.chevron_right,
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

class _AlertsBanner extends StatelessWidget {
  const _AlertsBanner({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => GoRouter.of(context).push('/maintenance/alerts'),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: AppColors.warning.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
        ),
        child: Row(children: [
          const Icon(Icons.warning_amber_rounded, color: AppColors.warning),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Text(
              '$count predictive alert${count == 1 ? '' : 's'}',
              style: AppTextStyles.subtitle,
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.warning),
        ]),
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 140,
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.4)),
      ),
      child: Text(message,
          style: AppTextStyles.body.copyWith(color: AppColors.error)),
    );
  }
}
