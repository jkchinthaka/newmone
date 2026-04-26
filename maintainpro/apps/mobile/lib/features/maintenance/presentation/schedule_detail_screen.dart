import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/maintenance_models.dart';
import 'providers/maintenance_provider.dart';

class ScheduleDetailScreen extends ConsumerWidget {
  const ScheduleDetailScreen({super.key, required this.scheduleId});
  final String scheduleId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(maintenanceScheduleProvider(scheduleId));
    return Scaffold(
      appBar: AppBar(title: const Text('Schedule')),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Text('Failed: $e',
                  style: AppTextStyles.body.copyWith(color: AppColors.error)),
            ),
          ),
          data: (s) => _Body(item: s, ref: ref),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.item, required this.ref});
  final MaintenanceSchedule item;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return ListView(
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
                  Text(item.name, style: AppTextStyles.title),
                  if (item.description != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(item.description!, style: AppTextStyles.body),
                  ],
                  const Divider(height: AppSpacing.lg),
                  _Row(label: 'Type', value: item.type),
                  _Row(label: 'Frequency', value: item.frequency),
                  _Row(label: 'Target', value: item.target),
                  if (item.intervalDays != null)
                    _Row(label: 'Interval', value: '${item.intervalDays} days'),
                  if (item.intervalMileage != null)
                    _Row(
                        label: 'Mileage interval',
                        value: '${item.intervalMileage} km'),
                  if (item.nextDueDate != null)
                    _Row(label: 'Next due', value: _fmt(item.nextDueDate!)),
                  if (item.nextDueMileage != null)
                    _Row(
                        label: 'Next due mileage',
                        value: '${item.nextDueMileage} km'),
                  if (item.estimatedCost != null)
                    _Row(
                        label: 'Estimated cost',
                        value: '\$${item.estimatedCost!.toStringAsFixed(2)}'),
                  if (item.estimatedHours != null)
                    _Row(
                        label: 'Estimated hours',
                        value: '${item.estimatedHours}'),
                  _Row(
                      label: 'Status',
                      value: item.isActive ? 'Active' : 'Inactive'),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              icon: Icon(item.isActive
                  ? Icons.pause_circle_outline
                  : Icons.play_circle_outline),
              label: Text(item.isActive ? 'Deactivate' : 'Activate'),
              onPressed: () async {
                try {
                  await ref
                      .read(maintenanceRemoteProvider)
                      .updateSchedule(item.id, isActive: !item.isActive);
                  ref.invalidate(maintenanceScheduleProvider(item.id));
                  ref.invalidate(maintenanceSchedulesProvider);
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed: $e')),
                    );
                  }
                }
              },
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: OutlinedButton.icon(
              icon: const Icon(Icons.delete_outline),
              label: const Text('Delete'),
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (c) => AlertDialog(
                    title: const Text('Delete schedule?'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.of(c).pop(false),
                          child: const Text('Cancel')),
                      FilledButton(
                          onPressed: () => Navigator.of(c).pop(true),
                          child: const Text('Delete')),
                    ],
                  ),
                );
                if (ok == true) {
                  try {
                    await ref
                        .read(maintenanceRemoteProvider)
                        .deleteSchedule(item.id);
                    ref.invalidate(maintenanceSchedulesProvider);
                    if (context.mounted) Navigator.of(context).pop();
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Failed: $e')),
                      );
                    }
                  }
                }
              },
            ),
          ),
        ]),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(label, style: AppTextStyles.caption),
          ),
          Expanded(child: Text(value, style: AppTextStyles.body)),
        ],
      ),
    );
  }
}

String _fmt(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
