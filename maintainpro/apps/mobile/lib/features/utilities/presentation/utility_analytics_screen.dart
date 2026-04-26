import 'dart:ui';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/utilities_provider.dart';

class UtilityAnalyticsScreen extends ConsumerWidget {
  const UtilityAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final analytics = ref.watch(utilityAnalyticsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Utility analytics')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(utilityAnalyticsProvider),
          child: analytics.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
                child: Text('Failed: $e',
                    style: AppTextStyles.body
                        .copyWith(color: AppColors.error))),
            data: (a) {
              final entries = a.byType.entries.toList();
              final maxVal = entries.isEmpty
                  ? 1.0
                  : entries
                      .map((e) => e.value)
                      .reduce((a, b) => a > b ? a : b);
              return ListView(
                padding: const EdgeInsets.all(AppSpacing.md),
                children: [
                  _Glass(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Overview', style: AppTextStyles.subtitle),
                        const SizedBox(height: AppSpacing.sm),
                        _kv('Total meters', '${a.totalMeters}'),
                        _kv('Active meters', '${a.activeMeters}'),
                        _kv('Total bills', '${a.totalBills}'),
                        _kv('Unpaid bills', '${a.unpaidBills}',
                            color: AppColors.warning),
                        _kv('Overdue bills', '${a.overdueBills}',
                            color: AppColors.error),
                        _kv('Outstanding',
                            '\$${a.totalUnpaidAmount.toStringAsFixed(2)}',
                            color: AppColors.warning),
                        _kv('Spent this month',
                            '\$${a.totalSpentThisMonth.toStringAsFixed(2)}',
                            color: AppColors.primaryLight),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (entries.isNotEmpty)
                    _Glass(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Spend by type', style: AppTextStyles.subtitle),
                          const SizedBox(height: AppSpacing.md),
                          SizedBox(
                            height: 220,
                            child: BarChart(
                              BarChartData(
                                alignment: BarChartAlignment.spaceAround,
                                maxY: maxVal * 1.2,
                                barTouchData: BarTouchData(enabled: true),
                                titlesData: FlTitlesData(
                                  show: true,
                                  rightTitles: const AxisTitles(
                                      sideTitles:
                                          SideTitles(showTitles: false)),
                                  topTitles: const AxisTitles(
                                      sideTitles:
                                          SideTitles(showTitles: false)),
                                  leftTitles: AxisTitles(
                                    sideTitles: SideTitles(
                                      showTitles: true,
                                      reservedSize: 40,
                                      getTitlesWidget: (v, m) => Text(
                                        v.toInt().toString(),
                                        style: AppTextStyles.caption,
                                      ),
                                    ),
                                  ),
                                  bottomTitles: AxisTitles(
                                    sideTitles: SideTitles(
                                      showTitles: true,
                                      getTitlesWidget: (v, m) {
                                        final i = v.toInt();
                                        if (i < 0 || i >= entries.length) {
                                          return const SizedBox.shrink();
                                        }
                                        return Padding(
                                          padding:
                                              const EdgeInsets.only(top: 4),
                                          child: Text(
                                              entries[i].key.substring(0, 3),
                                              style:
                                                  AppTextStyles.caption),
                                        );
                                      },
                                    ),
                                  ),
                                ),
                                gridData: const FlGridData(show: false),
                                borderData: FlBorderData(show: false),
                                barGroups: [
                                  for (var i = 0; i < entries.length; i++)
                                    BarChartGroupData(
                                      x: i,
                                      barRods: [
                                        BarChartRodData(
                                          toY: entries[i].value,
                                          color: _typeColor(entries[i].key),
                                          width: 22,
                                          borderRadius:
                                              BorderRadius.circular(4),
                                        ),
                                      ],
                                    ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          for (final e in entries)
                            _kv(e.key, '\$${e.value.toStringAsFixed(2)}',
                                color: _typeColor(e.key)),
                        ],
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

Color _typeColor(String t) {
  switch (t.toUpperCase()) {
    case 'ELECTRICITY':
      return AppColors.warning;
    case 'WATER':
      return AppColors.info;
    case 'GAS':
      return AppColors.error;
    default:
      return AppColors.primaryLight;
  }
}

class _Glass extends StatelessWidget {
  const _Glass({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          color: AppColors.card.withOpacity(0.7),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: child,
        ),
      ),
    );
  }
}

Widget _kv(String label, String value, {Color? color}) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(children: [
      Expanded(
          child: Text(label, style: AppTextStyles.bodySecondary)),
      Text(value, style: AppTextStyles.body.copyWith(color: color)),
    ]),
  );
}
