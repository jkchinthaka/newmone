import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/i18n/app_strings.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/offline/outbox_service.dart';
import '../../../core/tenant/tenant_context.dart';
import '../../../design_system/design_system.dart';
import '../data/work_orders_repository.dart';

class WorkOrderDetailScreen extends ConsumerStatefulWidget {
  const WorkOrderDetailScreen({super.key, required this.workOrderId});

  final String workOrderId;

  @override
  ConsumerState<WorkOrderDetailScreen> createState() =>
      _WorkOrderDetailScreenState();
}

class _WorkOrderDetailScreenState extends ConsumerState<WorkOrderDetailScreen> {
  bool _acting = false;
  final _noteController = TextEditingController();

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

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

  Future<void> _saveNote() async {
    final text = _noteController.text.trim();
    if (text.isEmpty) return;

    final auth = ref.read(authControllerProvider);
    final tenantId = ref.read(tenantContextProvider).tenantId ??
        auth.user?.tenantId ??
        '';
    final userId = auth.user?.id ?? '';

    final online = await _isOnline();
    setState(() => _acting = true);
    try {
      if (online && tenantId.isNotEmpty) {
        await ref.read(workOrdersRepositoryProvider).addNote(
              id: widget.workOrderId,
              note: text,
            );
      } else {
        await ref.read(outboxServiceProvider).saveDraft(
              tenantId: tenantId.isEmpty ? 'unknown' : tenantId,
              userId: userId.isEmpty ? 'unknown' : userId,
              entityType: 'WorkOrderNote',
              entityId: widget.workOrderId,
              title: 'WO note draft',
              payload: {
                'workOrderId': widget.workOrderId,
                'note': text,
              },
            );
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Note saved to Draft Center')),
        );
        _noteController.clear();
        return;
      }
      if (!mounted) return;
      _noteController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Note saved')),
      );
    } on ApiException catch (e) {
      // Fall back to local draft on failure.
      if (tenantId.isNotEmpty && userId.isNotEmpty) {
        await ref.read(outboxServiceProvider).saveDraft(
              tenantId: tenantId,
              userId: userId,
              entityType: 'WorkOrderNote',
              entityId: widget.workOrderId,
              title: 'WO note draft',
              payload: {
                'workOrderId': widget.workOrderId,
                'note': text,
              },
            );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${e.message} — saved as draft')),
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
          final status = wo.status.toUpperCase();
          final canStart = status == 'OPEN' || status == 'REWORK_REQUIRED';
          final canComplete = status == 'IN_PROGRESS' || status == 'ON_HOLD';

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
                  title: 'Asset / Vehicle',
                  subtitle: wo.assetName,
                  leading: const Icon(Icons.precision_manufacturing_outlined),
                ),
              if (wo.assignedToName != null)
                MpListTile(
                  title: 'Assigned technician',
                  subtitle: wo.assignedToName,
                  leading: const Icon(Icons.person_outline),
                ),
              if (wo.description != null && wo.description!.isNotEmpty) ...[
                const MpSectionHeader(title: 'Description'),
                Text(wo.description!),
              ],
              const MpSectionHeader(title: 'Field note'),
              MpTextField(
                controller: _noteController,
                label: 'Note',
                hint: 'Capture observations…',
                maxLines: 3,
              ),
              const SizedBox(height: MpSpacing.sm),
              MpButton(
                label: 'Save note',
                icon: Icons.note_alt_outlined,
                variant: MpButtonVariant.outlined,
                isLoading: _acting,
                onPressed: _acting ? null : _saveNote,
              ),
              const SizedBox(height: MpSpacing.xxl),
              if (canStart)
                MpButton(
                  label: AppStrings.startWork,
                  icon: Icons.play_arrow,
                  isLoading: _acting,
                  onPressed:
                      _acting ? null : () => _updateStatus('IN_PROGRESS'),
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
                      : () => _updateStatus('TECHNICIAN_COMPLETED'),
                ),
            ],
          );
        },
      ),
    );
  }
}
