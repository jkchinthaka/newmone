import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/i18n/app_strings.dart';
import '../../core/offline/outbox_service.dart';
import '../../core/tenant/tenant_context.dart';
import '../../design_system/design_system.dart';

final _draftsProvider = FutureProvider.autoDispose((ref) async {
  final auth = ref.watch(authControllerProvider);
  final tenant = ref.watch(tenantContextProvider);
  final user = auth.user;
  final tenantId = tenant.tenantId;
  if (user == null || tenantId == null) return const [];
  return ref.watch(outboxServiceProvider).listDrafts(
        tenantId: tenantId,
        userId: user.id,
      );
});

class DraftCenterScreen extends ConsumerWidget {
  const DraftCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_draftsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.draftsTitle)),
      body: async.when(
        loading: () => const MpLoading(),
        error: (e, _) => MpErrorState(
          title: 'Could not load drafts',
          message: e.toString(),
          onRetry: () => ref.invalidate(_draftsProvider),
        ),
        data: (drafts) {
          if (drafts.isEmpty) {
            return const MpEmptyState(
              title: AppStrings.emptyDrafts,
              icon: Icons.drafts_outlined,
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(MpSpacing.screenPadding),
            itemCount: drafts.length,
            separatorBuilder: (_, __) => const SizedBox(height: MpSpacing.sm),
            itemBuilder: (context, index) {
              final d = drafts[index];
              return MpCard(
                child: MpListTile(
                  title: d.title ?? d.entityType,
                  subtitle: 'Updated ${d.updatedAt.toLocal()}',
                  leading: const Icon(Icons.edit_note),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () async {
                      await ref
                          .read(outboxServiceProvider)
                          .deleteDraft(d.draftId);
                      ref.invalidate(_draftsProvider);
                    },
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
