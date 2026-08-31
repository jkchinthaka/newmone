import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/i18n/app_strings.dart';
import '../../../core/network/api_exception.dart';
import '../../../design_system/design_system.dart';
import '../data/work_orders_repository.dart';

class WorkOrdersListScreen extends ConsumerStatefulWidget {
  const WorkOrdersListScreen({
    super.key,
    this.initialQueue,
    this.initialAssetId,
    this.assetFilterLabel,
  });

  final String? initialQueue;
  final String? initialAssetId;
  final String? assetFilterLabel;

  @override
  ConsumerState<WorkOrdersListScreen> createState() =>
      _WorkOrdersListScreenState();
}

class _WorkOrdersListScreenState extends ConsumerState<WorkOrdersListScreen> {
  final _searchController = TextEditingController();
  String? _queue;
  String? _status;
  String? _assetId;
  String? _assetFilterLabel;
  String _search = '';

  static const _queues = <(String?, String)>[
    (null, 'All'),
    (WorkOrderQueueKeys.myTasks, 'My tasks'),
    (WorkOrderQueueKeys.waitingParts, 'Parts'),
    (WorkOrderQueueKeys.waitingEvidence, 'Evidence'),
    (WorkOrderQueueKeys.supervisorVerification, 'Verify'),
    (WorkOrderQueueKeys.highRisk, 'High risk'),
  ];

  @override
  void initState() {
    super.initState();
    _queue = widget.initialQueue;
    _assetId = widget.initialAssetId;
    _assetFilterLabel = widget.assetFilterLabel;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  WorkOrdersListQuery get _query => WorkOrdersListQuery(
        queue: _assetId != null ? null : _queue,
        search: _search.isEmpty ? null : _search,
        status: _status,
        assetId: _assetId,
      );

  void _clearAssetFilter() => setState(() {
        _assetId = null;
        _assetFilterLabel = null;
      });

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(workOrdersListProvider(_query));

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.workOrdersTitle)),
      body: Column(
        children: [
          if (_assetId != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                MpSpacing.screenPadding,
                MpSpacing.md,
                MpSpacing.screenPadding,
                0,
              ),
              child: MpCard(
                child: Row(
                  children: [
                    const Icon(Icons.precision_manufacturing_outlined),
                    const SizedBox(width: MpSpacing.sm),
                    Expanded(
                      child: Text(
                        'Asset filter: ${_assetFilterLabel ?? _assetId!}',
                      ),
                    ),
                    TextButton(
                      onPressed: _clearAssetFilter,
                      child: const Text('Clear'),
                    ),
                  ],
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              MpSpacing.screenPadding,
              MpSpacing.md,
              MpSpacing.screenPadding,
              MpSpacing.sm,
            ),
            child: MpTextField(
              controller: _searchController,
              label: 'Search',
              hint: 'Title, asset, ID…',
              prefixIcon: Icons.search,
              textInputAction: TextInputAction.search,
              onSubmitted: (value) => setState(() => _search = value.trim()),
            ),
          ),
          if (_assetId == null)
            SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: MpSpacing.screenPadding,
              ),
              itemCount: _queues.length,
              separatorBuilder: (_, __) => const SizedBox(width: MpSpacing.sm),
              itemBuilder: (context, index) {
                final (key, label) = _queues[index];
                final selected = _queue == key;
                return FilterChip(
                  label: Text(label),
                  selected: selected,
                  onSelected: (_) => setState(() => _queue = key),
                );
              },
            ),
          ),
          if (_assetId == null) const SizedBox(height: MpSpacing.sm),
          Expanded(
            child: async.when(
              loading: () => const MpSkeletonList(),
              error: (e, _) => MpErrorState(
                title: 'Could not load work orders',
                message: e is ApiException ? e.message : e.toString(),
                onRetry: () => ref.invalidate(workOrdersListProvider(_query)),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return const MpEmptyState(
                    title: AppStrings.emptyWorkOrders,
                    icon: Icons.build_circle_outlined,
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(workOrdersListProvider(_query)),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(MpSpacing.screenPadding),
                    itemCount: items.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: MpSpacing.sm),
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
                                    style:
                                        Theme.of(context).textTheme.titleMedium,
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
          ),
        ],
      ),
    );
  }
}
