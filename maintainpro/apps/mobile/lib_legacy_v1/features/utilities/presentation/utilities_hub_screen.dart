import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/utilities_provider.dart';

class UtilitiesHubScreen extends ConsumerWidget {
  const UtilitiesHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final analytics = ref.watch(utilityAnalyticsProvider);
    final overdue = ref.watch(utilityBillsOverdueProvider);
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Utilities'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(utilityAnalyticsProvider);
              ref.invalidate(utilityBillsOverdueProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                    child: Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      color: AppColors.card.withValues(alpha: 0.7),
                      child: analytics.when(
                        loading: () => const SizedBox(
                            height: 80,
                            child: Center(child: CircularProgressIndicator())),
                        error: (e, _) => Text('Failed: $e',
                            style: AppTextStyles.body
                                .copyWith(color: AppColors.error)),
                        data: (a) => Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('This month', style: AppTextStyles.subtitle),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                                '\$${a.totalSpentThisMonth.toStringAsFixed(2)}',
                                style: AppTextStyles.title
                                    .copyWith(color: AppColors.primaryLight)),
                            const SizedBox(height: AppSpacing.md),
                            Wrap(
                              spacing: AppSpacing.sm,
                              runSpacing: AppSpacing.sm,
                              children: [
                                _Stat(
                                    label: 'Meters',
                                    value: '${a.activeMeters}/${a.totalMeters}',
                                    color: AppColors.primaryLight),
                                _Stat(
                                    label: 'Unpaid',
                                    value: '${a.unpaidBills}',
                                    color: AppColors.warning),
                                _Stat(
                                    label: 'Overdue',
                                    value: '${a.overdueBills}',
                                    color: AppColors.error),
                                _Stat(
                                    label: 'Outstanding',
                                    value:
                                        '\$${a.totalUnpaidAmount.toStringAsFixed(0)}',
                                    color: AppColors.warning),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                overdue.maybeWhen(
                  data: (l) => l.isEmpty
                      ? const SizedBox.shrink()
                      : InkWell(
                          onTap: () => context.push('/utilities/bills'),
                          child: Container(
                            padding: const EdgeInsets.all(AppSpacing.sm),
                            decoration: BoxDecoration(
                              color: AppColors.error.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(AppRadius.md),
                              border: Border.all(
                                  color: AppColors.error.withValues(alpha: 0.4)),
                            ),
                            child: Row(children: [
                              const Icon(Icons.receipt_long,
                                  color: AppColors.error),
                              const SizedBox(width: AppSpacing.xs),
                              Expanded(
                                child: Text(
                                    '${l.length} overdue bill${l.length == 1 ? '' : 's'}',
                                    style: AppTextStyles.subtitle),
                              ),
                              const Icon(Icons.chevron_right,
                                  color: AppColors.error),
                            ]),
                          ),
                        ),
                  orElse: () => const SizedBox.shrink(),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.speed_outlined,
                  title: 'Meters',
                  subtitle: 'Electricity, water & gas meters',
                  accent: AppColors.primaryLight,
                  onTap: () => context.push('/utilities/meters'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.receipt_long_outlined,
                  title: 'Bills',
                  subtitle: 'Pay & track utility bills',
                  accent: AppColors.warning,
                  onTap: () => context.push('/utilities/bills'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.bar_chart,
                  title: 'Analytics',
                  subtitle: 'Consumption by type',
                  accent: AppColors.info,
                  onTap: () => context.push('/utilities/analytics'),
                ),
              ],
            ),
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
              child: Row(children: [
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
                const Icon(Icons.chevron_right, color: AppColors.textSecondary),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
