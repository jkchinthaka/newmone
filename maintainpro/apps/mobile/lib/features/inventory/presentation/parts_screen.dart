import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/inventory_models.dart';
import 'providers/inventory_provider.dart';

class PartsScreen extends ConsumerStatefulWidget {
  const PartsScreen({super.key, this.lowStockOnly = false});
  final bool lowStockOnly;

  @override
  ConsumerState<PartsScreen> createState() => _PartsScreenState();
}

class _PartsScreenState extends ConsumerState<PartsScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final source = widget.lowStockOnly
        ? ref.watch(inventoryLowStockProvider)
        : ref.watch(inventoryPartsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.lowStockOnly ? 'Low stock' : 'Parts'),
      ),
      floatingActionButton: widget.lowStockOnly
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _showCreatePart(context, ref),
              icon: const Icon(Icons.add),
              label: const Text('New part'),
            ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                labelText: 'Search by name or part #',
              ),
              onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(inventoryPartsProvider);
                ref.invalidate(inventoryLowStockProvider);
              },
              child: source.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Text('Failed: $e',
                        style: AppTextStyles.body
                            .copyWith(color: AppColors.error)),
                  ),
                ),
                data: (list) {
                  final filtered = _query.isEmpty
                      ? list
                      : list
                          .where((p) =>
                              p.name.toLowerCase().contains(_query) ||
                              p.partNumber.toLowerCase().contains(_query))
                          .toList();
                  if (filtered.isEmpty) {
                    return ListView(children: const [
                      SizedBox(height: 120),
                      Center(child: Text('No parts found')),
                    ]);
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: AppSpacing.xs),
                    itemBuilder: (_, i) => _PartCard(item: filtered[i]),
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
        child: Material(
          color: AppColors.card.withValues(alpha: 0.7),
          child: InkWell(
            onTap: () => context.push('/inventory/parts/${item.id}'),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Icon(Icons.inventory_2_outlined, color: color),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.name, style: AppTextStyles.subtitle),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        '#${item.partNumber} · ${item.category}',
                        style: AppTextStyles.bodySecondary,
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${item.quantityInStock} ${item.unit}',
                      style: AppTextStyles.subtitle.copyWith(color: color),
                    ),
                    Text('\$${item.unitCost.toStringAsFixed(2)}',
                        style: AppTextStyles.caption),
                  ],
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

const _categories = [
  'GENERAL',
  'FILTER',
  'OIL',
  'BATTERY',
  'TIRE',
  'BRAKE',
  'ELECTRICAL',
  'BODY',
  'ENGINE',
  'OTHER',
];

Future<void> _showCreatePart(BuildContext context, WidgetRef ref) async {
  final partNumberCtrl = TextEditingController();
  final nameCtrl = TextEditingController();
  final unitCostCtrl = TextEditingController();
  final qtyCtrl = TextEditingController(text: '0');
  final reorderCtrl = TextEditingController(text: '0');
  final minimumCtrl = TextEditingController(text: '0');
  final locationCtrl = TextEditingController();
  String category = 'GENERAL';

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
                Text('New part', style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: partNumberCtrl,
                  decoration: const InputDecoration(labelText: 'Part #'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Name'),
                ),
                const SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<String>(
                  initialValue: category,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: _categories
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setState(() => category = v ?? category),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: unitCostCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Unit cost'),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: TextField(
                      controller: qtyCtrl,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Initial qty'),
                    ),
                  ),
                ]),
                const SizedBox(height: AppSpacing.sm),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: minimumCtrl,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Minimum stock'),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: TextField(
                      controller: reorderCtrl,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Reorder point'),
                    ),
                  ),
                ]),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: locationCtrl,
                  decoration: const InputDecoration(labelText: 'Location'),
                ),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: () async {
                    if (partNumberCtrl.text.trim().isEmpty ||
                        nameCtrl.text.trim().isEmpty) {
                      return;
                    }
                    try {
                      await ref.read(inventoryRemoteProvider).createPart(
                            partNumber: partNumberCtrl.text.trim(),
                            name: nameCtrl.text.trim(),
                            category: category,
                            unitCost: double.tryParse(unitCostCtrl.text) ?? 0,
                            quantityInStock: int.tryParse(qtyCtrl.text) ?? 0,
                            reorderPoint: int.tryParse(reorderCtrl.text) ?? 0,
                            minimumStock: int.tryParse(minimumCtrl.text) ?? 0,
                            location: locationCtrl.text.trim().isEmpty
                                ? null
                                : locationCtrl.text.trim(),
                          );
                      if (ctx.mounted) Navigator.of(ctx).pop();
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
