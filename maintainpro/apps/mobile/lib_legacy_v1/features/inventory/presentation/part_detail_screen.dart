import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/inventory_models.dart';
import 'providers/inventory_provider.dart';

class PartDetailScreen extends ConsumerWidget {
  const PartDetailScreen({super.key, required this.partId});
  final String partId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final part = ref.watch(inventoryPartProvider(partId));
    final movements = ref.watch(inventoryPartMovementsProvider(partId));
    return Scaffold(
      appBar: AppBar(title: const Text('Part details')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(inventoryPartProvider(partId));
            ref.invalidate(inventoryPartMovementsProvider(partId));
          },
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              part.when(
                loading: () => const Center(
                    child: Padding(
                  padding: EdgeInsets.all(AppSpacing.lg),
                  child: CircularProgressIndicator(),
                )),
                error: (e, _) => Text('Failed: $e',
                    style: AppTextStyles.body.copyWith(color: AppColors.error)),
                data: (p) => _PartCard(item: p),
              ),
              const SizedBox(height: AppSpacing.md),
              part.maybeWhen(
                data: (p) => Row(children: [
                  Expanded(
                    child: FilledButton.icon(
                      icon: const Icon(Icons.add),
                      label: const Text('Stock in'),
                      onPressed: () =>
                          _showStockSheet(context, ref, partId, true),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.remove),
                      label: const Text('Stock out'),
                      onPressed: () =>
                          _showStockSheet(context, ref, partId, false),
                    ),
                  ),
                ]),
                orElse: () => const SizedBox.shrink(),
              ),
              const SizedBox(height: AppSpacing.md),
              const Text('Recent movements', style: AppTextStyles.subtitle),
              const SizedBox(height: AppSpacing.xs),
              movements.when(
                loading: () => const Center(
                    child: Padding(
                  padding: EdgeInsets.all(AppSpacing.lg),
                  child: CircularProgressIndicator(),
                )),
                error: (e, _) => Text('Failed: $e',
                    style: AppTextStyles.body.copyWith(color: AppColors.error)),
                data: (list) => list.isEmpty
                    ? const Padding(
                        padding:
                            EdgeInsets.symmetric(vertical: AppSpacing.md),
                        child: Text('No movements yet',
                            style: AppTextStyles.bodySecondary),
                      )
                    : Column(
                        children: list
                            .map((m) => Padding(
                                  padding: const EdgeInsets.only(
                                      bottom: AppSpacing.xs),
                                  child: _MovementTile(item: m),
                                ))
                            .toList(),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PartCard extends StatelessWidget {
  const _PartCard({required this.item});
  final SparePart item;
  @override
  Widget build(BuildContext context) {
    final color = item.isCritical
        ? AppColors.error
        : item.isLow
            ? AppColors.warning
            : AppColors.success;
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
              Text(item.name, style: AppTextStyles.title),
              const SizedBox(height: AppSpacing.xxs),
              Text('#${item.partNumber}', style: AppTextStyles.bodySecondary),
              const Divider(height: AppSpacing.lg),
              _Row(label: 'Category', value: item.category),
              _Row(
                  label: 'In stock',
                  value: '${item.quantityInStock} ${item.unit}',
                  valueColor: color),
              _Row(label: 'Reorder at', value: '${item.reorderPoint}'),
              _Row(label: 'Minimum', value: '${item.minimumStock}'),
              _Row(
                  label: 'Unit cost',
                  value: '\$${item.unitCost.toStringAsFixed(2)}'),
              if (item.location != null)
                _Row(label: 'Location', value: item.location!),
              if (item.supplierName != null)
                _Row(label: 'Supplier', value: item.supplierName!),
            ],
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
      child: Row(children: [
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

class _MovementTile extends StatelessWidget {
  const _MovementTile({required this.item});
  final StockMovement item;
  @override
  Widget build(BuildContext context) {
    final isIn = item.type.toUpperCase() == 'IN';
    final color = isIn ? AppColors.success : AppColors.warning;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(children: [
        Icon(isIn ? Icons.add_box_outlined : Icons.remove_circle_outline,
            color: color),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${isIn ? '+' : '-'}${item.quantity} · ${item.type}',
                  style: AppTextStyles.subtitle.copyWith(color: color)),
              if (item.notes != null && item.notes!.isNotEmpty)
                Text(item.notes!, style: AppTextStyles.bodySecondary),
              Text(_fmt(item.createdAt), style: AppTextStyles.caption),
            ],
          ),
        ),
      ]),
    );
  }
}

String _fmt(DateTime d) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}-${two(d.month)}-${two(d.day)} ${two(d.hour)}:${two(d.minute)}';
}

Future<void> _showStockSheet(
    BuildContext context, WidgetRef ref, String partId, bool stockIn) async {
  final qtyCtrl = TextEditingController();
  final notesCtrl = TextEditingController();
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    builder: (ctx) {
      return Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          top: AppSpacing.md,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(stockIn ? 'Stock in' : 'Stock out',
                style: AppTextStyles.title),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: qtyCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Quantity'),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: notesCtrl,
              decoration: const InputDecoration(labelText: 'Notes'),
              maxLines: 2,
            ),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: () async {
                final qty = int.tryParse(qtyCtrl.text);
                if (qty == null || qty <= 0) return;
                try {
                  final ds = ref.read(inventoryRemoteProvider);
                  if (stockIn) {
                    await ds.stockIn(partId, qty,
                        notes: notesCtrl.text.trim().isEmpty
                            ? null
                            : notesCtrl.text.trim());
                  } else {
                    await ds.stockOut(partId, qty,
                        notes: notesCtrl.text.trim().isEmpty
                            ? null
                            : notesCtrl.text.trim());
                  }
                  if (ctx.mounted) Navigator.of(ctx).pop();
                  ref.invalidate(inventoryPartProvider(partId));
                  ref.invalidate(inventoryPartMovementsProvider(partId));
                  ref.invalidate(inventoryPartsProvider);
                  ref.invalidate(inventoryLowStockProvider);
                } catch (e) {
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(content: Text('Failed: $e')),
                    );
                  }
                }
              },
              child: Text(stockIn ? 'Add stock' : 'Deduct stock'),
            ),
          ],
        ),
      );
    },
  );
}
