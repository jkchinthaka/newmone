import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../design_system/design_system.dart';
import 'data/facilities_api_client.dart';
import 'data/facilities_models.dart';

class UtilitiesMetersScreen extends ConsumerStatefulWidget {
  const UtilitiesMetersScreen({super.key});

  @override
  ConsumerState<UtilitiesMetersScreen> createState() =>
      _UtilitiesMetersScreenState();
}

class _UtilitiesMetersScreenState extends ConsumerState<UtilitiesMetersScreen> {
  bool _loading = true;
  String? _error;
  List<UtilityMeterSummary> _items = const [];

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
      final items = await ref.read(facilitiesApiClientProvider).listMeters();
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
      appBar: AppBar(title: const Text('Utility meters')),
      body: _loading
          ? const MpLoading(message: 'Loading meters…')
          : _error != null
              ? MpErrorState(title: 'Could not load', message: _error, onRetry: _load)
              : _items.isEmpty
                  ? const MpEmptyState(title: 'No meters')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(MpSpacing.screenPadding),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: MpSpacing.sm),
                        itemBuilder: (context, index) {
                          final meter = _items[index];
                          return MpCard(
                            onTap: () => context.push(
                              '/facilities/utilities/${meter.id}',
                            ),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(meter.meterNumber),
                              subtitle: Text(
                                '${meter.type} · ${meter.location ?? '—'}',
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
