import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/database/app_database.dart';
import '../../design_system/design_system.dart';
import 'data/cl30_draft_store.dart';

class Cl30DraftsScreen extends ConsumerWidget {
  const Cl30DraftsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(cl30DraftsListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('CL30 drafts')),
      body: async.when(
        loading: () => const MpLoading(message: 'Loading drafts…'),
        error: (e, _) => MpErrorState(
          title: 'Could not load drafts',
          message: e.toString(),
          onRetry: () => ref.invalidate(cl30DraftsListProvider),
        ),
        data: (drafts) {
          if (drafts.isEmpty) {
            return MpEmptyState(
              title: 'No local drafts',
              message: 'Start a New CL30 to create a draft.',
              actionLabel: 'New CL30',
              onAction: () => context.push('/fg/cl30/new'),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(MpSpacing.screenPadding),
            itemCount: drafts.length,
            separatorBuilder: (_, __) => const SizedBox(height: MpSpacing.sm),
            itemBuilder: (context, index) {
              final d = drafts[index];
              return _DraftTile(draft: d);
            },
          );
        },
      ),
    );
  }
}

class _DraftTile extends ConsumerWidget {
  const _DraftTile({required this.draft});

  final LocalDraft draft;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final payload = ref.read(cl30DraftStoreProvider).parsePayload(draft);
    final title = draft.title ?? payload?.title ?? 'CL30 draft';
    final subtitle = [
      if (payload?.recordId != null) 'Record ${payload!.recordId}',
      if (payload?.displayDate != null) payload!.displayDate!,
      'Updated ${draft.updatedAt.toLocal()}',
    ].join(' · ');

    return MpCard(
      onTap: () {
        if (payload?.recordId != null && payload!.recordId!.isNotEmpty) {
          context.push(
            '/fg/cl30/records/${payload.recordId}',
            extra: {'draftId': draft.draftId},
          );
        } else {
          context.push(
            '/fg/cl30/new',
            extra: {'draftId': draft.draftId},
          );
        }
      },
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: IconButton(
          icon: const Icon(Icons.delete_outline),
          onPressed: () async {
            await ref.read(cl30DraftStoreProvider).delete(draft.draftId);
            ref.invalidate(cl30DraftsListProvider);
          },
        ),
      ),
    );
  }
}
