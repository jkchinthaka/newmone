import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../data/models/utility_models.dart';
import 'providers/utilities_provider.dart';

class MeterDetailScreen extends ConsumerWidget {
  const MeterDetailScreen({super.key, required this.meterId});
  final String meterId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meter = ref.watch(utilityMeterProvider(meterId));
    final readings = ref.watch(meterReadingsProvider(meterId));
    return Scaffold(
      appBar: AppBar(title: const Text('Meter')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddReading(context, ref, meterId),
        icon: const Icon(Icons.add),
        label: const Text('Add reading'),
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(utilityMeterProvider(meterId));
            ref.invalidate(meterReadingsProvider(meterId));
          },
          child: meter.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
                child: Text('Failed: $e',
                    style:
                        AppTextStyles.body.copyWith(color: AppColors.error))),
            data: (m) => ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                    child: Container(
                      color: AppColors.card.withValues(alpha: 0.7),
                      padding: const EdgeInsets.all(AppSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('#${m.meterNumber}', style: AppTextStyles.title),
                          const Divider(height: AppSpacing.lg),
                          _Row(label: 'Type', value: m.type),
                          _Row(label: 'Location', value: m.location),
                          _Row(label: 'Unit', value: m.unit),
                          if (m.description != null)
                            _Row(label: 'Description', value: m.description!),
                          if (m.lastReadingValue != null)
                            _Row(
                              label: 'Last reading',
                              value:
                                  '${m.lastReadingValue!.toStringAsFixed(2)} ${m.unit}'
                                  '${m.lastReadingDate != null ? ' · ${_fmt(m.lastReadingDate!)}' : ''}',
                            ),
                          _Row(
                              label: 'Status',
                              value: m.isActive ? 'Active' : 'Inactive'),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text('Readings', style: AppTextStyles.subtitle),
                const SizedBox(height: AppSpacing.sm),
                readings.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text('Failed: $e',
                      style:
                          AppTextStyles.body.copyWith(color: AppColors.error)),
                  data: (list) {
                    if (list.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.all(AppSpacing.md),
                        child: Center(child: Text('No readings yet')),
                      );
                    }
                    return Column(
                      children: [
                        for (final r in list) _ReadingTile(r: r, unit: m.unit),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 80),
              ],
            ),
          ),
        ),
      ),
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
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
            flex: 2, child: Text(label, style: AppTextStyles.bodySecondary)),
        Expanded(flex: 3, child: Text(value, style: AppTextStyles.body)),
      ]),
    );
  }
}

class _ReadingTile extends StatelessWidget {
  const _ReadingTile({required this.r, required this.unit});
  final MeterReading r;
  final String unit;
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.xs),
          decoration: BoxDecoration(
            color: AppColors.info.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(AppRadius.sm),
          ),
          child: const Icon(Icons.show_chart, size: 18, color: AppColors.info),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${r.readingValue.toStringAsFixed(2)} $unit',
                  style: AppTextStyles.subtitle),
              Text(_fmt(r.readingDate), style: AppTextStyles.caption),
              if (r.notes != null && r.notes!.isNotEmpty)
                Text(r.notes!, style: AppTextStyles.caption),
            ],
          ),
        ),
        if (r.consumption != null)
          Text('+${r.consumption!.toStringAsFixed(2)}',
              style: AppTextStyles.body.copyWith(color: AppColors.success)),
      ]),
    );
  }
}

String _fmt(DateTime d) {
  final l = d.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${l.year}-${two(l.month)}-${two(l.day)} ${two(l.hour)}:${two(l.minute)}';
}

Future<void> _showAddReading(
    BuildContext context, WidgetRef ref, String meterId) async {
  final valueCtrl = TextEditingController();
  final notesCtrl = TextEditingController();
  DateTime date = DateTime.now();

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
                Text('New reading', style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: valueCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Reading value'),
                ),
                const SizedBox(height: AppSpacing.sm),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                      'Date: ${date.toLocal().toString().split(' ').first}'),
                  trailing: const Icon(Icons.calendar_today_outlined),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: date,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2100),
                    );
                    if (picked != null) setState(() => date = picked);
                  },
                ),
                TextField(
                  controller: notesCtrl,
                  decoration: const InputDecoration(labelText: 'Notes'),
                  maxLines: 2,
                ),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: () async {
                    final value = double.tryParse(valueCtrl.text.trim());
                    if (value == null) return;
                    try {
                      await ref.read(utilitiesRemoteProvider).addReading(
                            meterId,
                            readingDate: date,
                            readingValue: value,
                            notes: notesCtrl.text.trim().isEmpty
                                ? null
                                : notesCtrl.text.trim(),
                          );
                      if (ctx.mounted) Navigator.of(ctx).pop();
                      ref.invalidate(meterReadingsProvider(meterId));
                      ref.invalidate(utilityMeterProvider(meterId));
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          SnackBar(content: Text('Failed: $e')),
                        );
                      }
                    }
                  },
                  child: const Text('Save'),
                ),
              ],
            ),
          ),
        );
      });
    },
  );
}
