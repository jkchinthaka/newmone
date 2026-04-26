import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/inventory_models.dart';
import 'providers/inventory_provider.dart';

class PurchaseOrdersScreen extends ConsumerWidget {
  const PurchaseOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pos = ref.watch(inventoryPurchaseOrdersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Purchase orders')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreatePO(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('New PO'),
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(inventoryPurchaseOrdersProvider),
          child: pos.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
                child: Text('Failed: $e',
                    style:
                        AppTextStyles.body.copyWith(color: AppColors.error))),
            data: (list) {
              if (list.isEmpty) {
                return ListView(children: const [
                  SizedBox(height: 120),
                  Center(child: Text('No purchase orders yet')),
                ]);
              }
              return ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: list.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: AppSpacing.xs),
                itemBuilder: (_, i) => _POCard(
                  item: list[i],
                  onUpdate: (status) async {
                    try {
                      await ref
                          .read(inventoryRemoteProvider)
                          .updatePurchaseOrder(list[i].id,
                              status: status,
                              receivedDate:
                                  status == 'RECEIVED' ? DateTime.now() : null);
                      ref.invalidate(inventoryPurchaseOrdersProvider);
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Failed: $e')),
                        );
                      }
                    }
                  },
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _POCard extends StatelessWidget {
  const _POCard({required this.item, required this.onUpdate});
  final InventoryPurchaseOrder item;
  final ValueChanged<String> onUpdate;
  @override
  Widget build(BuildContext context) {
    final color = _statusColor(item.status);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          color: AppColors.card.withValues(alpha: 0.7),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                    child: Text('PO ${item.poNumber}',
                        style: AppTextStyles.subtitle)),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.xs, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                  ),
                  child: Text(item.status,
                      style: AppTextStyles.label.copyWith(color: color)),
                ),
              ]),
              const SizedBox(height: AppSpacing.xs),
              if (item.supplierName != null)
                Text(item.supplierName!, style: AppTextStyles.bodySecondary),
              Text('Order: ${_fmt(item.orderDate)}',
                  style: AppTextStyles.caption),
              if (item.expectedDate != null)
                Text('Expected: ${_fmt(item.expectedDate!)}',
                    style: AppTextStyles.caption),
              const SizedBox(height: AppSpacing.xs),
              Text('\$${item.totalAmount.toStringAsFixed(2)}',
                  style: AppTextStyles.subtitle
                      .copyWith(color: AppColors.success)),
              if (item.status != 'RECEIVED' && item.status != 'CANCELLED') ...[
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: AppSpacing.xs,
                  children: [
                    if (item.status == 'PENDING')
                      OutlinedButton(
                        onPressed: () => onUpdate('ORDERED'),
                        child: const Text('Mark ordered'),
                      ),
                    if (item.status == 'ORDERED' ||
                        item.status == 'PARTIALLY_RECEIVED')
                      FilledButton(
                        onPressed: () => onUpdate('RECEIVED'),
                        child: const Text('Mark received'),
                      ),
                    TextButton(
                      onPressed: () => onUpdate('CANCELLED'),
                      child: const Text('Cancel'),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

Color _statusColor(String s) {
  switch (s) {
    case 'PENDING':
      return AppColors.warning;
    case 'ORDERED':
      return AppColors.info;
    case 'PARTIALLY_RECEIVED':
      return AppColors.primaryLight;
    case 'RECEIVED':
      return AppColors.success;
    case 'CANCELLED':
      return AppColors.textSecondary;
    default:
      return AppColors.textSecondary;
  }
}

String _fmt(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

Future<void> _showCreatePO(BuildContext context, WidgetRef ref) async {
  final poCtrl = TextEditingController();
  final supplierCtrl = TextEditingController();
  final amountCtrl = TextEditingController();
  final notesCtrl = TextEditingController();
  DateTime orderDate = DateTime.now();
  DateTime? expectedDate;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    builder: (ctx) {
      return StatefulBuilder(builder: (ctx, setState) {
        return Padding(
          padding: EdgeInsets.only(
            left: AppSpacing.md,
            right: AppSpacing.md,
            top: AppSpacing.md,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.md,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('New purchase order', style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: poCtrl,
                  decoration: const InputDecoration(labelText: 'PO number'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: supplierCtrl,
                  decoration: const InputDecoration(labelText: 'Supplier ID'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: amountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Total amount'),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.calendar_month),
                      label: Text('Order: ${_fmt(orderDate)}'),
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2035),
                          initialDate: orderDate,
                        );
                        if (picked != null) {
                          setState(() => orderDate = picked);
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.event),
                      label: Text(expectedDate == null
                          ? 'Expected'
                          : _fmt(expectedDate!)),
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2035),
                          initialDate: expectedDate ?? DateTime.now(),
                        );
                        if (picked != null) {
                          setState(() => expectedDate = picked);
                        }
                      },
                    ),
                  ),
                ]),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: notesCtrl,
                  decoration: const InputDecoration(labelText: 'Notes'),
                  maxLines: 2,
                ),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: () async {
                    if (poCtrl.text.trim().isEmpty ||
                        supplierCtrl.text.trim().isEmpty) {
                      return;
                    }
                    try {
                      await ref
                          .read(inventoryRemoteProvider)
                          .createPurchaseOrder(
                            poNumber: poCtrl.text.trim(),
                            supplierId: supplierCtrl.text.trim(),
                            orderDate: orderDate,
                            expectedDate: expectedDate,
                            totalAmount: double.tryParse(amountCtrl.text) ?? 0,
                            notes: notesCtrl.text.trim().isEmpty
                                ? null
                                : notesCtrl.text.trim(),
                          );
                      if (ctx.mounted) Navigator.of(ctx).pop();
                      ref.invalidate(inventoryPurchaseOrdersProvider);
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          SnackBar(content: Text('Failed: $e')),
                        );
                      }
                    }
                  },
                  child: const Text('Create'),
                ),
              ],
            ),
          ),
        );
      });
    },
  );
}
