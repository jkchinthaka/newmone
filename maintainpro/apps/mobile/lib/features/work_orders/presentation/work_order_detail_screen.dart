import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/i18n/app_strings.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/offline/outbox_service.dart';
import '../../../core/offline/sync_controller.dart';
import '../../../core/tenant/tenant_context.dart';
import '../../../design_system/design_system.dart';
import '../data/evidence_upload_service.dart';
import '../data/work_orders_repository.dart';

const _statusActionRoles = {
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'OPERATIONS_MANAGER',
  'ASSET_MANAGER',
  'TECHNICIAN',
  'MECHANIC',
  'FACILITY_MANAGER',
};

const _evidenceUploadRoles = {
  'SUPER_ADMIN',
  'ADMIN',
  'ASSET_MANAGER',
  'MECHANIC',
  'TECHNICIAN',
  'FACILITY_MANAGER',
  'MANAGER',
};

class WorkOrderDetailScreen extends ConsumerStatefulWidget {
  const WorkOrderDetailScreen({super.key, required this.workOrderId});

  final String workOrderId;

  @override
  ConsumerState<WorkOrderDetailScreen> createState() =>
      _WorkOrderDetailScreenState();
}

class _WorkOrderDetailScreenState extends ConsumerState<WorkOrderDetailScreen> {
  final _noteController = TextEditingController();
  final _actionGuard = InFlightGuard();
  final _noteGuard = InFlightGuard();

  String _evidenceType = 'BEFORE_PHOTO';
  List<PendingEvidenceDraft> _pending = const [];
  bool _pendingLoading = false;
  bool _evidenceBusy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reloadPending());
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<bool> _isOnline() async {
    final results = await Connectivity().checkConnectivity();
    return results.any((r) => r != ConnectivityResult.none);
  }

  Future<void> _reloadPending() async {
    setState(() => _pendingLoading = true);
    try {
      final list = await ref
          .read(evidenceUploadServiceProvider)
          .listPendingForWorkOrder(widget.workOrderId);
      if (!mounted) return;
      setState(() => _pending = list);
    } catch (_) {
      // Draft DB may be unavailable in tests / before bootstrap.
      if (mounted) setState(() => _pending = const []);
    } finally {
      if (mounted) setState(() => _pendingLoading = false);
    }
  }

  Future<void> _updateStatus(String status) async {
    final auth = ref.read(authControllerProvider);
    final tenantId =
        ref.read(tenantContextProvider).tenantId ?? auth.user?.tenantId ?? '';
    final userId = auth.user?.id ?? '';
    final online = await _isOnline();

    Future<void> enqueueStatus() async {
      if (tenantId.isEmpty || userId.isEmpty) {
        throw StateError('Missing tenant/user for offline queue');
      }
      await ref.read(outboxServiceProvider).enqueueIfAbsent(
            tenantId: tenantId,
            userId: userId,
            entityType: 'work_order',
            entityId: widget.workOrderId,
            operation: 'status',
            payload: {
              'id': widget.workOrderId,
              'status': status,
            },
            idempotencyKey: const Uuid().v4(),
          );
      unawaited(ref.read(syncControllerProvider.notifier).refreshCounts());
    }

    final result = await _actionGuard.run(() async {
      if (!online) {
        await enqueueStatus();
        return 'queued';
      }
      try {
        await ref.read(workOrdersRepositoryProvider).updateStatus(
              id: widget.workOrderId,
              status: status,
            );
        ref.invalidate(workOrderDetailProvider(widget.workOrderId));
        ref.invalidate(workOrderActivityProvider(widget.workOrderId));
        return 'updated';
      } on NetworkException {
        await enqueueStatus();
        return 'queued';
      } on ServerException {
        await enqueueStatus();
        return 'queued';
      }
    });

    if (!mounted) return;
    if (result == null) return; // double-submit ignored
    setState(() {});
    if (result == 'queued') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(AppStrings.queuedForSync)),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(AppStrings.statusUpdated)),
      );
    }
  }

  Future<void> _saveNote() async {
    final text = _noteController.text.trim();
    if (text.isEmpty) return;

    final auth = ref.read(authControllerProvider);
    final tenantId =
        ref.read(tenantContextProvider).tenantId ?? auth.user?.tenantId ?? '';
    final userId = auth.user?.id ?? '';

    await _noteGuard.run(() async {
      final online = await _isOnline();
      try {
        if (online && tenantId.isNotEmpty) {
          await ref.read(workOrdersRepositoryProvider).addNote(
                id: widget.workOrderId,
                note: text,
              );
          if (!mounted) return;
          _noteController.clear();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Note saved')),
          );
          ref.invalidate(workOrderActivityProvider(widget.workOrderId));
        } else {
          if (tenantId.isEmpty || userId.isEmpty) {
            throw const NetworkException(AppStrings.onlineRequired);
          }
          await ref.read(outboxServiceProvider).enqueueIfAbsent(
                tenantId: tenantId,
                userId: userId,
                entityType: 'work_order',
                entityId: widget.workOrderId,
                operation: 'note',
                payload: {
                  'workOrderId': widget.workOrderId,
                  'note': text,
                },
                idempotencyKey: const Uuid().v4(),
              );
          unawaited(ref.read(syncControllerProvider.notifier).refreshCounts());
          if (!mounted) return;
          _noteController.clear();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text(AppStrings.queuedForSync)),
          );
        }
      } on NetworkException {
        if (tenantId.isNotEmpty && userId.isNotEmpty) {
          await ref.read(outboxServiceProvider).enqueueIfAbsent(
                tenantId: tenantId,
                userId: userId,
                entityType: 'work_order',
                entityId: widget.workOrderId,
                operation: 'note',
                payload: {
                  'workOrderId': widget.workOrderId,
                  'note': text,
                },
              );
          unawaited(ref.read(syncControllerProvider.notifier).refreshCounts());
        }
        if (!mounted) return;
        _noteController.clear();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text(AppStrings.queuedForSync)),
        );
      } on ServerException catch (e) {
        if (tenantId.isNotEmpty && userId.isNotEmpty) {
          await ref.read(outboxServiceProvider).enqueueIfAbsent(
                tenantId: tenantId,
                userId: userId,
                entityType: 'work_order',
                entityId: widget.workOrderId,
                operation: 'note',
                payload: {
                  'workOrderId': widget.workOrderId,
                  'note': text,
                },
              );
          unawaited(ref.read(syncControllerProvider.notifier).refreshCounts());
          if (!mounted) return;
          _noteController.clear();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${e.message} — ${AppStrings.queuedForSync}')),
          );
        } else if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.message)),
          );
        }
      } on ApiException catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    });
    if (mounted) setState(() {});
  }

  Future<void> _addEvidence(ImageSource source) async {
    setState(() => _evidenceBusy = true);
    try {
      final outcome =
          await ref.read(evidenceUploadServiceProvider).captureAndUpload(
                workOrderId: widget.workOrderId,
                source: source,
                evidenceType: _evidenceType,
              );
      if (!mounted) return;
      switch (outcome.status) {
        case EvidenceUploadStatus.cancelled:
          break;
        case EvidenceUploadStatus.inFlight:
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Upload already in progress')),
          );
        case EvidenceUploadStatus.queued:
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Saved offline — retry from pending list'),
            ),
          );
        case EvidenceUploadStatus.uploaded:
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Evidence uploaded')),
          );
          ref.invalidate(workOrderEvidenceProvider(widget.workOrderId));
          ref.invalidate(workOrderActivityProvider(widget.workOrderId));
        case EvidenceUploadStatus.failed:
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(outcome.message ?? 'Evidence upload failed'),
            ),
          );
      }
      await _reloadPending();
    } finally {
      if (mounted) setState(() => _evidenceBusy = false);
    }
  }

  Future<void> _retryPending(PendingEvidenceDraft draft) async {
    setState(() => _evidenceBusy = true);
    try {
      final outcome =
          await ref.read(evidenceUploadServiceProvider).retryPending(draft);
      if (!mounted) return;
      if (outcome.status == EvidenceUploadStatus.uploaded) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Pending evidence synced')),
        );
        ref.invalidate(workOrderEvidenceProvider(widget.workOrderId));
      } else if (outcome.status == EvidenceUploadStatus.failed) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(outcome.message ?? 'Retry failed')),
        );
      }
      await _reloadPending();
    } finally {
      if (mounted) setState(() => _evidenceBusy = false);
    }
  }

  bool _canActOnStatus(String? role) {
    if (role == null) return false;
    return _statusActionRoles.contains(role.toUpperCase());
  }

  bool _canUploadEvidence(String? role) {
    if (role == null) return false;
    return _evidenceUploadRoles.contains(role.toUpperCase());
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(workOrderDetailProvider(widget.workOrderId));
    final role = ref.watch(authControllerProvider).user?.role;
    final acting = _actionGuard.isBusy;

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
          final canStart = _canActOnStatus(role) &&
              (status == 'OPEN' || status == 'REWORK_REQUIRED');
          final canComplete = _canActOnStatus(role) &&
              (status == 'IN_PROGRESS' || status == 'ON_HOLD');
          final assetVehicle = [
            if (wo.assetName != null && wo.assetName!.isNotEmpty) wo.assetName!,
            if (wo.vehicleName != null && wo.vehicleName!.isNotEmpty)
              wo.vehicleName!,
          ].join(' · ');
          final due = wo.dueDate ??
              DateTime.tryParse((wo.raw['dueDate'] ?? '').toString());

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(workOrderDetailProvider(widget.workOrderId));
              ref.invalidate(workOrderEvidenceProvider(widget.workOrderId));
              ref.invalidate(workOrderPartsProvider(widget.workOrderId));
              ref.invalidate(workOrderActivityProvider(widget.workOrderId));
              await _reloadPending();
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(wo.title,
                      style: Theme.of(context).textTheme.headlineSmall),
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
                  if (assetVehicle.isNotEmpty)
                    MpListTile(
                      title: 'Asset / Vehicle',
                      subtitle: assetVehicle,
                      leading:
                          const Icon(Icons.precision_manufacturing_outlined),
                    ),
                  if (wo.assignedToName != null)
                    MpListTile(
                      title: 'Assignee',
                      subtitle: wo.assignedToName,
                      leading: const Icon(Icons.person_outline),
                    ),
                  if (due != null)
                    MpListTile(
                      title: 'Due',
                      subtitle:
                          DateFormat.yMMMd().add_jm().format(due.toLocal()),
                      leading: const Icon(Icons.event_outlined),
                    ),
                  if (wo.description != null && wo.description!.isNotEmpty) ...[
                    const MpSectionHeader(title: 'Description'),
                    Text(wo.description!),
                  ],
                  if (canStart || canComplete) ...[
                    const MpSectionHeader(title: 'Actions'),
                    if (canStart)
                      MpButton(
                        label: AppStrings.startWork,
                        icon: Icons.play_arrow,
                        isLoading: acting,
                        onPressed:
                            acting ? null : () => _updateStatus('IN_PROGRESS'),
                      ),
                    if (canStart && canComplete)
                      const SizedBox(height: MpSpacing.md),
                    if (canComplete)
                      MpButton(
                        label: AppStrings.completeWork,
                        icon: Icons.check,
                        variant: MpButtonVariant.tonal,
                        isLoading: acting,
                        onPressed: acting
                            ? null
                            : () => _updateStatus('TECHNICIAN_COMPLETED'),
                      ),
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
                    isLoading: _noteGuard.isBusy,
                    onPressed: _noteGuard.isBusy ? null : _saveNote,
                  ),
                  const MpSectionHeader(title: 'Evidence'),
                  _EvidenceSection(
                    workOrderId: widget.workOrderId,
                    canUpload: _canUploadEvidence(role),
                    evidenceType: _evidenceType,
                    onEvidenceTypeChanged: (v) =>
                        setState(() => _evidenceType = v),
                    busy: _evidenceBusy,
                    pending: _pending,
                    pendingLoading: _pendingLoading,
                    onCamera: () => _addEvidence(ImageSource.camera),
                    onGallery: () => _addEvidence(ImageSource.gallery),
                    onRetry: _retryPending,
                  ),
                  const MpSectionHeader(title: 'Parts'),
                  _PartsSection(workOrderId: widget.workOrderId),
                  const MpSectionHeader(title: 'Activity'),
                  _ActivitySection(workOrderId: widget.workOrderId),
                  const SizedBox(height: MpSpacing.xxl),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _EvidenceSection extends ConsumerWidget {
  const _EvidenceSection({
    required this.workOrderId,
    required this.canUpload,
    required this.evidenceType,
    required this.onEvidenceTypeChanged,
    required this.busy,
    required this.pending,
    required this.pendingLoading,
    required this.onCamera,
    required this.onGallery,
    required this.onRetry,
  });

  final String workOrderId;
  final bool canUpload;
  final String evidenceType;
  final ValueChanged<String> onEvidenceTypeChanged;
  final bool busy;
  final List<PendingEvidenceDraft> pending;
  final bool pendingLoading;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final void Function(PendingEvidenceDraft) onRetry;

  static const _types = [
    ('BEFORE_PHOTO', 'Before'),
    ('AFTER_PHOTO', 'After'),
    ('DAMAGE_PHOTO', 'Damage'),
    ('PART_PHOTO', 'Part'),
    ('OTHER_DOCUMENT', 'Other'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(workOrderEvidenceProvider(workOrderId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (canUpload) ...[
          Wrap(
            spacing: MpSpacing.sm,
            children: _types
                .map(
                  (t) => ChoiceChip(
                    label: Text(t.$2),
                    selected: evidenceType == t.$1,
                    onSelected:
                        busy ? null : (_) => onEvidenceTypeChanged(t.$1),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: MpSpacing.sm),
          Row(
            children: [
              Expanded(
                child: MpButton(
                  label: 'Camera',
                  icon: Icons.photo_camera_outlined,
                  isLoading: busy,
                  onPressed: busy ? null : onCamera,
                ),
              ),
              const SizedBox(width: MpSpacing.sm),
              Expanded(
                child: MpButton(
                  label: 'Gallery',
                  icon: Icons.photo_library_outlined,
                  variant: MpButtonVariant.outlined,
                  isLoading: busy,
                  onPressed: busy ? null : onGallery,
                ),
              ),
            ],
          ),
          if (busy) ...[
            const SizedBox(height: MpSpacing.sm),
            const LinearProgressIndicator(),
          ],
          const SizedBox(height: MpSpacing.md),
        ],
        if (pendingLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: MpSpacing.sm),
            child: MpLoading(centered: false),
          )
        else if (pending.isNotEmpty) ...[
          Text(
            'Pending local uploads',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: MpSpacing.sm),
          ...pending.map(
            (d) => MpListTile(
              title: d.fileName,
              subtitle:
                  '${d.evidenceType.replaceAll('_', ' ')} · ${d.state}${d.lastError != null ? ' · ${d.lastError}' : ''}',
              leading: const Icon(Icons.cloud_upload_outlined),
              trailing: IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: busy ? null : () => onRetry(d),
              ),
            ),
          ),
          const SizedBox(height: MpSpacing.md),
        ],
        async.when(
          loading: () => const MpLoading(centered: false),
          error: (e, _) => MpErrorState(
            title: 'Evidence unavailable',
            message: e is ApiException ? e.message : e.toString(),
            onRetry: () =>
                ref.invalidate(workOrderEvidenceProvider(workOrderId)),
          ),
          data: (items) {
            if (items.isEmpty) {
              return const MpEmptyState(
                title: 'No evidence yet',
                message: 'Add before/after photos from the field.',
                icon: Icons.image_outlined,
              );
            }
            return Column(
              children: items
                  .map(
                    (item) => MpListTile(
                      title: item.fileName,
                      subtitle:
                          '${item.evidenceType.replaceAll('_', ' ')} · ${item.status}${item.verificationStatus != null ? ' · ${item.verificationStatus}' : ''}',
                      leading: const Icon(Icons.attach_file),
                    ),
                  )
                  .toList(),
            );
          },
        ),
      ],
    );
  }
}

class _PartsSection extends ConsumerWidget {
  const _PartsSection({required this.workOrderId});

  final String workOrderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(workOrderPartsProvider(workOrderId));
    return async.when(
      loading: () => const MpLoading(centered: false),
      error: (e, _) => MpErrorState(
        title: 'Parts unavailable',
        message: e is ApiException ? e.message : e.toString(),
        onRetry: () => ref.invalidate(workOrderPartsProvider(workOrderId)),
      ),
      data: (parts) {
        if (parts.isEmpty) {
          return const MpEmptyState(
            title: 'No parts on this work order',
            message:
                'Inventory issue/return is online-only and not available here.',
            icon: Icons.inventory_2_outlined,
          );
        }
        return Column(
          children: parts
              .map(
                (line) => MpListTile(
                  title: line.partName,
                  subtitle: [
                    if (line.sku != null) line.sku!,
                    if (line.lineStatus != null)
                      line.lineStatus!.replaceAll('_', ' '),
                    if (line.requestedQuantity != null)
                      'Qty ${line.requestedQuantity}',
                    if (line.issuedQuantity != null)
                      'Issued ${line.issuedQuantity}',
                  ].join(' · '),
                  leading: const Icon(Icons.handyman_outlined),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _ActivitySection extends ConsumerWidget {
  const _ActivitySection({required this.workOrderId});

  final String workOrderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(workOrderActivityProvider(workOrderId));
    return async.when(
      loading: () => const MpLoading(centered: false),
      error: (e, _) => MpErrorState(
        title: 'Activity unavailable',
        message: e is ApiException ? e.message : e.toString(),
        onRetry: () => ref.invalidate(workOrderActivityProvider(workOrderId)),
      ),
      data: (events) {
        if (events.isEmpty) {
          return const MpEmptyState(
            title: 'No activity yet',
            icon: Icons.timeline,
          );
        }
        return Column(
          children: events.map((e) {
            final when =
                DateFormat.MMMd().add_jm().format(e.timestamp.toLocal());
            return MpListTile(
              title: e.label,
              subtitle: [
                when,
                if (e.actorName != null) e.actorName!,
                if (e.description != null && e.description!.isNotEmpty)
                  e.description!,
              ].join(' · '),
              leading: const Icon(Icons.circle, size: 12),
            );
          }).toList(),
        );
      },
    );
  }
}
