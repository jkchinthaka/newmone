import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/app_text_styles.dart';
import '../../data/models/work_order.dart';
import '../providers/work_orders_provider.dart';

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

/// Search field bound to [workOrdersFiltersProvider].search
class WorkOrderSearchField extends ConsumerStatefulWidget {
  const WorkOrderSearchField({super.key});

  @override
  ConsumerState<WorkOrderSearchField> createState() =>
      _WorkOrderSearchFieldState();
}

class _WorkOrderSearchFieldState extends ConsumerState<WorkOrderSearchField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: ref.read(workOrdersFiltersProvider).search ?? '',
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      textInputAction: TextInputAction.search,
      style: AppTextStyles.body,
      decoration: InputDecoration(
        hintText: 'Search work orders…',
        prefixIcon: const Icon(Icons.search_rounded,
            color: AppColors.textSecondary),
        suffixIcon: _controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: 'Clear',
                icon: const Icon(Icons.close_rounded,
                    color: AppColors.textSecondary),
                onPressed: () {
                  _controller.clear();
                  ref.read(workOrdersFiltersProvider.notifier).state = ref
                      .read(workOrdersFiltersProvider)
                      .copyWith(search: null);
                  setState(() {});
                },
              ),
        filled: true,
        fillColor: AppColors.card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.primaryLight),
        ),
      ),
      onChanged: (value) {
        ref.read(workOrdersFiltersProvider.notifier).state = ref
            .read(workOrdersFiltersProvider)
            .copyWith(search: value.isEmpty ? null : value);
        setState(() {});
      },
    );
  }
}

/// Horizontal chip bar showing active filter values with clear-each.
class WorkOrderActiveFiltersBar extends ConsumerWidget {
  const WorkOrderActiveFiltersBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filters = ref.watch(workOrdersFiltersProvider);
    if (filters.isEmpty) return const SizedBox.shrink();

    final chips = <Widget>[];
    void add(String label, VoidCallback onClear) {
      chips.add(InputChip(
        label: Text(label, style: AppTextStyles.caption),
        backgroundColor: AppColors.card,
        side: const BorderSide(color: AppColors.border),
        deleteIconColor: AppColors.textSecondary,
        onDeleted: onClear,
      ));
    }

    final notifier = ref.read(workOrdersFiltersProvider.notifier);
    if (filters.status != null) {
      add('Status: ${filters.status}',
          () => notifier.state = filters.copyWith(status: null));
    }
    if (filters.priority != null) {
      add('Priority: ${filters.priority}',
          () => notifier.state = filters.copyWith(priority: null));
    }
    if (filters.type != null) {
      add('Type: ${filters.type}',
          () => notifier.state = filters.copyWith(type: null));
    }
    if (filters.assignedToMe) {
      add('Assigned to me',
          () => notifier.state = filters.copyWith(assignedToMe: false));
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, 0, AppSpacing.md, AppSpacing.sm),
      child: SizedBox(
        height: 36,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: chips.length + 1,
          separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.xs),
          itemBuilder: (_, i) {
            if (i == chips.length) {
              return TextButton.icon(
                onPressed: () => notifier.state = const WorkOrderListFilters(),
                icon: const Icon(Icons.clear_all_rounded, size: 16),
                label: Text('Clear all', style: AppTextStyles.caption),
              );
            }
            return chips[i];
          },
        ),
      ),
    );
  }
}

/// Modal bottom sheet for editing the active [WorkOrderListFilters].
Future<void> showWorkOrderFilterSheet(
  BuildContext context,
  WidgetRef ref,
) async {
  final initial = ref.read(workOrdersFiltersProvider);
  WorkOrderListFilters draft = initial;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      return ClipRRect(
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppRadius.lg),
        ),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Material(
            color: AppColors.card.withOpacity(0.92),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.md),
                child: StatefulBuilder(
                  builder: (context, setState) {
                    return Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Text('Filter Work Orders',
                                style: AppTextStyles.title),
                            const Spacer(),
                            IconButton(
                              tooltip: 'Close',
                              icon: const Icon(Icons.close_rounded),
                              onPressed: () => Navigator.of(ctx).pop(),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _ChipGroup(
                          label: 'Status',
                          options: _statusOptions,
                          selected: draft.status,
                          onChanged: (v) =>
                              setState(() => draft = draft.copyWith(status: v)),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _ChipGroup(
                          label: 'Priority',
                          options: _priorityOptions,
                          selected: draft.priority,
                          onChanged: (v) => setState(
                              () => draft = draft.copyWith(priority: v)),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _ChipGroup(
                          label: 'Type',
                          options: _typeOptions,
                          selected: draft.type,
                          onChanged: (v) =>
                              setState(() => draft = draft.copyWith(type: v)),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        SwitchListTile.adaptive(
                          contentPadding: EdgeInsets.zero,
                          title: Text('Assigned to me',
                              style: AppTextStyles.body),
                          value: draft.assignedToMe,
                          activeColor: AppColors.primaryLight,
                          onChanged: (v) => setState(
                              () => draft = draft.copyWith(assignedToMe: v)),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => setState(() =>
                                    draft = const WorkOrderListFilters()),
                                child: const Text('Reset'),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: FilledButton(
                                onPressed: () {
                                  ref
                                      .read(workOrdersFiltersProvider.notifier)
                                      .state = draft;
                                  Navigator.of(ctx).pop();
                                },
                                child: const Text('Apply'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}

class _ChipGroup extends StatelessWidget {
  const _ChipGroup({
    required this.label,
    required this.options,
    required this.selected,
    required this.onChanged,
  });

  final String label;
  final List<String> options;
  final String? selected;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTextStyles.caption),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: options.map((opt) {
            final isSelected = opt == selected;
            return ChoiceChip(
              label: Text(opt, style: AppTextStyles.caption),
              selected: isSelected,
              selectedColor: AppColors.primaryLight.withOpacity(0.3),
              backgroundColor: AppColors.surface,
              side: BorderSide(
                color:
                    isSelected ? AppColors.primaryLight : AppColors.border,
              ),
              onSelected: (sel) => onChanged(sel ? opt : null),
            );
          }).toList(growable: false),
        ),
      ],
    );
  }
}
