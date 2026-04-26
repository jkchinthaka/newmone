import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/app_text_styles.dart';
import '../../../../core/widgets/bottom_sheet_widget.dart';
import '../../data/models/asset.dart';
import '../providers/assets_provider.dart';

const _statusOptions = [
  'OPERATIONAL',
  'MAINTENANCE',
  'OUT_OF_SERVICE',
  'RETIRED',
  'DISPOSED',
];
const _categoryOptions = [
  'VEHICLE',
  'EQUIPMENT',
  'TOOL',
  'BUILDING',
  'IT_HARDWARE',
  'OTHER',
];
const _conditionOptions = [
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'POOR',
  'BROKEN',
];

Future<void> showAssetFilterSheet(BuildContext context, WidgetRef ref) async {
  AssetListFilters draft = ref.read(assetsFiltersProvider);

  await showAppBottomSheet<void>(
    context,
    title: 'Filter Assets',
    child: StatefulBuilder(
      builder: (context, setState) {
        Widget chips({
          required String label,
          required List<String> options,
          required String? selected,
          required void Function(String?) onSelect,
        }) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AppTextStyles.label),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  for (final o in options)
                    ChoiceChip(
                      label: Text(o.replaceAll('_', ' ')),
                      selected: selected == o,
                      onSelected: (sel) =>
                          setState(() => onSelect(sel ? o : null)),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
            ],
          );
        }

        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            chips(
              label: 'Status',
              options: _statusOptions,
              selected: draft.status,
              onSelect: (v) => draft = draft.copyWith(status: v),
            ),
            chips(
              label: 'Category',
              options: _categoryOptions,
              selected: draft.category,
              onSelect: (v) => draft = draft.copyWith(category: v),
            ),
            chips(
              label: 'Condition',
              options: _conditionOptions,
              selected: draft.condition,
              onSelect: (v) => draft = draft.copyWith(condition: v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Include archived'),
              value: draft.includeArchived,
              onChanged: (v) =>
                  setState(() => draft = draft.copyWith(includeArchived: v)),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      ref.read(assetsFiltersProvider.notifier).state =
                          const AssetListFilters();
                      Navigator.pop(context);
                    },
                    child: const Text('Clear'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: FilledButton(
                    onPressed: () {
                      ref.read(assetsFiltersProvider.notifier).state = draft;
                      Navigator.pop(context);
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
  );
}

class AssetActiveFiltersBar extends ConsumerWidget {
  const AssetActiveFiltersBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final f = ref.watch(assetsFiltersProvider);
    if (f.isEmpty) return const SizedBox.shrink();

    final chips = <Widget>[];
    void add(String label, VoidCallback onClear) {
      chips.add(InputChip(
        label: Text(label),
        onDeleted: onClear,
        deleteIconColor: AppColors.textSecondary,
        backgroundColor: AppColors.card.withValues(alpha: 0.7),
        side: BorderSide(color: AppColors.border),
      ));
    }

    if (f.status != null) {
      add(
          'Status: ${f.status}',
          () => ref
              .read(assetsFiltersProvider.notifier)
              .update((s) => s.copyWith(status: null)));
    }
    if (f.category != null) {
      add(
          'Category: ${f.category}',
          () => ref
              .read(assetsFiltersProvider.notifier)
              .update((s) => s.copyWith(category: null)));
    }
    if (f.condition != null) {
      add(
          'Condition: ${f.condition}',
          () => ref
              .read(assetsFiltersProvider.notifier)
              .update((s) => s.copyWith(condition: null)));
    }
    if (f.location != null) {
      add(
          'Location: ${f.location}',
          () => ref
              .read(assetsFiltersProvider.notifier)
              .update((s) => s.copyWith(location: null)));
    }
    if (f.includeArchived) {
      add(
          'Archived',
          () => ref
              .read(assetsFiltersProvider.notifier)
              .update((s) => s.copyWith(includeArchived: false)));
    }

    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        itemCount: chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.xs),
        itemBuilder: (_, i) => Center(child: chips[i]),
      ),
    );
  }
}
