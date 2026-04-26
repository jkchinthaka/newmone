import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../core/widgets/bottom_sheet_widget.dart';
import '../../../core/widgets/error_widget.dart';
import '../../../core/widgets/loading_shimmer.dart';
import '../../../core/widgets/priority_badge.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/models/work_order.dart';
import 'providers/work_orders_provider.dart';

const _statusFlow = [
  'OPEN',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED'
];

class WorkOrderDetailScreen extends ConsumerWidget {
  const WorkOrderDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(workOrderDetailProvider(id));

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Work Order'),
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
                CardShimmer(height: 120),
                SizedBox(height: AppSpacing.sm),
                CardShimmer(height: 200),
              ],
            ),
            error: (e, _) => AppErrorWidget(
              message: e.toString(),
              onRetry: () => ref.invalidate(workOrderDetailProvider(id)),
            ),
            data: (wo) => _DetailBody(workOrder: wo),
          ),
        ),
      ),
    );
  }
}

class _DetailBody extends ConsumerWidget {
  const _DetailBody({required this.workOrder});
  final WorkOrder workOrder;

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(workOrderDetailProvider(workOrder.id));
    await ref.read(workOrdersListProvider.notifier).refresh();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wo = workOrder;
    final overdue = wo.isOverdue;

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
              border: Border.all(
                color: overdue ? AppColors.error : AppColors.border,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  wo.woNumber,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.primaryLight,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 4),
                Text(wo.title, style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    StatusBadge(status: overdue ? 'OVERDUE' : wo.status),
                    PriorityBadge(priority: wo.priority),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm, vertical: 4),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(AppRadius.full),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(
                        wo.type,
                        style: AppTextStyles.label,
                      ),
                    ),
                  ],
                ),
                if (wo.description.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(wo.description, style: AppTextStyles.body),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),

          // Timing card
          _Section(
            title: 'Schedule',
            children: [
              _KvRow(
                icon: Icons.event_available_outlined,
                label: 'Created',
                value: DateFormatter.dateTime(wo.createdAt),
              ),
              _KvRow(
                icon: Icons.schedule_rounded,
                label: 'Due',
                value: wo.dueDate == null
                    ? '—'
                    : '${DateFormatter.shortDate(wo.dueDate)} · ${DateFormatter.countdown(wo.dueDate)}',
                valueColor: overdue ? AppColors.error : AppColors.textPrimary,
              ),
              if (wo.slaDeadline != null)
                _KvRow(
                  icon: Icons.timer_outlined,
                  label: 'SLA',
                  value: DateFormatter.countdown(wo.slaDeadline),
                ),
              if (wo.startDate != null)
                _KvRow(
                  icon: Icons.play_circle_outline,
                  label: 'Started',
                  value: DateFormatter.dateTime(wo.startDate),
                ),
              if (wo.completedDate != null)
                _KvRow(
                  icon: Icons.check_circle_outline,
                  label: 'Completed',
                  value: DateFormatter.dateTime(wo.completedDate),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          // Assignment card
          _Section(
            title: 'Assignment',
            children: [
              _KvRow(
                icon: Icons.engineering_outlined,
                label: 'Technician',
                value: wo.technicianName ?? 'Unassigned',
              ),
              _KvRow(
                icon: Icons.person_outline,
                label: 'Created by',
                value: wo.createdByName ?? '—',
              ),
              if (wo.assetName != null)
                _KvRow(
                  icon: Icons.precision_manufacturing_outlined,
                  label: 'Asset',
                  value: wo.assetName!,
                ),
              if (wo.vehiclePlate != null)
                _KvRow(
                  icon: Icons.directions_car_outlined,
                  label: 'Vehicle',
                  value: wo.vehiclePlate!,
                ),
            ],
          ),

          // Costs
          if (wo.estimatedCost != null ||
              wo.actualCost != null ||
              wo.estimatedHours != null ||
              wo.actualHours != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _Section(
              title: 'Cost & Effort',
              children: [
                if (wo.estimatedCost != null)
                  _KvRow(
                    icon: Icons.payments_outlined,
                    label: 'Est. cost',
                    value: wo.estimatedCost!.toStringAsFixed(2),
                  ),
                if (wo.actualCost != null)
                  _KvRow(
                    icon: Icons.payments_outlined,
                    label: 'Actual cost',
                    value: wo.actualCost!.toStringAsFixed(2),
                  ),
                if (wo.estimatedHours != null)
                  _KvRow(
                    icon: Icons.access_time_outlined,
                    label: 'Est. hours',
                    value: wo.estimatedHours!.toStringAsFixed(1),
                  ),
                if (wo.actualHours != null)
                  _KvRow(
                    icon: Icons.access_time_outlined,
                    label: 'Actual hours',
                    value: wo.actualHours!.toStringAsFixed(1),
                  ),
              ],
            ),
          ],

          // Parts
          const SizedBox(height: AppSpacing.sm),
          _Section(
            title: 'Parts (${wo.parts.length})',
            trailing: TextButton.icon(
              onPressed: () => _showAddPart(context, ref, wo.id),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Add'),
            ),
            children: wo.parts.isEmpty
                ? [
                    Text(
                      'No parts logged.',
                      style: AppTextStyles.bodySecondary,
                    ),
                  ]
                : [
                    for (final p in wo.parts) _PartRow(part: p),
                  ],
          ),

          const SizedBox(height: AppSpacing.lg),

          // Action buttons
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              FilledButton.icon(
                onPressed: () => _showStatusSheet(context, ref, wo),
                icon: const Icon(Icons.published_with_changes_rounded),
                label: const Text('Update status'),
              ),
              FilledButton.tonalIcon(
                onPressed: () => _showAddNote(context, ref, wo.id),
                icon: const Icon(Icons.note_add_outlined),
                label: const Text('Add note'),
              ),
              FilledButton.tonalIcon(
                onPressed: () => _showAddAttachment(context, ref, wo.id),
                icon: const Icon(Icons.attach_file_rounded),
                label: const Text('Attachment'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ───────────────── Action handlers ─────────────────

  Future<void> _showStatusSheet(
      BuildContext context, WidgetRef ref, WorkOrder wo) async {
    String selected = wo.status;
    final actualCostCtrl = TextEditingController();
    final actualHoursCtrl = TextEditingController();

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
                for (final s in _statusFlow)
                  ChoiceChip(
                    label: Text(s.replaceAll('_', ' ')),
                    selected: selected == s,
                    onSelected: (_) => setState(() => selected = s),
                  ),
              ],
            ),
            if (selected == 'COMPLETED') ...[
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: actualCostCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Actual cost',
                  prefixIcon: Icon(Icons.payments_outlined),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: actualHoursCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Actual hours',
                  prefixIcon: Icon(Icons.access_time_outlined),
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
                    await ref.read(workOrdersRemoteProvider).updateStatus(
                          wo.id,
                          status: selected,
                          actualCost: num.tryParse(actualCostCtrl.text),
                          actualHours: num.tryParse(actualHoursCtrl.text),
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
            const SizedBox(height: AppSpacing.xs),
          ],
        ),
      ),
    );
  }

  Future<void> _showAddNote(
      BuildContext context, WidgetRef ref, String id) async {
    final ctrl = TextEditingController();
    await showAppBottomSheet<void>(
      context,
      title: 'Add Note',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: ctrl,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'Type your note…',
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: () async {
                final note = ctrl.text.trim();
                if (note.isEmpty) return;
                final nav = Navigator.of(context);
                final messenger = ScaffoldMessenger.of(context);
                try {
                  await ref.read(workOrdersRemoteProvider).addNote(id, note);
                  nav.pop();
                  await _refresh(ref);
                  messenger.showSnackBar(
                    const SnackBar(content: Text('Note added')),
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
    );
  }

  Future<void> _showAddAttachment(
      BuildContext context, WidgetRef ref, String id) async {
    final ctrl = TextEditingController();
    await showAppBottomSheet<void>(
      context,
      title: 'Add Attachment',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: ctrl,
            decoration: const InputDecoration(
              labelText: 'Attachment URL',
              prefixIcon: Icon(Icons.link_rounded),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: () async {
                final url = ctrl.text.trim();
                if (url.isEmpty) return;
                final nav = Navigator.of(context);
                final messenger = ScaffoldMessenger.of(context);
                try {
                  await ref
                      .read(workOrdersRemoteProvider)
                      .addAttachment(id, url);
                  nav.pop();
                  await _refresh(ref);
                  messenger.showSnackBar(
                    const SnackBar(content: Text('Attachment added')),
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
    );
  }

  Future<void> _showAddPart(
      BuildContext context, WidgetRef ref, String id) async {
    final partIdCtrl = TextEditingController();
    final qtyCtrl = TextEditingController();
    final costCtrl = TextEditingController();
    await showAppBottomSheet<void>(
      context,
      title: 'Add Part',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: partIdCtrl,
            decoration: const InputDecoration(
              labelText: 'Part ID',
              prefixIcon: Icon(Icons.qr_code_2_rounded),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: qtyCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Quantity',
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: costCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Unit cost',
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: () async {
                final partId = partIdCtrl.text.trim();
                final qty = num.tryParse(qtyCtrl.text);
                final cost = num.tryParse(costCtrl.text);
                if (partId.isEmpty || qty == null || cost == null) return;
                final nav = Navigator.of(context);
                final messenger = ScaffoldMessenger.of(context);
                try {
                  await ref.read(workOrdersRemoteProvider).addPart(
                        id,
                        partId: partId,
                        quantity: qty,
                        unitCost: cost,
                      );
                  nav.pop();
                  await _refresh(ref);
                  messenger.showSnackBar(
                    const SnackBar(content: Text('Part added')),
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
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.children,
    this.trailing,
  });

  final String title;
  final List<Widget> children;
  final Widget? trailing;

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
          Row(
            children: [
              Expanded(child: Text(title, style: AppTextStyles.subtitle)),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
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

class _PartRow extends StatelessWidget {
  const _PartRow({required this.part});
  final WorkOrderPart part;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          const Icon(Icons.build_outlined,
              size: 16, color: AppColors.textMuted),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  part.partName ?? part.partId,
                  style: AppTextStyles.body,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (part.sku != null)
                  Text(part.sku!, style: AppTextStyles.caption),
              ],
            ),
          ),
          Text('${part.quantity} × ${part.unitCost.toStringAsFixed(2)}',
              style: AppTextStyles.label),
        ],
      ),
    );
  }
}
