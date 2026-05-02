import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/inventory_provider.dart';

class InventoryHubScreen extends ConsumerWidget {
  const InventoryHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final parts = ref.watch(inventoryPartsProvider);
    final lowStock = ref.watch(inventoryLowStockProvider);
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Inventory'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(inventoryPartsProvider);
              ref.invalidate(inventoryLowStockProvider);
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
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Inventory at a glance',
                              style: AppTextStyles.subtitle),
                          const SizedBox(height: AppSpacing.md),
                          parts.when(
                            data: (list) {
                              final total = list.length;
                              final lowCount =
                                  list.where((p) => p.isLow).length;
                              final criticalCount =
                                  list.where((p) => p.isCritical).length;
                              final value = list.fold<double>(
                                  0,
                                  (s, p) =>
                                      s + (p.unitCost * p.quantityInStock));
                              return Wrap(
                                spacing: AppSpacing.sm,
                                runSpacing: AppSpacing.sm,
                                children: [
                                  _Stat(
                                      label: 'Parts',
                                      value: '$total',
                                      color: AppColors.primaryLight),
                                  _Stat(
                                      label: 'Low',
                                      value: '$lowCount',
                                      color: AppColors.warning),
                                  _Stat(
                                      label: 'Critical',
                                      value: '$criticalCount',
                                      color: AppColors.error),
                                  _Stat(
                                      label: 'Stock value',
                                      value: '\$${value.toStringAsFixed(0)}',
                                      color: AppColors.success),
                                ],
                              );
                            },
                            loading: () => const SizedBox(
                                height: 40,
                                child:
                                    Center(child: CircularProgressIndicator())),
                            error: (e, _) => Text('Failed: $e',
                                style: AppTextStyles.body
                                    .copyWith(color: AppColors.error)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                lowStock.maybeWhen(
                  data: (l) => l.isEmpty
                      ? const SizedBox.shrink()
                      : InkWell(
                          onTap: () => context.push('/inventory/low-stock'),
                          child: Container(
                            padding: const EdgeInsets.all(AppSpacing.sm),
                            decoration: BoxDecoration(
                              color: AppColors.warning.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(AppRadius.md),
                              border: Border.all(
                                  color: AppColors.warning.withValues(alpha: 0.4)),
                            ),
                            child: Row(children: [
                              const Icon(Icons.warning_amber_rounded,
                                  color: AppColors.warning),
                              const SizedBox(width: AppSpacing.xs),
                              Expanded(
                                child: Text(
                                    '${l.length} part${l.length == 1 ? '' : 's'} below reorder point',
                                    style: AppTextStyles.subtitle),
                              ),
                              const Icon(Icons.chevron_right,
                                  color: AppColors.warning),
                            ]),
                          ),
                        ),
                  orElse: () => const SizedBox.shrink(),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.inventory_2_outlined,
                  title: 'Parts',
                  subtitle: 'Browse, stock-in/out, search',
                  accent: AppColors.primaryLight,
                  onTap: () => context.push('/inventory/parts'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.warning_amber_outlined,
                  title: 'Low stock',
                  subtitle: 'Parts at or below reorder point',
                  accent: AppColors.warning,
                  onTap: () => context.push('/inventory/low-stock'),
                ),
                const SizedBox(height: AppSpacing.sm),
                _Tile(
                  icon: Icons.receipt_long_outlined,
                  title: 'Purchase orders',
                  subtitle: 'Open & received POs',
                  accent: AppColors.info,
                  onTap: () => context.push('/inventory/purchase-orders'),
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
