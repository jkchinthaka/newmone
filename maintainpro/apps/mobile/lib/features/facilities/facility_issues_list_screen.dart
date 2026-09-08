import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/facilities_api_client.dart';
import 'data/facilities_models.dart';
import 'facilities_permissions.dart';

class FacilityIssuesListScreen extends ConsumerStatefulWidget {
  const FacilityIssuesListScreen({super.key});

  @override
  ConsumerState<FacilityIssuesListScreen> createState() =>
      _FacilityIssuesListScreenState();
}

class _FacilityIssuesListScreenState extends ConsumerState<FacilityIssuesListScreen> {
  bool _loading = true;
  String? _error;
  List<FacilityIssueSummary> _items = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ref.read(facilitiesApiClientProvider).listIssues();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authControllerProvider).user?.role;
    final canReport = FacilitiesPermissions.canReportIssue(role);

    return Scaffold(
      appBar: AppBar(title: const Text('Facility issues')),
      floatingActionButton: canReport
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/facilities/issues/report'),
              icon: const Icon(Icons.add),
              label: const Text('Report'),
            )
          : null,
      body: _loading
          ? const MpLoading(message: 'Loading issues…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : _items.isEmpty
                  ? const MpEmptyState(title: 'No open issues')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: MpSpacing.sm),
                        itemBuilder: (context, index) {
                          final issue = _items[index];
                          return MpCard(
                            onTap: () => context.push(
                              '/facilities/issues/${issue.id}',
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  issue.title,
                                  style:
                                      Theme.of(context).textTheme.titleMedium,
                                ),
                                Text('${issue.severity} · ${issue.status}'),
                                if (issue.workOrderId != null)
                                  const Text('WO linked'),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
