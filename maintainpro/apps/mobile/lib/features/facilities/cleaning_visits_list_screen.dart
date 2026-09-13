import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/facilities_api_client.dart';
import 'data/facilities_models.dart';
import 'facilities_permissions.dart';

class CleaningVisitsListScreen extends ConsumerStatefulWidget {
  const CleaningVisitsListScreen({super.key});

  @override
  ConsumerState<CleaningVisitsListScreen> createState() =>
      _CleaningVisitsListScreenState();
}

class _CleaningVisitsListScreenState extends ConsumerState<CleaningVisitsListScreen> {
  bool _loading = true;
  String? _error;
  List<CleaningVisitSummary> _items = const [];

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
      final items =
          await ref.read(facilitiesApiClientProvider).listCleaningVisits();
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
    if (!FacilitiesPermissions.canViewCleaningVisits(role)) {
      return Scaffold(
        appBar: AppBar(title: const Text('Cleaning visits')),
        body: const MpErrorState(
          title: 'Not permitted',
          message: 'Your role cannot view cleaning visits.',
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Cleaning visits')),
      body: _loading
          ? const MpLoading(message: 'Loading visits…')
          : _error != null
              ? MpErrorState(
                  title: 'Could not load',
                  message: _error,
                  onRetry: _load,
                )
              : _items.isEmpty
                  ? const MpEmptyState(title: 'No visits found')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: MpSpacing.sm),
                        itemBuilder: (context, index) {
                          final visit = _items[index];
                          return MpCard(
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(
                                visit.locationName ?? 'Location',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(
                                [
                                  visit.status,
                                  visit.cleanerName,
                                  if (visit.scannedAt != null)
                                    visit.scannedAt!.toLocal().toString(),
                                ].whereType<String>().join(' · '),
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
