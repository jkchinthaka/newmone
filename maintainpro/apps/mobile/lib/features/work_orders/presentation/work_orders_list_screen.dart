import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/i18n/app_strings.dart';
import '../../../core/network/api_exception.dart';
import '../../../design_system/design_system.dart';
import '../data/work_orders_repository.dart';

class WorkOrdersListScreen extends ConsumerWidget {
  const WorkOrdersListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(workOrdersListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.workOrdersTitle)),
      body: async.when(
        loading: () => const MpSkeletonList(),
        error: (e, _) => MpErrorState(
          title: 'Could not load work orders',
          message: e is ApiException ? e.message : e.toString(),
          onRetry: () => ref.invalidate(workOrdersListProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const MpEmptyState(
              title: AppStrings.emptyWorkOrders,
              icon: Icons.build_circle_outlined,
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(workOrdersListProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: MpSpacing.sm),
              itemBuilder: (context, index) {
                final wo = items[index];
                return MpCard(
                  onTap: () => context.push('/work-orders/${wo.id}'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              wo.title,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                          MpStatusChip(
                            label: wo.status.replaceAll('_', ' '),
                            tone: MpStatusTone.primary,
                          ),
                        ],
                      ),
                      if (wo.assetName != null) ...[
                        const SizedBox(height: MpSpacing.xs),
                        Text(wo.assetName!),
                      ],
                      if (wo.priority != null) ...[
                        const SizedBox(height: MpSpacing.xs),
                        Text('Priority: ${wo.priority}'),
                      ],
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
