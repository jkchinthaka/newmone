import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/app_strings.dart';
import '../../../core/network/api_exception.dart';
import '../../../design_system/design_system.dart';
import '../data/work_orders_repository.dart';

class WorkOrderDetailScreen extends ConsumerStatefulWidget {
  const WorkOrderDetailScreen({super.key, required this.workOrderId});

  final String workOrderId;

  @override
  ConsumerState<WorkOrderDetailScreen> createState() =>
      _WorkOrderDetailScreenState();
}

class _WorkOrderDetailScreenState
    extends ConsumerState<WorkOrderDetailScreen> {
  bool _acting = false;

  Future<bool> _isOnline() async {
    final results = await Connectivity().checkConnectivity();
    return results.any((r) => r != ConnectivityResult.none);
  }

  Future<void> _updateStatus(String status) async {
    if (!await _isOnline()) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(AppStrings.offlineBanner)),
      );
      return;
    }

    setState(() => _acting = true);
    try {
      await ref.read(workOrdersRepositoryProvider).updateStatus(
            id: widget.workOrderId,
            status: status,
          );
      ref.invalidate(workOrderDetailProvider(widget.workOrderId));
      ref.invalidate(workOrdersListProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(AppStrings.statusUpdated)),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(AppStrings.actionFailed)),
      );
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(workOrderDetailProvider(widget.workOrderId));

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.workOrderDetailTitle)),
      body: async.when(
        loading: () => const MpLoading(),
        error: (e, _) => MpErrorState(
          title: 'Could not load work order',
          message: e is ApiException ? e.message : e.toString(),
          onRetry: () =>
              ref.invalidate(workOrderDetailProvider(widget.workOrderId)),
        ),
        data: (wo) {
          final canStart = !_statusIs(wo.status, const [
            'IN_PROGRESS',
            'COMPLETED',
            'CLOSED',
            'CANCELLED',
          ]);
          final canComplete = _statusIs(wo.status, const [
            'IN_PROGRESS',
            'OPEN',
            'ASSIGNED',
          ]);

          return ListView(
            padding: const EdgeInsets.all(MpSpacing.screenPadding),
            children: [
              Text(wo.title, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: MpSpacing.sm),
              Wrap(
                spacing: MpSpacing.sm,
                runSpacing: MpSpacing.sm,
                children: [
                  MpStatusChip(
                    label: wo.status.replaceAll('_', ' '),
                    tone: MpStatusTone.primary,
                  ),
                  if (wo.priority != null)
                    MpStatusChip(
                      label: wo.priority!,
                      tone: MpStatusTone.warning,
                    ),
                ],
              ),
              const SizedBox(height: MpSpacing.lg),
              if (wo.assetName != null)
                MpListTile(
                  title: 'Asset',
                  subtitle: wo.assetName,
                  leading: const Icon(Icons.precision_manufacturing_outlined),
                ),
              if (wo.assignedToName != null)
                MpListTile(
                  title: 'Assignee',
                  subtitle: wo.assignedToName,
                  leading: const Icon(Icons.person_outline),
                ),
              if (wo.description != null && wo.description!.isNotEmpty) ...[
                const MpSectionHeader(title: 'Description'),
                Text(wo.description!),
              ],
              const SizedBox(height: MpSpacing.xxl),
              if (canStart)
                MpButton(
                  label: AppStrings.startWork,
                  icon: Icons.play_arrow,
                  isLoading: _acting,
                  onPressed: _acting
                      ? null
                      : () => _updateStatus('IN_PROGRESS'),
                ),
              if (canStart && canComplete)
                const SizedBox(height: MpSpacing.md),
              if (canComplete)
                MpButton(
                  label: AppStrings.completeWork,
                  icon: Icons.check,
                  variant: MpButtonVariant.tonal,
                  isLoading: _acting,
                  onPressed: _acting
                      ? null
                      : () => _updateStatus('COMPLETED'),
                ),
            ],
          );
        },
      ),
    );
  }

  bool _statusIs(String status, List<String> candidates) {
    final s = status.toUpperCase();
    return candidates.any((c) => s == c || s.contains(c));
  }
}
