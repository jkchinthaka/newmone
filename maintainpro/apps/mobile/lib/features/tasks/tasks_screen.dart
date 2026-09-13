import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n/app_strings.dart';
import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import '../shell/adaptive_shell.dart';
import '../work_orders/data/work_orders_repository.dart';

/// Action Center queues backed by Nest `/work-orders/queues/:queueKey`.
class TasksScreen extends ConsumerWidget {
  const TasksScreen({super.key, this.queue});

  final String? queue;

  String get _title {
    switch (queue) {
      case WorkOrderQueueKeys.waitingEvidence:
        return 'Evidence needed';
      case WorkOrderQueueKeys.waitingParts:
        return 'Waiting parts';
      case WorkOrderQueueKeys.supervisorVerification:
        return 'Pending verification';
      case WorkOrderQueueKeys.highRisk:
        return 'High risk';
      case WorkOrderQueueKeys.triage:
        return 'Triage';
      case WorkOrderQueueKeys.myTasks:
        return 'My tasks';
      case 'action-required':
        return 'Action required';
      default:
        return AppStrings.navTasks;
    }
  }

  WorkOrdersListQuery get _query => WorkOrdersListQuery(
        queue: queue ?? 'action-required',
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(workOrdersListProvider(_query));

    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        actions: [
          ...shellActions(context),
          PopupMenuButton<String>(
            tooltip: 'Queues',
            onSelected: (value) => context.go('/tasks?queue=$value'),
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'action-required', child: Text('Action required')),
              PopupMenuItem(value: WorkOrderQueueKeys.myTasks, child: Text('My tasks')),
              PopupMenuItem(value: WorkOrderQueueKeys.waitingParts, child: Text('Waiting parts')),
              PopupMenuItem(
                value: WorkOrderQueueKeys.waitingEvidence,
                child: Text('Evidence needed'),
              ),
              PopupMenuItem(
                value: WorkOrderQueueKeys.supervisorVerification,
                child: Text('Pending verification'),
              ),
              PopupMenuItem(value: WorkOrderQueueKeys.highRisk, child: Text('High risk')),
              PopupMenuItem(value: WorkOrderQueueKeys.triage, child: Text('Triage')),
            ],
          ),
        ],
      ),
      body: async.when(
        loading: () => const MpSkeletonList(),
        error: (e, _) => MpErrorState(
          title: 'Could not load tasks',
          message: e is ApiException ? e.message : e.toString(),
          onRetry: () => ref.invalidate(workOrdersListProvider(_query)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return MpEmptyState(
              title: AppStrings.emptyTasks,
              message: 'No items in this queue right now.',
              actionLabel: 'Open work orders',
              onAction: () => context.push('/work-orders'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(workOrdersListProvider(_query)),
            child: ListView.separated(
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: MpSpacing.sm),
              itemBuilder: (context, index) {
                final wo = items[index];
                return MpWorkOrderCard(
                  title: wo.title,
                  status: wo.status,
                  priority: wo.priority,
                  assetName: wo.assetName,
                  vehicleName: wo.vehicleName,
                  assigneeName: wo.assignedToName,
                  dueDate: wo.dueDate,
                  onTap: () => context.push('/work-orders/${wo.id}'),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
