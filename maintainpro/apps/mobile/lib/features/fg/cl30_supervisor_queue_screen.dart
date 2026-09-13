import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/fg_api_client.dart';
import 'data/fg_models.dart';

final _reviewsProvider =
    FutureProvider.autoDispose<List<FgSubmission>>((ref) async {
  return ref.watch(fgApiClientProvider).listReviews();
});

class Cl30SupervisorQueueScreen extends ConsumerWidget {
  const Cl30SupervisorQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_reviewsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Supervisor reviews')),
      body: async.when(
        loading: () => const MpLoading(message: 'Loading reviews…'),
        error: (e, _) => MpErrorState(
          title: 'Could not load reviews',
          message: e is ApiException ? e.message : e.toString(),
          onRetry: () => ref.invalidate(_reviewsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const MpEmptyState(
              title: 'No reviews pending',
              message:
                  'Submissions awaiting supervisor review will appear here.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(_reviewsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: MpSpacing.sm),
              itemBuilder: (context, i) {
                final s = items[i];
                return MpCard(
                  onTap: () => context.push('/fg/reviews/${s.id}'),
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(s.formTitle ?? s.formCode ?? 'Submission'),
                    subtitle: Text(
                      [
                        if (s.batchReference != null) s.batchReference!,
                        if (s.submittedAt != null) s.submittedAt!,
                        if (s.status != null) s.status!,
                      ].join(' · '),
                    ),
                    trailing: const Icon(Icons.chevron_right),
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
