import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/widgets/bottom_sheet_widget.dart';
import '../data/models/work_order.dart';
import 'providers/work_orders_provider.dart';

const _statusOptions = [
  'OPEN',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
];
const _priorityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const _typeOptions = [
  'PREVENTIVE',
  'CORRECTIVE',
  'EMERGENCY',
  'INSPECTION',
  'INSTALLATION',
];

Future<void> showWorkOrderFilterSheet(
  BuildContext context,
  WidgetRef ref,
) async {
  final initial = ref.read(workOrdersFiltersProvider);
  WorkOrderListFilters draft = initial;

  await showAppBottomSheet<void>(
    context,
    title: 'Filter Work Orders',
    child: StatefulBuilder(
      builder: (context, setState) {
        Widget chips({
          required String label,
          required List<String> options,
          required String? selected,
          required void Function(String?) onChange,
        }) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AppTextStyles.subtitle),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  for (final opt in options)
                    ChoiceChip(
                      label: Text(opt.replaceAll('_', ' ')),
                      selected: selected == opt,
                      onSelected: (v) => onChange(v ? opt : null),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
            ],
          );
        }

        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            chips(
              label: 'Status',
              options: _statusOptions,
              selected: draft.status,
              onChange: (v) =>
                  setState(() => draft = draft.copyWith(status: v)),
            ),
            chips(
              label: 'Priority',
              options: _priorityOptions,
              selected: draft.priority,
              onChange: (v) =>
                  setState(() => draft = draft.copyWith(priority: v)),
            ),
            chips(
              label: 'Type',
              options: _typeOptions,
              selected: draft.type,
              onChange: (v) => setState(() => draft = draft.copyWith(type: v)),
            ),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              title: const Text('Assigned to me'),
              value: draft.assignedToMe,
              onChanged: (v) =>
                  setState(() => draft = draft.copyWith(assignedToMe: v)),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      ref.read(workOrdersFiltersProvider.notifier).state =
                          const WorkOrderListFilters();
                      Navigator.of(context).pop();
                    },
                    child: const Text('Clear'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: FilledButton(
                    onPressed: () {
                      ref.read(workOrdersFiltersProvider.notifier).state =
                          draft;
                      Navigator.of(context).pop();
                    },
                    child: const Text('Apply'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        );
      },
    ),
  );
}

/// Active-filters summary chip strip displayed above the list when filters
/// are applied.
class WorkOrderActiveFiltersBar extends ConsumerWidget {
  const WorkOrderActiveFiltersBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final f = ref.watch(workOrdersFiltersProvider);
    if (f.isEmpty) return const SizedBox.shrink();

    final chips = <Widget>[];
    void addChip(String label, VoidCallback onClose) {
      chips.add(InputChip(
        label: Text(label),
        onDeleted: onClose,
        deleteIcon: const Icon(Icons.close_rounded, size: 16),
      ));
    }

    if (f.status != null) {
      addChip('Status: ${f.status!.replaceAll('_', ' ')}', () {
        ref.read(workOrdersFiltersProvider.notifier).update(
              (s) => s.copyWith(status: null),
            );
      });
    }
    if (f.priority != null) {
      addChip('Priority: ${f.priority}', () {
        ref.read(workOrdersFiltersProvider.notifier).update(
              (s) => s.copyWith(priority: null),
            );
      });
    }
    if (f.type != null) {
      addChip('Type: ${f.type}', () {
        ref.read(workOrdersFiltersProvider.notifier).update(
              (s) => s.copyWith(type: null),
            );
      });
    }
    if (f.assignedToMe) {
      addChip('Mine', () {
        ref.read(workOrdersFiltersProvider.notifier).update(
              (s) => s.copyWith(assignedToMe: false),
            );
      });
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: SizedBox(
        height: 44,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: [
            for (final c in chips) ...[
              c,
              const SizedBox(width: AppSpacing.xs),
            ],
          ],
        ),
      ),
    );
  }
}

/// Glass search field bound to filter state's `search`.
class WorkOrderSearchField extends ConsumerStatefulWidget {
  const WorkOrderSearchField({super.key});

  @override
  ConsumerState<WorkOrderSearchField> createState() =>
      _WorkOrderSearchFieldState();
}

class _WorkOrderSearchFieldState extends ConsumerState<WorkOrderSearchField> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(
      text: ref.read(workOrdersFiltersProvider).search ?? '',
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.card.withOpacity(0.6),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.border),
          ),
          child: TextField(
            controller: _ctrl,
            onChanged: (v) {
              ref.read(workOrdersFiltersProvider.notifier).update(
                    (s) => s.copyWith(search: v),
                  );
            },
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search_rounded),
              hintText: 'Search by title, WO#, asset…',
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ),
      ),
    );
  }
}
