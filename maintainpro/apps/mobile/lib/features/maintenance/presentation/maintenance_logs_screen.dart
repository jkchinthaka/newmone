import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../data/models/maintenance_models.dart';
import 'providers/maintenance_provider.dart';

class MaintenanceLogsScreen extends ConsumerWidget {
  const MaintenanceLogsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const args = MaintenanceLogsArgs();
    final logs = ref.watch(maintenanceLogsProvider(args));
    return Scaffold(
      appBar: AppBar(title: const Text('Service logs')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateSheet(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Log service'),
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(maintenanceLogsProvider(args)),
          child: logs.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Text('Failed: $e',
                    style: AppTextStyles.body.copyWith(color: AppColors.error)),
              ),
            ),
            data: (page) {
              if (page.items.isEmpty) {
                return ListView(children: const [
                  SizedBox(height: 120),
                  Center(child: Text('No logs yet')),
                ]);
              }
              return ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: page.items.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: AppSpacing.xs),
                itemBuilder: (_, i) => _LogTile(item: page.items[i]),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _LogTile extends StatelessWidget {
  const _LogTile({required this.item});
  final MaintenanceLog item;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          color: AppColors.card.withValues(alpha: 0.7),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Text(item.description, style: AppTextStyles.subtitle),
                ),
                if (item.cost != null)
                  Text('\$${item.cost!.toStringAsFixed(2)}',
                      style: AppTextStyles.label
                          .copyWith(color: AppColors.success)),
              ]),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                '${item.target} · ${item.performedBy} · ${_fmt(item.performedAt)}',
                style: AppTextStyles.bodySecondary,
              ),
              if (item.notes != null && item.notes!.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text(item.notes!, style: AppTextStyles.caption),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

String _fmt(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

Future<void> _showCreateSheet(BuildContext context, WidgetRef ref) async {
  final descCtrl = TextEditingController();
  final costCtrl = TextEditingController();
  final notesCtrl = TextEditingController();
  final user = ref.read(currentUserProvider);
  final performedByCtrl = TextEditingController(text: user?.displayName ?? '');
  DateTime performedAt = DateTime.now();

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
                Text('Log service', style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: performedByCtrl,
                  decoration: const InputDecoration(labelText: 'Performed by'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: costCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Cost'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: notesCtrl,
                  decoration: const InputDecoration(labelText: 'Notes'),
                  maxLines: 2,
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(children: [
                  Expanded(
                    child: Text('Performed at: ${_fmt(performedAt)}',
                        style: AppTextStyles.body),
                  ),
                  TextButton(
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: ctx,
                        firstDate:
                            DateTime.now().subtract(const Duration(days: 365)),
                        lastDate: DateTime.now(),
                        initialDate: performedAt,
                      );
                      if (picked != null) {
                        setState(() => performedAt = picked);
                      }
                    },
                    child: const Text('Pick date'),
                  ),
                ]),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: () async {
                    if (descCtrl.text.trim().isEmpty ||
                        performedByCtrl.text.trim().isEmpty) {
                      return;
                    }
                    try {
                      await ref.read(maintenanceRemoteProvider).createLog(
                            description: descCtrl.text.trim(),
                            performedBy: performedByCtrl.text.trim(),
                            performedAt: performedAt,
                            cost: double.tryParse(costCtrl.text),
                            notes: notesCtrl.text.trim().isEmpty
                                ? null
                                : notesCtrl.text.trim(),
                          );
                      if (ctx.mounted) Navigator.of(ctx).pop();
                      ref.invalidate(
                          maintenanceLogsProvider(const MaintenanceLogsArgs()));
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
