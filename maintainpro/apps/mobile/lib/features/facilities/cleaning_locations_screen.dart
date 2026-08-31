import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/facilities_api_client.dart';
import 'data/facilities_models.dart';

class CleaningLocationsScreen extends ConsumerStatefulWidget {
  const CleaningLocationsScreen({super.key});

  @override
  ConsumerState<CleaningLocationsScreen> createState() =>
      _CleaningLocationsScreenState();
}

class _CleaningLocationsScreenState extends ConsumerState<CleaningLocationsScreen> {
  bool _loading = true;
  String? _error;
  List<CleaningLocationSummary> _items = const [];

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
          await ref.read(facilitiesApiClientProvider).listCleaningLocations();
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
    return Scaffold(
      appBar: AppBar(title: const Text('Cleaning locations')),
      body: _loading
          ? const MpLoading(message: 'Loading locations…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : _items.isEmpty
                  ? const MpEmptyState(title: 'No cleaning locations')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: MpSpacing.sm),
                        itemBuilder: (context, index) {
                          final loc = _items[index];
                          return MpCard(
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(loc.name),
                              subtitle: Text(loc.qrCode ?? loc.address ?? '—'),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
