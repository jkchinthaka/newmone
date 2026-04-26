import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_text_styles.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../core/widgets/empty_state_widget.dart';
import '../../../core/widgets/error_widget.dart';
import '../../../core/widgets/loading_shimmer.dart';
import '../../../core/widgets/priority_badge.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/models/work_order.dart';
import 'providers/work_orders_provider.dart';
import 'widgets/work_order_filter_sheet.dart';

class WorkOrdersScreen extends ConsumerWidget {
  const WorkOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(workOrdersListProvider);
    final filters = ref.watch(workOrdersFiltersProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Work Orders'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Filter',
            icon: Badge(
              isLabelVisible: !filters.isEmpty,
              smallSize: 8,
              backgroundColor: AppColors.primaryLight,
              child: const Icon(Icons.tune_rounded),
            ),
            onPressed: () => showWorkOrderFilterSheet(context, ref),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/work-orders/create'),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New'),
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md, AppSpacing.xs, AppSpacing.md, AppSpacing.sm),
                child: const WorkOrderSearchField(),
              ),
              const WorkOrderActiveFiltersBar(),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () =>
                      ref.read(workOrdersListProvider.notifier).refresh(),
                  child: _buildBody(context, ref, state),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(
      BuildContext context, WidgetRef ref, WorkOrdersListState s) {
    if (s.loading && s.items.isEmpty) {
      return ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: 6,
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (_, __) => const CardShimmer(height: 110),
      );
    }
    if (s.error != null && s.items.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 80),
          AppErrorWidget(
            message: s.error!,
            onRetry: () => ref.read(workOrdersListProvider.notifier).refresh(),
          ),
        ],
      );
    }
    if (s.items.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          EmptyStateWidget(
            icon: Icons.work_history_outlined,
            title: 'No work orders',
            message: 'Create one or adjust your filters.',
          ),
        ],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.huge),
      itemCount: s.items.length,
      separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (_, i) => _WorkOrderTile(item: s.items[i]),
    );
  }
}

class _WorkOrderTile extends StatelessWidget {
  const _WorkOrderTile({required this.item});
  final WorkOrder item;

  @override
  Widget build(BuildContext context) {
    final overdue = item.isOverdue;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        onTap: () => context.push('/work-orders/${item.id}'),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.card.withOpacity(0.85),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(
              color: overdue ? AppColors.error : AppColors.border,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.woNumber.isEmpty ? 'WO' : item.woNumber,
                          style: AppTextStyles.caption.copyWith(
                            color: AppColors.primaryLight,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.4,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          item.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.subtitle.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  PriorityBadge(priority: item.priority),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  StatusBadge(
                    status: overdue ? 'OVERDUE' : item.status,
                    compact: true,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  if (item.assetName != null)
                    _MetaChip(
                      icon: Icons.precision_manufacturing_outlined,
                      label: item.assetName!,
                    ),
                ],
              ),
              if (item.dueDate != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Icon(
                      Icons.schedule_rounded,
                      size: 14,
                      color: overdue ? AppColors.error : AppColors.textMuted,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      overdue
                          ? 'Overdue · ${DateFormatter.shortDate(item.dueDate)}'
                          : 'Due ${DateFormatter.countdown(item.dueDate)}',
                      style: AppTextStyles.caption.copyWith(
                        color:
                            overdue ? AppColors.error : AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    if (item.technicianName != null)
                      Text(
                        item.technicianName!,
                        style: AppTextStyles.caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Flexible(
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.full),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: AppColors.textMuted),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                style: AppTextStyles.caption,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
