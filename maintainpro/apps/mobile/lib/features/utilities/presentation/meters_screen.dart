import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/utility_models.dart';
import 'providers/utilities_provider.dart';

class MetersScreen extends ConsumerWidget {
  const MetersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meters = ref.watch(utilityMetersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Meters')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateMeter(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('New meter'),
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(utilityMetersProvider),
          child: meters.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
                child: Text('Failed: $e',
                    style:
                        AppTextStyles.body.copyWith(color: AppColors.error))),
            data: (list) {
              if (list.isEmpty) {
                return ListView(children: const [
                  SizedBox(height: 120),
                  Center(child: Text('No meters yet')),
                ]);
              }
              return ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: list.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: AppSpacing.xs),
                itemBuilder: (_, i) => _MeterCard(item: list[i]),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _MeterCard extends StatelessWidget {
  const _MeterCard({required this.item});
  final UtilityMeter item;
  @override
  Widget build(BuildContext context) {
    final color = _typeColor(item.type);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Material(
          color: AppColors.card.withOpacity(0.7),
          child: InkWell(
            onTap: () => context.push('/utilities/meters/${item.id}'),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(children: [
                CircleAvatar(
                  backgroundColor: color.withOpacity(0.15),
                  child: Icon(_typeIcon(item.type), color: color),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('#${item.meterNumber}',
                          style: AppTextStyles.subtitle),
                      const SizedBox(height: AppSpacing.xxs),
                      Text('${item.type} · ${item.location}',
                          style: AppTextStyles.bodySecondary),
                      if (item.lastReadingValue != null)
                        Text(
                          'Last: ${item.lastReadingValue!.toStringAsFixed(2)} ${item.unit}',
                          style: AppTextStyles.caption,
                        ),
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

Color _typeColor(String type) {
  switch (type.toUpperCase()) {
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

IconData _typeIcon(String type) {
  switch (type.toUpperCase()) {
    case 'ELECTRICITY':
      return Icons.bolt;
    case 'WATER':
      return Icons.water_drop_outlined;
    case 'GAS':
      return Icons.local_fire_department_outlined;
    default:
      return Icons.speed_outlined;
  }
}

const _types = ['ELECTRICITY', 'WATER', 'GAS'];

Future<void> _showCreateMeter(BuildContext context, WidgetRef ref) async {
  final numberCtrl = TextEditingController();
  final locationCtrl = TextEditingController();
  final descCtrl = TextEditingController();
  final unitCtrl = TextEditingController(text: 'kWh');
  String type = 'ELECTRICITY';

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
                Text('New meter', style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: numberCtrl,
                  decoration: const InputDecoration(labelText: 'Meter number'),
                ),
                const SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<String>(
                  initialValue: type,
                  decoration: const InputDecoration(labelText: 'Type'),
                  items: _types
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() {
                      type = v;
                      if (v == 'WATER') unitCtrl.text = 'm³';
                      if (v == 'GAS') unitCtrl.text = 'm³';
                      if (v == 'ELECTRICITY') unitCtrl.text = 'kWh';
                    });
                  },
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: unitCtrl,
                  decoration: const InputDecoration(labelText: 'Unit'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: locationCtrl,
                  decoration: const InputDecoration(labelText: 'Location'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: 'Description'),
                  maxLines: 2,
                ),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: () async {
                    if (numberCtrl.text.trim().isEmpty ||
                        locationCtrl.text.trim().isEmpty) {
                      return;
                    }
                    try {
                      await ref.read(utilitiesRemoteProvider).createMeter(
                            meterNumber: numberCtrl.text.trim(),
                            type: type,
                            location: locationCtrl.text.trim(),
                            unit: unitCtrl.text.trim(),
                            description: descCtrl.text.trim().isEmpty
                                ? null
                                : descCtrl.text.trim(),
                          );
                      if (ctx.mounted) Navigator.of(ctx).pop();
                      ref.invalidate(utilityMetersProvider);
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
