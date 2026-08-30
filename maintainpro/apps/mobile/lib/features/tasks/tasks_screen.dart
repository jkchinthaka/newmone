import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n/app_strings.dart';
import '../../design_system/design_system.dart';
import '../shell/adaptive_shell.dart';
import '../work_orders/data/work_orders_repository.dart';

/// Action center / queue placeholder wired for real work-order lists.
class TasksScreen extends ConsumerWidget {
  const TasksScreen({super.key, this.queue});

  final String? queue;

  String get _title {
    switch (queue) {
      case 'waiting-evidence':
        return 'Evidence needed';
      case 'waiting-parts':
        return 'Waiting parts';
      case 'supervisor-verification':
        return 'Pending verification';
      case 'high-risk':
        return 'High risk';
      case 'triage':
        return 'Triage';
      case 'my-tasks':
        return 'My tasks';
      default:
        return AppStrings.navTasks;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(workOrdersListProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        actions: shellActions(context),
      ),
      body: async.when(
        loading: () => const MpSkeletonList(),
        error: (e, _) => MpErrorState(
          title: 'Could not load tasks',
          message: e.toString(),
          onRetry: () => ref.invalidate(workOrdersListProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return MpEmptyState(
              title: AppStrings.emptyTasks,
              message: 'Queues will show assigned work orders here.',
              actionLabel: 'Open work orders',
              onAction: () => context.push('/work-orders'),
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
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              wo.title,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            if (wo.assetName != null) ...[
                              const SizedBox(height: MpSpacing.xs),
                              Text(wo.assetName!),
                            ],
                          ],
                        ),
                      ),
                      MpStatusChip(
                        label: wo.status.replaceAll('_', ' '),
                        tone: _toneFor(wo.status),
                      ),
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

  MpStatusTone _toneFor(String status) {
    final s = status.toUpperCase();
    if (s.contains('COMPLETE') || s.contains('CLOSED')) {
      return MpStatusTone.success;
    }
    if (s.contains('PROGRESS') || s.contains('OPEN')) {
      return MpStatusTone.primary;
    }
    if (s.contains('HOLD') || s.contains('WAIT')) {
      return MpStatusTone.warning;
    }
    if (s.contains('CANCEL') || s.contains('FAIL')) {
      return MpStatusTone.error;
    }
    return MpStatusTone.neutral;
  }
}
