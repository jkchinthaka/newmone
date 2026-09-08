import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../core/widgets/bottom_sheet_widget.dart';
import '../../../core/widgets/error_widget.dart';
import '../../../core/widgets/loading_shimmer.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/models/asset.dart';
import 'providers/assets_provider.dart';

const _statusOptions = [
  'OPERATIONAL',
  'MAINTENANCE',
  'OUT_OF_SERVICE',
  'RETIRED',
  'DISPOSED',
];

class AssetDetailScreen extends ConsumerWidget {
  const AssetDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(assetDetailProvider(id));

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Asset'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: async.when(
            loading: () => ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: const [
                CardShimmer(height: 160),
                SizedBox(height: AppSpacing.sm),
                CardShimmer(height: 200),
              ],
            ),
            error: (e, _) => AppErrorWidget(
              message: e.toString(),
              onRetry: () => ref.invalidate(assetDetailProvider(id)),
            ),
            data: (a) => _Body(asset: a),
          ),
        ),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.asset});
  final Asset asset;

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(assetDetailProvider(asset.id));
    await ref.read(assetsListProvider.notifier).refresh();
  }

  Future<void> _showStatusSheet(BuildContext context, WidgetRef ref) async {
    String selected = asset.status;
    final reasonCtrl = TextEditingController();

    await showAppBottomSheet<void>(
      context,
      title: 'Update Status',
      child: StatefulBuilder(
        builder: (context, setState) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                for (final s in _statusOptions)
                  ChoiceChip(
                    label: Text(s.replaceAll('_', ' ')),
                    selected: selected == s,
                    onSelected: (_) => setState(() => selected = s),
                  ),
              ],
            ),
            if (selected == 'DISPOSED' || selected == 'RETIRED') ...[
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: reasonCtrl,
                decoration: const InputDecoration(
                  labelText: 'Reason',
                  prefixIcon: Icon(Icons.notes_rounded),
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () async {
                  HapticFeedback.mediumImpact();
                  final nav = Navigator.of(context);
                  final messenger = ScaffoldMessenger.of(context);
                  try {
                    await ref.read(assetsRemoteProvider).updateStatus(
                          asset.id,
                          selected,
                          disposalReason: reasonCtrl.text.trim().isEmpty
                              ? null
                              : reasonCtrl.text.trim(),
                        );
                    nav.pop();
                    await _refresh(ref);
                    messenger.showSnackBar(
                      const SnackBar(content: Text('Status updated')),
                    );
                  } catch (e) {
                    messenger.showSnackBar(
                      SnackBar(content: Text(e.toString())),
                    );
                  }
                },
                child: const Text('Save'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = asset;
    return RefreshIndicator(
      onRefresh: () => _refresh(ref),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.md, AppSpacing.xs, AppSpacing.md, AppSpacing.huge),
        children: [
          // Header card
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.card.withValues(alpha: 0.85),
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.precision_manufacturing_outlined,
                        color: AppColors.primaryLight,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            a.assetTag,
                            style: AppTextStyles.caption.copyWith(
                              color: AppColors.primaryLight,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.4,
                            ),
                          ),
                          Text(a.name, style: AppTextStyles.title),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    StatusBadge(status: a.status),
                    _Tag(label: a.category.replaceAll('_', ' ')),
                    _Tag(label: a.condition),
                    if (a.isArchived) const _Tag(label: 'ARCHIVED'),
                  ],
                ),
                if (a.description != null && a.description!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(a.description!, style: AppTextStyles.body),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),

          _Section(title: 'Details', children: [
            if (a.location != null)
              _KvRow(
                  icon: Icons.place_outlined,
                  label: 'Location',
                  value: a.location!),
            if (a.manufacturer != null)
              _KvRow(
                  icon: Icons.factory_outlined,
                  label: 'Manufacturer',
                  value: a.manufacturer!),
            if (a.model != null)
              _KvRow(icon: Icons.tag_rounded, label: 'Model', value: a.model!),
            if (a.serialNumber != null)
              _KvRow(
                  icon: Icons.qr_code_rounded,
                  label: 'Serial #',
                  value: a.serialNumber!),
            if (a.department != null)
              _KvRow(
                  icon: Icons.apartment_outlined,
                  label: 'Department',
                  value: a.department!),
            if (a.ownerName != null)
              _KvRow(
                  icon: Icons.person_outline,
                  label: 'Owner',
                  value: a.ownerName!),
            if (a.supplier != null)
              _KvRow(
                  icon: Icons.local_shipping_outlined,
                  label: 'Supplier',
                  value: a.supplier!),
          ]),
          const SizedBox(height: AppSpacing.sm),

          _Section(title: 'Service & Warranty', children: [
            _KvRow(
              icon: Icons.history_rounded,
              label: 'Last service',
              value: a.lastServiceDate == null
                  ? '—'
                  : DateFormatter.shortDate(a.lastServiceDate),
            ),
            _KvRow(
              icon: Icons.event_repeat_rounded,
              label: 'Next service',
              value: a.nextServiceDate == null
                  ? '—'
                  : '${DateFormatter.shortDate(a.nextServiceDate)} · ${DateFormatter.countdown(a.nextServiceDate)}',
              valueColor: a.isServiceDue ? AppColors.error : null,
            ),
            _KvRow(
              icon: Icons.verified_user_outlined,
              label: 'Warranty',
              value: a.warrantyExpiry == null
                  ? '—'
                  : DateFormatter.shortDate(a.warrantyExpiry),
              valueColor: a.isWarrantyExpiring ? AppColors.warning : null,
            ),
            if (a.meterReading != null)
              _KvRow(
                icon: Icons.speed_rounded,
                label: 'Meter',
                value: a.meterReading!.toString(),
              ),
          ]),
          const SizedBox(height: AppSpacing.sm),

          if (a.purchaseDate != null ||
              a.purchasePrice != null ||
              a.currentValue != null) ...[
            _Section(title: 'Financials', children: [
              if (a.purchaseDate != null)
                _KvRow(
                  icon: Icons.event_outlined,
                  label: 'Purchased',
                  value: DateFormatter.shortDate(a.purchaseDate),
                ),
              if (a.purchasePrice != null)
                _KvRow(
                  icon: Icons.payments_outlined,
                  label: 'Purchase price',
                  value: a.purchasePrice!.toStringAsFixed(2),
                ),
              if (a.currentValue != null)
                _KvRow(
                  icon: Icons.savings_outlined,
                  label: 'Current value',
                  value: a.currentValue!.toStringAsFixed(2),
                ),
            ]),
            const SizedBox(height: AppSpacing.sm),
          ],

          _Section(title: 'Activity', children: [
            _KvRow(
              icon: Icons.assignment_outlined,
              label: 'Open work orders',
              value: a.openWorkOrderCount.toString(),
              valueColor: a.hasOpenWorkOrders ? AppColors.warning : null,
            ),
            _KvRow(
              icon: Icons.history_edu_outlined,
              label: 'Total work orders',
              value: a.workOrderCount.toString(),
            ),
            _KvRow(
              icon: Icons.build_rounded,
              label: 'Maintenance logs',
              value: a.maintenanceLogCount.toString(),
            ),
          ]),
          const SizedBox(height: AppSpacing.lg),

          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              FilledButton.icon(
                onPressed: () => _showStatusSheet(context, ref),
                icon: const Icon(Icons.published_with_changes_rounded),
                label: const Text('Update status'),
              ),
              FilledButton.tonalIcon(
                onPressed: () => context.push(
                  '/work-orders/create',
                ),
                icon: const Icon(Icons.add_task_rounded),
                label: const Text('New work order'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTextStyles.subtitle),
          const SizedBox(height: AppSpacing.xs),
          if (children.isEmpty)
            const Text('No data.', style: AppTextStyles.bodySecondary)
          else
            ...children,
        ],
      ),
    );
  }
}

class _KvRow extends StatelessWidget {
  const _KvRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.textMuted),
          const SizedBox(width: AppSpacing.xs),
          Expanded(child: Text(label, style: AppTextStyles.bodySecondary)),
          Text(
            value,
            style: AppTextStyles.body.copyWith(
              color: valueColor,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.right,
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.full),
        border: Border.all(color: AppColors.border),
      ),
      child: Text(label, style: AppTextStyles.label),
    );
  }
}
