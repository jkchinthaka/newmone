import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/database/app_database.dart';
import '../../core/i18n/app_strings.dart';
import '../../core/offline/outbox_service.dart';
import '../../core/offline/sync_controller.dart';
import '../../core/tenant/tenant_context.dart';
import '../../design_system/design_system.dart';

final _outboxProvider = FutureProvider.autoDispose((ref) async {
  final auth = ref.watch(authControllerProvider);
  final tenant = ref.watch(tenantContextProvider);
  final user = auth.user;
  final tenantId = tenant.tenantId;
  if (user == null || tenantId == null) return const <OutboxOperation>[];
  return ref.watch(outboxServiceProvider).listAll(
        tenantId: tenantId,
        userId: user.id,
      );
});

class SyncCenterScreen extends ConsumerWidget {
  const SyncCenterScreen({super.key});

  MpStatusTone _tone(String state) {
    switch (OutboxStateCodec.parse(state)) {
      case OutboxState.synced:
        return MpStatusTone.success;
      case OutboxState.syncing:
      case OutboxState.queued:
        return MpStatusTone.primary;
      case OutboxState.conflict:
      case OutboxState.failedPermanent:
        return MpStatusTone.error;
      case OutboxState.failedRetryable:
      case OutboxState.localDraft:
        return MpStatusTone.warning;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sync = ref.watch(syncControllerProvider);
    final async = ref.watch(_outboxProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.syncTitle),
        actions: [
          IconButton(
            tooltip: 'Sync now',
            onPressed: () async {
              await ref.read(syncControllerProvider.notifier).syncNow();
              ref.invalidate(_outboxProvider);
            },
            icon: const Icon(Icons.sync),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(MpSpacing.screenPadding),
            child: MpCard(
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Status: ${sync.phase.name}',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        if (sync.message != null) Text(sync.message!),
                        Text('Pending: ${sync.pendingCount}'),
                      ],
                    ),
                  ),
                  MpButton(
                    label: 'Sync',
                    expand: false,
                    onPressed: () async {
                      await ref.read(syncControllerProvider.notifier).syncNow();
                      ref.invalidate(_outboxProvider);
                    },
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: async.when(
              loading: () => const MpLoading(),
              error: (e, _) => MpErrorState(
                title: 'Could not load outbox',
                message: e.toString(),
                onRetry: () => ref.invalidate(_outboxProvider),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return const MpEmptyState(
                    title: AppStrings.emptySync,
                    icon: Icons.cloud_done_outlined,
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(MpSpacing.screenPadding),
                  itemCount: items.length,
                  separatorBuilder: (_, __) =>
                      const SizedBox(height: MpSpacing.sm),
                  itemBuilder: (context, index) {
                    final op = items[index];
                    return MpCard(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${op.entityType} · ${op.operation}',
                                  style:
                                      Theme.of(context).textTheme.titleMedium,
                                ),
                                const SizedBox(height: MpSpacing.xs),
                                Text('Attempts: ${op.attempts}'),
                                if (op.lastError != null)
                                  Text(
                                    op.lastError!,
                                    style: TextStyle(
                                      color:
                                          Theme.of(context).colorScheme.error,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          MpStatusChip(
                            label: op.state,
                            tone: _tone(op.state),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
