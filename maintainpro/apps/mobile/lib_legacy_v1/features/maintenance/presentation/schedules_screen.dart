import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/maintenance_models.dart';
import 'providers/maintenance_provider.dart';

class MaintenanceSchedulesScreen extends ConsumerWidget {
  const MaintenanceSchedulesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedules = ref.watch(maintenanceSchedulesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Schedules')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateSheet(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('New schedule'),
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(maintenanceSchedulesProvider),
          child: schedules.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => _Error(message: '$e'),
            data: (list) {
              if (list.isEmpty) {
                return ListView(children: const [
                  SizedBox(height: 120),
                  Center(child: Text('No schedules yet')),
                ]);
              }
              return ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: list.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: AppSpacing.xs),
                itemBuilder: (_, i) => _ScheduleCard(item: list[i]),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({required this.item});
  final MaintenanceSchedule item;

  @override
  Widget build(BuildContext context) {
    final color = item.isOverdue
        ? AppColors.error
        : item.isDueSoon
            ? AppColors.warning
            : item.isActive
                ? AppColors.success
                : AppColors.textMuted;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Material(
          color: AppColors.card.withValues(alpha: 0.7),
          child: InkWell(
            onTap: () => context.push('/maintenance/schedules/${item.id}'),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                      child: Text(item.name, style: AppTextStyles.subtitle),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xs, vertical: 2),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        border: Border.all(color: color.withValues(alpha: 0.4)),
                      ),
                      child: Text(
                        item.isOverdue
                            ? 'OVERDUE'
                            : item.isDueSoon
                                ? 'DUE SOON'
                                : item.isActive
                                    ? 'ACTIVE'
                                    : 'INACTIVE',
                        style: AppTextStyles.label.copyWith(color: color),
                      ),
                    ),
                  ]),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    '${item.type} · ${item.frequency} · ${item.target}',
                    style: AppTextStyles.bodySecondary,
                  ),
                  if (item.nextDueDate != null) ...[
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      'Next due: ${_fmt(item.nextDueDate!)}',
                      style: AppTextStyles.caption,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _fmt(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

class _Error extends StatelessWidget {
  const _Error({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Text('Failed: $message',
              style: AppTextStyles.body.copyWith(color: AppColors.error)),
        ),
      );
}

const _types = ['PREVENTIVE', 'PREDICTIVE', 'CORRECTIVE', 'INSPECTION'];
const _frequencies = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'BIANNUAL',
  'ANNUAL',
  'MILEAGE_BASED',
  'CUSTOM',
];

Future<void> _showCreateSheet(BuildContext context, WidgetRef ref) async {
  final nameCtrl = TextEditingController();
  final descCtrl = TextEditingController();
  final intervalCtrl = TextEditingController();
  final estCostCtrl = TextEditingController();
  String type = 'PREVENTIVE';
  String frequency = 'MONTHLY';
  DateTime? nextDue;

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
                const Text('New schedule', style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Name'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                const SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<String>(
                  initialValue: type,
                  decoration: const InputDecoration(labelText: 'Type'),
                  items: _types
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: (v) => setState(() => type = v ?? type),
                ),
                const SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<String>(
                  initialValue: frequency,
                  decoration: const InputDecoration(labelText: 'Frequency'),
                  items: _frequencies
                      .map((f) => DropdownMenuItem(value: f, child: Text(f)))
                      .toList(),
                  onChanged: (v) => setState(() => frequency = v ?? frequency),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: intervalCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Interval (days, optional)'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: estCostCtrl,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Estimated cost'),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(children: [
                  Expanded(
                    child: Text(
                      nextDue == null
                          ? 'Next due: not set'
                          : 'Next due: ${_fmt(nextDue!)}',
                      style: AppTextStyles.body,
                    ),
                  ),
                  TextButton(
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: ctx,
                        firstDate:
                            DateTime.now().subtract(const Duration(days: 1)),
                        lastDate:
                            DateTime.now().add(const Duration(days: 365 * 5)),
                        initialDate:
                            DateTime.now().add(const Duration(days: 30)),
                      );
                      if (picked != null) setState(() => nextDue = picked);
                    },
                    child: const Text('Pick date'),
                  ),
                ]),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: () async {
                    if (nameCtrl.text.trim().isEmpty) return;
                    try {
                      await ref.read(maintenanceRemoteProvider).createSchedule(
                            name: nameCtrl.text.trim(),
                            description: descCtrl.text.trim().isEmpty
                                ? null
                                : descCtrl.text.trim(),
                            type: type,
                            frequency: frequency,
                            intervalDays: int.tryParse(intervalCtrl.text),
                            estimatedCost: double.tryParse(estCostCtrl.text),
                            nextDueDate: nextDue,
                          );
                      if (ctx.mounted) Navigator.of(ctx).pop();
                      ref.invalidate(maintenanceSchedulesProvider);
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
