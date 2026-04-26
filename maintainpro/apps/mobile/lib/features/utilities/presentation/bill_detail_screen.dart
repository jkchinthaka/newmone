import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import 'providers/utilities_provider.dart';

class BillDetailScreen extends ConsumerWidget {
  const BillDetailScreen({super.key, required this.billId});
  final String billId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(utilityBillProvider(billId));
    return Scaffold(
      appBar: AppBar(title: const Text('Bill')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(utilityBillProvider(billId)),
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
                child: Text('Failed: $e',
                    style:
                        AppTextStyles.body.copyWith(color: AppColors.error))),
            data: (b) {
              final color = b.isPaid
                  ? AppColors.success
                  : b.isOverdue
                      ? AppColors.error
                      : AppColors.warning;
              return ListView(
                padding: const EdgeInsets.all(AppSpacing.md),
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                      child: Container(
                        color: AppColors.card.withOpacity(0.7),
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              Expanded(
                                child: Text(
                                    '${b.meterType ?? 'Bill'} · #${b.meterNumber ?? '—'}',
                                    style: AppTextStyles.title),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: AppSpacing.sm, vertical: 4),
                                decoration: BoxDecoration(
                                  color: color.withOpacity(0.15),
                                  borderRadius:
                                      BorderRadius.circular(AppRadius.sm),
                                ),
                                child: Text(
                                  b.isPaid
                                      ? 'PAID'
                                      : b.isOverdue
                                          ? 'OVERDUE'
                                          : 'UNPAID',
                                  style: AppTextStyles.label
                                      .copyWith(color: color),
                                ),
                              ),
                            ]),
                            const Divider(height: AppSpacing.lg),
                            _Row(
                                label: 'Billing period',
                                value:
                                    '${_d(b.billingPeriodStart)} → ${_d(b.billingPeriodEnd)}'),
                            _Row(
                                label: 'Consumption',
                                value: b.totalConsumption.toStringAsFixed(2)),
                            _Row(
                                label: 'Rate per unit',
                                value: '\$${b.ratePerUnit.toStringAsFixed(4)}'),
                            _Row(
                                label: 'Base charge',
                                value: '\$${b.baseCharge.toStringAsFixed(2)}'),
                            _Row(
                                label: 'Tax',
                                value: '\$${b.taxAmount.toStringAsFixed(2)}'),
                            const Divider(height: AppSpacing.md),
                            _Row(
                              label: 'Total',
                              value: '\$${b.totalAmount.toStringAsFixed(2)}',
                              valueColor: AppColors.primaryLight,
                            ),
                            if (b.dueDate != null)
                              _Row(label: 'Due date', value: _d(b.dueDate!)),
                            if (b.paidAt != null)
                              _Row(label: 'Paid at', value: _d(b.paidAt!)),
                            if (b.notes != null)
                              _Row(label: 'Notes', value: b.notes!),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (!b.isPaid)
                    FilledButton.icon(
                      icon: const Icon(Icons.payments_outlined),
                      label: const Text('Mark as paid'),
                      onPressed: () async {
                        try {
                          await ref.read(utilitiesRemoteProvider).payBill(b.id);
                          ref.invalidate(utilityBillProvider(billId));
                          ref.invalidate(utilityBillsProvider);
                          ref.invalidate(utilityBillsOverdueProvider);
                          ref.invalidate(utilityAnalyticsProvider);
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Failed: $e')),
                            );
                          }
                        }
                      },
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

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.valueColor});
  final String label;
  final String value;
  final Color? valueColor;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
            flex: 2, child: Text(label, style: AppTextStyles.bodySecondary)),
        Expanded(
          flex: 3,
          child: Text(value,
              style: AppTextStyles.body.copyWith(color: valueColor)),
        ),
      ]),
    );
  }
}

String _d(DateTime d) {
  final l = d.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${l.year}-${two(l.month)}-${two(l.day)}';
}
