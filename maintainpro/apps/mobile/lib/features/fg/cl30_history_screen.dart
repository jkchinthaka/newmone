import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/fg_api_client.dart';
import 'data/fg_models.dart';

final _historyProvider =
    FutureProvider.autoDispose<List<FgRecordSummary>>((ref) async {
  return ref.watch(fgApiClientProvider).history();
});

class Cl30HistoryScreen extends ConsumerWidget {
  const Cl30HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_historyProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('CL30 history')),
      body: async.when(
        loading: () => const MpLoading(message: 'Loading history…'),
        error: (e, _) => MpErrorState(
          title: 'Could not load history',
          message: e is ApiException ? e.message : e.toString(),
          onRetry: () => ref.invalidate(_historyProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const MpEmptyState(
              title: 'No history',
              message: 'Completed CL30 records will appear here.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(_historyProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(MpSpacing.screenPadding),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: MpSpacing.sm),
              itemBuilder: (context, i) {
                final r = items[i];
                return MpCard(
                  onTap: () => context.push('/fg/cl30/records/${r.id}'),
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(r.formTitle ?? r.formCode ?? r.id),
                    subtitle: Text(
                      [
                        if (r.statusLabel != null)
                          r.statusLabel!
                        else if (r.status != null)
                          r.status!,
                        if (r.batchReference != null) r.batchReference!,
                        if (r.updatedAt != null) r.updatedAt!,
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
