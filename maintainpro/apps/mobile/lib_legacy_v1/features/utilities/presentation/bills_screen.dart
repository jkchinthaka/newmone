import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/utility_models.dart';
import 'providers/utilities_provider.dart';

class BillsScreen extends ConsumerStatefulWidget {
  const BillsScreen({super.key});
  @override
  ConsumerState<BillsScreen> createState() => _BillsScreenState();
}

class _BillsScreenState extends ConsumerState<BillsScreen> {
  bool _overdueOnly = false;

  @override
  Widget build(BuildContext context) {
    final list = _overdueOnly
        ? ref.watch(utilityBillsOverdueProvider)
        : ref.watch(utilityBillsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Bills')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Row(children: [
              FilterChip(
                label: const Text('Overdue only'),
                selected: _overdueOnly,
                onSelected: (v) => setState(() => _overdueOnly = v),
              ),
            ]),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(utilityBillsProvider);
                ref.invalidate(utilityBillsOverdueProvider);
              },
              child: list.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                    child: Text('Failed: $e',
                        style: AppTextStyles.body
                            .copyWith(color: AppColors.error))),
                data: (items) {
                  if (items.isEmpty) {
                    return ListView(children: const [
                      SizedBox(height: 120),
                      Center(child: Text('No bills')),
                    ]);
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    itemCount: items.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: AppSpacing.xs),
                    itemBuilder: (_, i) => _BillCard(item: items[i]),
                  );
                },
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _BillCard extends StatelessWidget {
  const _BillCard({required this.item});
  final UtilityBill item;
  @override
  Widget build(BuildContext context) {
    final color = item.isPaid
        ? AppColors.success
        : item.isOverdue
            ? AppColors.error
            : AppColors.warning;
    final status = item.isPaid
        ? 'PAID'
        : item.isOverdue
            ? 'OVERDUE'
            : 'UNPAID';
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Material(
          color: AppColors.card.withValues(alpha: 0.7),
          child: InkWell(
            onTap: () => context.push('/utilities/bills/${item.id}'),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                      child: Text(
                        '${item.meterType ?? 'Bill'} · #${item.meterNumber ?? '—'}',
                        style: AppTextStyles.subtitle,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xs, vertical: 2),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                      ),
                      child: Text(status,
                          style: AppTextStyles.label.copyWith(color: color)),
                    ),
                  ]),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    '${_d(item.billingPeriodStart)} → ${_d(item.billingPeriodEnd)}',
                    style: AppTextStyles.caption,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(children: [
                    Text('\$${item.totalAmount.toStringAsFixed(2)}',
                        style: AppTextStyles.title
                            .copyWith(color: AppColors.primaryLight)),
                    const Spacer(),
                    if (item.dueDate != null)
                      Text('Due ${_d(item.dueDate!)}',
                          style: AppTextStyles.caption),
                  ]),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _d(DateTime d) {
  final l = d.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${l.year}-${two(l.month)}-${two(l.day)}';
}
